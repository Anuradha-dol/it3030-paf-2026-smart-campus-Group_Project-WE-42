package com.smartcampus.controller;

import com.smartcampus.dto.UserDto;
import com.smartcampus.model.User;
import com.smartcampus.repository.UserRepo;
import com.smartcampus.service.UserProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@RestController
@RequestMapping({"/user", "/api/user"})
@RequiredArgsConstructor
public class UserController {

    private final UserProfileService userProfileService;
    private final UserRepo userRepo;

    // Update first and last name.
    @PutMapping("/update-name")
    public ResponseEntity<String> updateName(
            @AuthenticationPrincipal User loggedUser,
            Authentication authentication,
            @Valid @RequestBody UserDto.UpdateNameDto dto) {

        User currentUser = resolveLoggedUser(loggedUser, authentication);
        userProfileService.updateName(currentUser, dto);
        return ResponseEntity.ok("Name updated successfully");
    }

    // Start email update with OTP.
    @PutMapping("/update-email")
    public ResponseEntity<String> updateEmail(
            @AuthenticationPrincipal User loggedUser,
            Authentication authentication,
            @Valid @RequestBody UserDto.UpdateEmailDto dto) {

        User currentUser = resolveLoggedUser(loggedUser, authentication);
        userProfileService.updateEmail(currentUser, dto);
        return ResponseEntity.ok("OTP sent to new email for verification");
    }

    // Confirm new email using OTP.
    @PostMapping("/verify-new-email")
    public ResponseEntity<String> verifyNewEmail(
            @AuthenticationPrincipal User loggedUser,
            Authentication authentication,
            @RequestParam String otp) {

        User currentUser = resolveLoggedUser(loggedUser, authentication);
        userProfileService.verifyNewEmail(currentUser, otp);
        return ResponseEntity.ok("Email updated successfully");
    }

    // Change account password.
    @PutMapping("/update-password")
    public ResponseEntity<String> updatePassword(
            @AuthenticationPrincipal User loggedUser,
            Authentication authentication,
            @Valid @RequestBody UserDto.UpdatePasswordDto dto) {

        User currentUser = resolveLoggedUser(loggedUser, authentication);
        userProfileService.updatePassword(currentUser, dto);
        return ResponseEntity.ok("Password updated successfully");
    }

    // Get profile data for current user.
    @GetMapping("/me")
    public ResponseEntity<UserDto.UserProfileDto> getProfile(
            @AuthenticationPrincipal User loggedUser,
            Authentication authentication) {

        User currentUser = resolveLoggedUser(loggedUser, authentication);

        return ResponseEntity.ok(
                userProfileService.getProfile(currentUser.getUserId())
        );
    }

    // Get home summary for current user.
    @GetMapping("/home")
    public ResponseEntity<UserDto.UserHomeDto> getHome(
            @AuthenticationPrincipal User loggedUser,
            Authentication authentication) {

        User currentUser = resolveLoggedUser(loggedUser, authentication);

        return ResponseEntity.ok(
                userProfileService.getUserHome(currentUser.getUserId())
        );
    }

    // Delete local account with password check.
    @DeleteMapping("/delete")
    public ResponseEntity<String> deleteAccount(
            @AuthenticationPrincipal User loggedUser,
            Authentication authentication,
            @Valid @RequestBody UserDto.DeleteAccountDto dto) {

        User currentUser = resolveLoggedUser(loggedUser, authentication);
        userProfileService.deleteAccount(currentUser, dto);
        return ResponseEntity.ok("Account deleted successfully");
    }

    @DeleteMapping({"/delete-oauth", "/deleteOAuth"})
    public ResponseEntity<String> deleteOAuthAccount(
            @AuthenticationPrincipal User loggedUser,
            Authentication authentication) {

        User currentUser = resolveLoggedUser(loggedUser, authentication);
        userProfileService.deleteOAuthAccount(currentUser);
        return ResponseEntity.ok("OAuth account deleted successfully");
    }

    // Send OTP for account deletion flow.
    @PostMapping("/delete-forgot-request")
    public ResponseEntity<String> deleteForgotRequest(
            @AuthenticationPrincipal User loggedUser,
            Authentication authentication) {

        User currentUser = resolveLoggedUser(loggedUser, authentication);
        userProfileService.requestDeletion(currentUser);
        return ResponseEntity.ok("OTP sent to email");
    }

    // Verify deletion OTP and delete account.
    @PostMapping("/delete-forgot-verify")
    public ResponseEntity<String> deleteForgotVerify(
            @AuthenticationPrincipal User loggedUser,
            Authentication authentication,
            @Valid @RequestBody UserDto.DeleteAccountForgotVerifyDto dto) {

        User currentUser = resolveLoggedUser(loggedUser, authentication);
        userProfileService.verifyAndDelete(currentUser, dto);
        return ResponseEntity.ok("Account deleted successfully");
    }

