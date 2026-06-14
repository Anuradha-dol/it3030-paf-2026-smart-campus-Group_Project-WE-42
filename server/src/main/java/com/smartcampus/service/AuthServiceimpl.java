package com.smartcampus.service;


import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartcampus.dto.AuthResponse;
import com.smartcampus.dto.UserDto;
import com.smartcampus.enums.Role;
import com.smartcampus.enums.Token;
import com.smartcampus.model.User;
import com.smartcampus.records.FaceLoginRequest;
import com.smartcampus.records.LoginRequest;
import com.smartcampus.records.MailBody;
import com.smartcampus.repository.UserRepo;
import com.smartcampus.utils.EmailUtils;
import com.smartcampus.utils.JwtUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import jakarta.servlet.http.HttpServletResponse;
import java.util.*;

@Service
@RequiredArgsConstructor
public class AuthServiceimpl implements AuthService {

    private static final int FACE_DESCRIPTOR_SIZE = 128;

    private final UserRepo userRepo;
    private final PasswordEncoder passwordEncoder;
    private final EmailUtils emailUtils;
    private final AuthenticationManager authenticationManager;
    private final JwtUtils jwtUtils;
    private final ObjectMapper objectMapper;

    @Value("${app.auth.face-similarity-threshold:0.4}")
    private double faceSimilarityThreshold;

    @jakarta.annotation.PostConstruct
    public void init() {
        try {
            userRepo.fixFaceDescriptorColumnType();
        } catch (Exception ignored) {
            // Ignore migration failures to avoid blocking startup on non-MySQL DBs.
        }
    }

    // Allow only SLIIT email pattern.
    private boolean isValidEmail(String email) {
        return email != null && email.matches("(?i)^it\\d+@my\\.sliit\\.lk$");
    }

    // Trim and normalize email for consistent checks.
    private String normalizeEmail(String email) {
        if (email == null) {
            return null;
        }
        return email.trim().toLowerCase(Locale.ROOT);
    }

    // Register user and send verification OTP.
    @Override
    public AuthResponse signUp(UserDto.RegisterRequest request) {
        String normalizedEmail = normalizeEmail(request.email());

        if (!isValidEmail(normalizedEmail)) {
            return AuthResponse.builder()
                    .message("Invalid email! Example: IT23687882@my.sliit.lk")
                    .success(false)
                    .build();
        }

        Optional<User> existing = userRepo.findByEmailIgnoreCase(normalizedEmail);

        if (existing.isPresent() && existing.get().getIsVerified()) {
            return AuthResponse.builder()
                    .message("Email already exists")
                    .success(false)
                    .build();
        }

        User user = existing.orElse(new User());
        String phoneNumber = request.phoneNumber() == null ? null : request.phoneNumber().trim();
        if (phoneNumber != null && phoneNumber.isEmpty()) {
            phoneNumber = null;
        }
        if (phoneNumber != null) {
            Optional<User> phoneOwner = userRepo.findByPhoneNumber(phoneNumber);
            boolean phoneTakenByAnotherUser = phoneOwner.isPresent()
                    && !Objects.equals(phoneOwner.get().getUserId(), user.getUserId());
            if (phoneTakenByAnotherUser) {
                return AuthResponse.builder()
                        .message("Phone number already exists")
                        .success(false)
                        .build();
            }
        }
        String serializedFaceDescriptor = null;
        if (request.faceDescriptor() != null) {
            if (!isValidFaceDescriptor(request.faceDescriptor())) {
                return AuthResponse.builder()
                        .message("Invalid face descriptor")
                        .success(false)
                        .build();
            }
            serializedFaceDescriptor = serializeFaceDescriptor(request.faceDescriptor());
            if (serializedFaceDescriptor == null) {
                return AuthResponse.builder()
                        .message("Failed to process face descriptor")
                        .success(false)
                        .build();
            }
        }

        user.setFirstname(request.firstname());
        user.setLastName(request.lastName());
        user.setEmail(normalizedEmail);
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setPhoneNumber(phoneNumber);
        user.setTempEmail(request.tempEmail());
        if (serializedFaceDescriptor != null) {
            user.setFaceDescriptor(serializedFaceDescriptor);
        }

        user.setRole(request.role() != null ? request.role() : Role.USER);
        user.setYear(request.year());
        user.setSemester(request.semester());

        user.setIsVerified(false);

        int otp = (int) (Math.random() * 900000) + 100000;

        user.setVerifyCode(String.valueOf(otp));
        user.setVerifyCodeExpiry(new Date(System.currentTimeMillis() + 2 * 60 * 1000));

        User saved;
        try {
            saved = userRepo.save(user);
        } catch (DataIntegrityViolationException ex) {
            return AuthResponse.builder()
                    .message(resolveSignupConflictMessage(ex))
                    .success(false)
                    .build();
        }

        String emailTemplate = """
                <html>
                    <body>
                         <h1>Welcome, %s!</h1>
                        <p>Your OTP: <b>%s</b></p>
                        <p>Verify:</p>
                        <a href="http://localhost:5173/verify?email=%s&code=%s">
                            Click Here
                        </a>
                    </body>
                </html>
                """.formatted(
                saved.getFirstname(),
                saved.getVerifyCode(),
                saved.getEmail(),
                saved.getVerifyCode()
        );

        try {
            emailUtils.sendMail(new MailBody(
                    saved.getEmail(),
                    "Verify Account",
                    emailTemplate
            ));
        } catch (Exception e) {
            return AuthResponse.builder()
                    .message("Email failed")
                    .success(false)
                    .build();
        }

        return AuthResponse.builder()
                .message("User registered")
                .success(true)
                .email(saved.getEmail())
                .year(saved.getYear())
                .semester(saved.getSemester())
                .build();
    }

