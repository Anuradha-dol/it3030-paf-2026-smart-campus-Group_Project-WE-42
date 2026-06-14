package com.smartcampus.controller;

import com.smartcampus.dto.AuthResponse;
import com.smartcampus.dto.UserDto;
import com.smartcampus.enums.Token;
import com.smartcampus.model.User;
import com.smartcampus.records.FaceLoginRequest;
import com.smartcampus.records.LoginRequest;
import com.smartcampus.repository.UserRepo;
import com.smartcampus.service.AuthService;
import com.smartcampus.utils.JwtUtils;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final UserRepo userRepo;
    private final JwtUtils jwtUtils;

    // Register user and send OTP email.
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(
            @Valid @RequestBody UserDto.RegisterRequest req,
            HttpServletResponse response
    ) {

        AuthResponse res = authService.signUp(req);

        // Store email in cookie for OTP verify/resend.
        Cookie cookie = new Cookie("userEmail", req.email());
        cookie.setHttpOnly(true);
        cookie.setPath("/");
        cookie.setMaxAge(30 * 60);

        response.addCookie(cookie);

        return ResponseEntity.ok(res);
    }

    // Login and issue auth cookies.
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @RequestBody LoginRequest req,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        // Clear previous session state.
        if (request.getSession(false) != null) {
            request.getSession(false).invalidate();
        }
        return ResponseEntity.ok(authService.signIn(req, response));
    }

    // Face login and issue auth cookies.
    @PostMapping("/face/login")
    public ResponseEntity<AuthResponse> faceLogin(
            @Valid @RequestBody FaceLoginRequest req,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        // Clear previous session state.
        if (request.getSession(false) != null) {
            request.getSession(false).invalidate();
        }
        return ResponseEntity.ok(authService.signInWithFace(req, response));
    }

    // Verify signup OTP using cookie email.
    @PostMapping("/verify-code")
    public ResponseEntity<AuthResponse> verify(
            @RequestBody UserDto.VerifyCodeDto dto,
            HttpServletRequest request
    ) {

        // Read email captured during registration.
        String email = getCookie(request, "userEmail");

        if (email == null) {
            return ResponseEntity.badRequest()
                    .body(AuthResponse.builder()
                            .message("Email not found")
                            .success(false)
                            .build());
        }

        return ResponseEntity.ok(authService.verifyCode(email, dto.verifyCode()));
    }

    // Resend signup OTP to cookie email.
    @PostMapping("/resend-otp")
    public ResponseEntity<AuthResponse> resend(HttpServletRequest request) {

        String email = getCookie(request, "userEmail");

        if (email == null) {
            return ResponseEntity.badRequest()
                    .body(AuthResponse.builder()
                            .message("Email not found")
                            .success(false)
                            .build());
        }

        return ResponseEntity.ok(authService.resendOtp(email));
    }

    // Logout and clear auth cookies.
    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(HttpServletRequest request, HttpServletResponse response) {
        // Remove access and refresh cookies.
        jwtUtils.removeToken(response, Token.ACCESS);
        jwtUtils.removeToken(response, Token.REFRESH);
        // Invalidate server session if present.
        if (request.getSession(false) != null) {
            request.getSession(false).invalidate();
        }

        return ResponseEntity.ok(Map.of("message", "Logout successful"));
    }

    // Check if phone number is available.
    @PostMapping("/check-phone")
    public ResponseEntity<Map<String, Boolean>> checkPhone(@RequestBody Map<String, String> body) {

        String phone = body.get("phoneNumber");
        boolean available = userRepo.findByPhoneNumber(phone).isEmpty();

        return ResponseEntity.ok(Map.of("available", available));
    }

    // Return logged-in user profile data.
    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getMe(
            @AuthenticationPrincipal UserDetails userDetails,
            Authentication authentication
    ) {
        User user = resolveAuthenticatedUser(userDetails, authentication);

        Map<String, Object> response = new java.util.HashMap<>();
        Map<String, Object> userPayload = new java.util.HashMap<>();
        userPayload.put("userId", user.getUserId());
        userPayload.put("firstname", user.getFirstname());
        userPayload.put("lastName", user.getLastName());
        userPayload.put("email", user.getEmail());
        userPayload.put("imageUrl", user.getImageUrl());
        userPayload.put("coverImageUrl", user.getCoverImageUrl());
        userPayload.put("phoneNumber", user.getPhoneNumber());
        userPayload.put("role", user.getRole());
        userPayload.put("year", user.getYear());
        userPayload.put("semester", user.getSemester());
        userPayload.put("provider", user.getProvider());
        userPayload.put("isVerified", user.getIsVerified());

        response.put("user", userPayload);
        response.put("provider", user.getProvider());
        response.put("authenticated", true);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/all-users")
    public ResponseEntity<java.util.List<User>> getAllUsers() {
        return ResponseEntity.ok(userRepo.findAll());
    }

    // Refresh access and refresh JWT cookies.
    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(HttpServletRequest request, HttpServletResponse response) {
        // Read refresh token from cookie.
        String refreshToken = getCookie(request, "REFRESH");

        if (refreshToken == null || refreshToken.isBlank()) {
            return ResponseEntity.status(401).body(Map.of("message", "No refresh token"));
        }

        try {
            String username = jwtUtils.extractUsername(refreshToken);
            User user = userRepo.findByEmailIgnoreCase(username).orElseThrow(() -> new RuntimeException("User not found"));

            // Token must be valid and match stored refresh token.
            if (jwtUtils.validateToken(refreshToken, user) && refreshToken.equals(user.getRefreshToken())) {
                Map<String, Object> claims = new java.util.HashMap<>();
                claims.put("email", user.getEmail());
                claims.put("role", user.getRole().name());

                // Rotate both JWT cookies.
                String newAccessToken = jwtUtils.generateToken(claims, user, response, Token.ACCESS);
                String newRefreshToken = jwtUtils.generateToken(claims, user, response, Token.REFRESH);

                user.setRefreshToken(newRefreshToken);
                userRepo.save(user);

                return ResponseEntity.ok(Map.of(
                        "success", true,
                        "accessToken", newAccessToken,
                        "refreshToken", newRefreshToken
                ));
            } else {
                return ResponseEntity.status(403).body(Map.of("message", "Invalid refresh token"));
            }
        } catch (Exception e) {
            return ResponseEntity.status(403).body(Map.of("message", "Invalid refresh token"));
        }
    }

    // Read latest non-empty cookie value.
    private String getCookie(HttpServletRequest request, String name) {
        if (request.getCookies() == null) return null;

        String latestValue = null;
        // Keep latest value when duplicate cookie names exist.
        for (Cookie c : request.getCookies()) {
            if (name.equals(c.getName())) {
                String value = c.getValue();
                if (value != null && !value.isBlank()) {
                    latestValue = value;
                }
            }
        }
        return latestValue;
    }

    private User resolveAuthenticatedUser(UserDetails userDetails, Authentication authentication) {
        if (userDetails != null && userDetails.getUsername() != null && !userDetails.getUsername().isBlank()) {
            return findUserByEmail(userDetails.getUsername());
        }

        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized");
        }

        Object principal = authentication.getPrincipal();

        if (principal instanceof User user) {
            return findUserByEmail(user.getEmail());
        }

        if (principal instanceof UserDetails details) {
            return findUserByEmail(details.getUsername());
        }

        if (principal instanceof OAuth2User oauth2User) {
            Object emailAttr = oauth2User.getAttribute("email");
            if (emailAttr != null) {
                return findUserByEmail(String.valueOf(emailAttr));
            }
        }

        if (principal instanceof String username
                && !username.isBlank()
                && !"anonymousUser".equalsIgnoreCase(username)) {
            return findUserByEmail(username);
        }

        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated user not found");
    }

    private User findUserByEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated user email missing");
        }

        return userRepo.findByEmailIgnoreCase(email.trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }
}
