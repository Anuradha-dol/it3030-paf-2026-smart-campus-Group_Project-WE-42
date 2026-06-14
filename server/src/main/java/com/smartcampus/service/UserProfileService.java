package com.smartcampus.service;

import com.smartcampus.dto.UserDto;
import com.smartcampus.model.User;

public interface UserProfileService {

    // Profile read operations.
    UserDto.UserProfileDto getProfile(Long userId);

    UserDto.UserHomeDto getUserHome(Long userId);

    User getCurrentUser(String email);

    // Name update operation.
    UserDto.UpdateNameDto updateName(User user, UserDto.UpdateNameDto dto);

    // Email update and verification operations.
    UserDto.UpdateEmailDto updateEmail(User user, UserDto.UpdateEmailDto dto);

    void verifyNewEmail(User user, String otp);

    // Password update operation.
    void updatePassword(User user, UserDto.UpdatePasswordDto dto);

    // Individual profile field updates.
    void updatePhoneNumber(User user, String phoneNumber);
    
    void updateYear(User user, String year);
    
    void updateSemester(User user, String semester);
    
    void updateProfileField(User user, UserDto.UpdateProfileFieldDto dto);

    // Account deletion operations.
    void deleteAccount(User user, UserDto.DeleteAccountDto dto);
    void deleteOAuthAccount(User user);

    void requestDeletion(User user);

    void verifyAndDelete(User user, UserDto.DeleteAccountForgotVerifyDto dto);
}