    @Override
    public AuthResponse signIn(LoginRequest request, HttpServletResponse response) {
        String normalizedEmail = normalizeEmail(request.email());

        User user = userRepo.findByEmailIgnoreCase(normalizedEmail).orElse(null);

        if (user == null) {
            return AuthResponse.builder()
                    .message("Email or password is incorrect")
                    .success(false)
                    .build();
        }

        if (!user.getIsVerified()) {
            return AuthResponse.builder()
                    .message("Email not verified! Please verify first.")
                    .success(false)
                    .build();
        }

        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            normalizedEmail,
                            request.password()
                    )
            );
        } catch (Exception e) {
            return AuthResponse.builder()
                    .message("Email or password is incorrect")
                    .success(false)
                    .build();
        }

        Map<String, Object> claims = new HashMap<>();
        claims.put("email", user.getEmail());
        claims.put("role", user.getRole());

        return issueTokens(user, response, claims, "Login successful");
    }

    @Override
    public AuthResponse signInWithFace(FaceLoginRequest request, HttpServletResponse response) {
        String normalizedEmail = normalizeEmail(request.email());
        User user = userRepo.findByEmailIgnoreCase(normalizedEmail).orElse(null);

        if (user == null) {
            return AuthResponse.builder()
                    .message("Face login failed")
                    .success(false)
                    .build();
        }

        if (!Boolean.TRUE.equals(user.getIsVerified())) {
            return AuthResponse.builder()
                    .message("Email not verified! Please verify first.")
                    .success(false)
                    .build();
        }

        List<Double> inputDescriptor = request.faceDescriptor();
        if (!isValidFaceDescriptor(inputDescriptor)) {
            return AuthResponse.builder()
                    .message("Invalid face descriptor payload")
                    .success(false)
                    .build();
        }

        List<Double> storedDescriptor = deserializeFaceDescriptor(user.getFaceDescriptor());
        if (!isValidFaceDescriptor(storedDescriptor)) {
            return AuthResponse.builder()
                    .message("Face login is not enabled for this account")
                    .success(false)
                    .build();
        }

        double distance = calculateEuclideanDistance(storedDescriptor, inputDescriptor);
        double similarity = similarityFromDistance(distance);
        double threshold = normalizeSimilarityThreshold(faceSimilarityThreshold);

        if (similarity < threshold) {
            return AuthResponse.builder()
                    .message("Face does not match")
                    .success(false)
                    .build();
        }

        Map<String, Object> claims = new HashMap<>();
        claims.put("email", user.getEmail());
        claims.put("role", user.getRole());

        return issueTokens(user, response, claims, "Face login successful");
    }

    // Verify registration OTP and activate account.
    @Override
    public AuthResponse verifyCode(String email, String code) {

        User user = userRepo.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (user.getIsVerified()) {
            return AuthResponse.builder()
                    .message("Already verified")
                    .success(false)
                    .build();
        }

        if (!user.getVerifyCode().equals(code)) {
            return AuthResponse.builder()
                    .message("Invalid OTP")
                    .success(false)
                    .build();
        }

        if (user.getVerifyCodeExpiry().before(new Date())) {
            return AuthResponse.builder()
                    .message("OTP expired")
                    .success(false)
                    .build();
        }

        user.setIsVerified(true);
        user.setVerifyCode(null);
        user.setVerifyCodeExpiry(null);

        userRepo.save(user);

        return AuthResponse.builder()
                .message("Verified successfully")
                .success(true)
                .build();
    }

    // Generate and resend a new OTP.
    @Override
    public AuthResponse resendOtp(String email) {

        User user = userRepo.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        int otp = (int) (Math.random() * 900000) + 100000;

        user.setVerifyCode(String.valueOf(otp));
        user.setVerifyCodeExpiry(new Date(System.currentTimeMillis() + 2 * 60 * 1000));

        userRepo.save(user);

        try {
            emailUtils.sendMail(new MailBody(
                    user.getEmail(),
                    "Resend OTP",
                    "Your OTP: " + otp
            ));
        } catch (Exception e) {
            return AuthResponse.builder()
                    .message("Email failed")
                    .success(false)
                    .build();
        }

        return AuthResponse.builder()
                .message("OTP sent")
                .success(true)
                .build();
    }

    private AuthResponse issueTokens(User user, HttpServletResponse response, Map<String, Object> claims, String message) {
        // Clear old cookies before issuing new JWT cookies.
        jwtUtils.removeToken(response, Token.ACCESS);
        jwtUtils.removeToken(response, Token.REFRESH);

        String accessToken = jwtUtils.generateToken(claims, user, response, Token.ACCESS);
        String refreshToken = jwtUtils.generateToken(claims, user, response, Token.REFRESH);

        user.setRefreshToken(refreshToken);
        userRepo.save(user);

        return AuthResponse.builder()
                .success(true)
                .message(message)
                .email(user.getEmail())
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .role(user.getRole())
                .year(user.getYear())
                .semester(user.getSemester())
                .build();
    }

    private String serializeFaceDescriptor(List<Double> descriptor) {
        if (!isValidFaceDescriptor(descriptor)) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(descriptor);
        } catch (JsonProcessingException ex) {
            return null;
        }
    }

    private List<Double> deserializeFaceDescriptor(String serializedDescriptor) {
        if (!StringUtils.hasText(serializedDescriptor)) {
            return null;
        }
        try {
            return objectMapper.readValue(serializedDescriptor, new TypeReference<List<Double>>() {});
        } catch (Exception ex) {
            return null;
        }
    }

    private boolean isValidFaceDescriptor(List<Double> descriptor) {
        if (descriptor == null || descriptor.size() != FACE_DESCRIPTOR_SIZE) {
            return false;
        }
        for (Double value : descriptor) {
            if (value == null || value.isNaN() || value.isInfinite()) {
                return false;
            }
        }
        return true;
    }

    private double calculateEuclideanDistance(List<Double> first, List<Double> second) {
        double sum = 0.0;
        for (int i = 0; i < FACE_DESCRIPTOR_SIZE; i++) {
            double diff = first.get(i) - second.get(i);
            sum += diff * diff;
        }
        return Math.sqrt(sum);
    }

    private double similarityFromDistance(double distance) {
        double similarity = 1.0 - distance;
        if (similarity < 0.0) {
            return 0.0;
        }
        if (similarity > 1.0) {
            return 1.0;
        }
        return similarity;
    }

    private double normalizeSimilarityThreshold(double threshold) {
        if (threshold < 0.0) {
            return 0.0;
        }
        if (threshold > 1.0) {
            return 1.0;
        }
        return threshold;
    }

    private String resolveSignupConflictMessage(DataIntegrityViolationException ex) {
        String detail = extractRootCauseMessage(ex).toLowerCase(Locale.ROOT);
        if (detail.contains("email")) {
            return "Email already exists";
        }
        if (detail.contains("phone")) {
            return "Phone number already exists";
        }
        if (detail.contains("face_descriptor") && (detail.contains("data too long") || detail.contains("value too long"))) {
            return "Face data payload is too large. Please capture and try again.";
        }
        if (detail.contains("data too long") || detail.contains("value too long")) {
            return "One or more fields are too long";
        }
        if (detail.contains("duplicate entry") || detail.contains("unique")) {
            return "Account data already exists";
        }
        return "Unable to complete registration due to conflicting account data";
    }

    private String extractRootCauseMessage(Throwable ex) {
        if (ex == null) {
            return "";
        }
        Throwable root = ex;
        while (root.getCause() != null && root.getCause() != root) {
            root = root.getCause();
        }
        String message = root.getMessage();
        if (message == null || message.isBlank()) {
            message = ex.getMessage();
        }
        return message == null ? "" : message;
    }
}
