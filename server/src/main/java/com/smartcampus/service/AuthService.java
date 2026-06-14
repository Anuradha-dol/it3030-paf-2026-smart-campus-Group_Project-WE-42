package com.smartcampus.service;

import com.smartcampus.dto.AuthResponse;
import com.smartcampus.dto.UserDto;
import com.smartcampus.records.FaceLoginRequest;
import com.smartcampus.records.LoginRequest;
import jakarta.servlet.http.HttpServletResponse;

public interface AuthService {

    AuthResponse signUp(UserDto.RegisterRequest registerRequest);

    AuthResponse signIn(LoginRequest loginRequest, HttpServletResponse response);

    AuthResponse signInWithFace(FaceLoginRequest faceLoginRequest, HttpServletResponse response);

    AuthResponse verifyCode(String email, String verifyCode);

    AuthResponse resendOtp(String email);
}
