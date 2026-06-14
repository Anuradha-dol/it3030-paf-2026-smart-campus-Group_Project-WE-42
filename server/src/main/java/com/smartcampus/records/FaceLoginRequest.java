package com.smartcampus.records;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record FaceLoginRequest(
        @NotBlank(message = "email is required")
        @Email(message = "please provide valid email")
        String email,

        @Size(min = 128, max = 128, message = "faceDescriptor must contain exactly 128 values")
        List<Double> faceDescriptor
) {
}
