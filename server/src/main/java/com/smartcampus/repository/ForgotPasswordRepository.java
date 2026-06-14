package com.smartcampus.repository;

import com.smartcampus.model.ForgotPassword;
import com.smartcampus.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ForgotPasswordRepository extends JpaRepository<ForgotPassword, Integer> {


    Optional<ForgotPassword> findByOtpAndUser(Integer otp, User user);


    Optional<ForgotPassword> findByUser(User user);
}

