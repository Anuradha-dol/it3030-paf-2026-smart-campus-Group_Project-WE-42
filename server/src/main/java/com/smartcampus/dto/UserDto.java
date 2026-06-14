package com.smartcampus.dto;

import com.smartcampus.enums.Role;
import com.smartcampus.enums.Semester;
import com.smartcampus.enums.Year;

import jakarta.validation.constraints.*;
import java.util.List;

public class UserDto {

    public record RegisterRequest(
            @NotBlank(message = "First name is required")
            String firstname,

            @NotBlank(message = "Last name is required")
            String lastName,

            @NotBlank(message = "Email is required")
            @Email(message = "Please provide a valid email")
            String email,

            @NotBlank(message = "Temp email is required")
            @Email(message = "Please provide a valid temp email")
            String tempEmail,

            String phoneNumber,

            @NotNull(message = "Role is required")
            Role role,

            Year year,

            Semester semester,

            @Size(min = 128, max = 128, message = "faceDescriptor must contain exactly 128 values")
            List<Double> faceDescriptor,

            @NotBlank(message = "Password is required")
            String password
    ) {}

    public record ChangePassword(
            String password,
            String repeatPassword
    ) {}

    public record DeleteAccountDto(
            @NotBlank(message = "Current password is required")
            String currentPassword
    ) {}

    public record DeleteAccountForgotRequest(
            @NotBlank(message = "Email is required")
            String email
    ) {}

    public record DeleteAccountForgotVerifyDto(
            @NotBlank(message = "OTP is required")
            String otp
    ) {}

    public record UpdateEmailDto(
            @NotBlank(message = "Email cannot be blank")
            @Email(message = "Provide a valid email")
            String newEmail
    ) {}

    public record UpdateNameDto(
            @NotBlank(message = "Name cannot be blank")
            String name,
            String lastName
    ) {}

    public record UpdatePasswordDto(
            @NotBlank(message = "Current password is required")
            String currentPassword,

            @NotBlank(message = "New password is required")
            @Size(min = 6, message = "Password must be at least 6 characters")
            String newPassword,

            @NotBlank(message = "Confirm password is required")
            String confirmPassword
    ) {}

    public record UpdateProfileFieldDto(
            @NotBlank(message = "Field name is required")
            String field,
            
            @NotBlank(message = "Field value is required")
            String value
    ) {}

    public record UserHomeDto(
            String welcomeMessage,
            int notifications,
            int tasks
    ) {}

    public record UserProfileDto(
            Long id,
            String name,
            String email,
            String lastName,
            Role role,
            String phoneNumber,
            String tempEmail,
            String profileImageUrl,
            String coverImageUrl,
            Year year,
            Semester semester
    ) {}

    public record VerifyCodeDto(
            @NotBlank(message = "Verification code is required")
            String verifyCode
    ) {}
}