    // Upload and save profile image path.
    @PostMapping("/upload-profile-image")
    public ResponseEntity<String> uploadProfileImage(
            @AuthenticationPrincipal User user,
            Authentication authentication,
            @RequestParam("file") MultipartFile file) throws IOException {

        User currentUser = resolveLoggedUser(user, authentication);

        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body("File is empty");
        }

        String filename = "profile_" + currentUser.getUserId() + "_" +
                System.currentTimeMillis() + "_" +
                file.getOriginalFilename();

        Path uploadPath = Paths.get("uploads/" + filename);
        Files.createDirectories(uploadPath.getParent());
        Files.write(uploadPath, file.getBytes());

        currentUser.setImageUrl("/uploads/" + filename);
        userRepo.save(currentUser);

        return ResponseEntity.ok(currentUser.getImageUrl());
    }

    // Upload and save cover image path.
    @PostMapping("/upload-cover-image")
    public ResponseEntity<String> uploadCoverImage(
            @AuthenticationPrincipal User user,
            Authentication authentication,
            @RequestParam("file") MultipartFile file) throws IOException {

        User currentUser = resolveLoggedUser(user, authentication);

        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body("File is empty");
        }

        String filename = "cover_" + currentUser.getUserId() + "_" +
                System.currentTimeMillis() + "_" +
                file.getOriginalFilename();

        Path uploadPath = Paths.get("uploads/" + filename);
        Files.createDirectories(uploadPath.getParent());
        Files.write(uploadPath, file.getBytes());

        currentUser.setCoverImageUrl("/uploads/" + filename);
        userRepo.save(currentUser);

        return ResponseEntity.ok(currentUser.getCoverImageUrl());
    }

    // Update phone number only.
    @PutMapping({"/update-phone", "/updatePhone"})
    public ResponseEntity<String> updatePhone(
            @AuthenticationPrincipal User loggedUser,
            Authentication authentication,
            @RequestBody String phoneNumber) {

        User currentUser = resolveLoggedUser(loggedUser, authentication);
        userProfileService.updatePhoneNumber(currentUser, phoneNumber);
        return ResponseEntity.ok("Phone number updated successfully");
    }

    // Update academic year only.
    @PutMapping({"/update-year", "/updateYear"})
    public ResponseEntity<String> updateYear(
            @AuthenticationPrincipal User loggedUser,
            Authentication authentication,
            @RequestBody String year) {

        User currentUser = resolveLoggedUser(loggedUser, authentication);
        userProfileService.updateYear(currentUser, year);
        return ResponseEntity.ok("Year updated successfully");
    }

    // Update semester only.
    @PutMapping({"/update-semester", "/updateSemester"})
    public ResponseEntity<String> updateSemester(
            @AuthenticationPrincipal User loggedUser,
            Authentication authentication,
            @RequestBody String semester) {

        User currentUser = resolveLoggedUser(loggedUser, authentication);
        userProfileService.updateSemester(currentUser, semester);
        return ResponseEntity.ok("Semester updated successfully");
    }

    // Update one supported profile field by name.
    @PutMapping({"/update-profile-field", "/updateProfileField"})
    public ResponseEntity<String> updateProfileField(
            @AuthenticationPrincipal User loggedUser,
            Authentication authentication,
            @Valid @RequestBody UserDto.UpdateProfileFieldDto dto) {

        User currentUser = resolveLoggedUser(loggedUser, authentication);
        userProfileService.updateProfileField(currentUser, dto);
        return ResponseEntity.ok("Profile field updated successfully");
    }

    @GetMapping({"/Admin/me", "/admin/me"})
    public ResponseEntity<UserDto.UserProfileDto> getAdminProfile(
            @AuthenticationPrincipal User loggedUser,
            Authentication authentication) {
        User currentUser = resolveLoggedUser(loggedUser, authentication);
        return ResponseEntity.ok(userProfileService.getProfile(currentUser.getUserId()));
    }

    @GetMapping({"/Admin/dashboard", "/admin/dashboard"})
    public ResponseEntity<UserDto.UserHomeDto> getAdminHome(
            @AuthenticationPrincipal User loggedUser,
            Authentication authentication) {
        User currentUser = resolveLoggedUser(loggedUser, authentication);
        return ResponseEntity.ok(userProfileService.getUserHome(currentUser.getUserId()));
    }

    private User resolveLoggedUser(User loggedUser, Authentication authentication) {
        if (loggedUser != null) {
            if (loggedUser.getEmail() != null && !loggedUser.getEmail().isBlank()) {
                return findUserByEmail(loggedUser.getEmail());
            }
            if (loggedUser.getUserId() != null) {
                return userRepo.findById(loggedUser.getUserId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
            }
        }

        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized");
        }

        Object principal = authentication.getPrincipal();

        if (principal instanceof User user) {
            if (user.getEmail() != null && !user.getEmail().isBlank()) {
                return findUserByEmail(user.getEmail());
            }
            if (user.getUserId() != null) {
                return userRepo.findById(user.getUserId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
            }
        }

        if (principal instanceof UserDetails userDetails) {
            return findUserByEmail(userDetails.getUsername());
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
