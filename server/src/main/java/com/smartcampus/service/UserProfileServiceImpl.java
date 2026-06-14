package com.smartcampus.service;

import com.smartcampus.dto.UserDto;
import com.smartcampus.enums.AuthProvider;
import com.smartcampus.enums.Semester;
import com.smartcampus.enums.Year;
import com.smartcampus.model.ForgotPassword;
import com.smartcampus.model.MaintenanceTicket;
import com.smartcampus.model.User;
import com.smartcampus.records.MailBody;
import com.smartcampus.repository.CommentRepository;
import com.smartcampus.repository.ForgotPasswordRepository;
import com.smartcampus.repository.MaintenanceTicketRepository;
import com.smartcampus.repository.NotificationRepository;
import com.smartcampus.repository.UserRepo;
import com.smartcampus.utils.EmailUtils;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.Locale;
import java.util.Random;

@Service
@RequiredArgsConstructor
public class UserProfileServiceImpl implements UserProfileService {

    private final UserRepo userRepo;
    private final PasswordEncoder passwordEncoder;
    private final ForgotPasswordRepository forgotPasswordRepository;
    private final EmailUtils emailUtils;
    private final NotificationService notificationService;
    private final NotificationRepository notificationRepository;
    private final CommentRepository commentRepository;
    private final MaintenanceTicketRepository maintenanceTicketRepository;

    // Resolve current user by email.
    @Override
    public User getCurrentUser(String email) {
        return userRepo.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    // Delete local or OAuth account.
    @Transactional
    @Override
    public void deleteAccount(User user, UserDto.DeleteAccountDto dto) {
        boolean isLocalAccount = user.getProvider() == null || user.getProvider() == AuthProvider.LOCAL;

        if (isLocalAccount) {
            if (dto.currentPassword() == null || dto.currentPassword().trim().isEmpty()) {
                throw new RuntimeException("Current password is required");
            }

            if (!passwordEncoder.matches(dto.currentPassword(), user.getPassword())) {
                throw new RuntimeException("Current password is incorrect");
            }
        }

        deleteUserAndRelatedData(user);
    }

    @Transactional
    @Override
    public void deleteOAuthAccount(User user) {
        boolean isLocalAccount = user.getProvider() == null || user.getProvider() == AuthProvider.LOCAL;

        if (isLocalAccount) {
            throw new RuntimeException("Password is required for local account deletion");
        }

        deleteUserAndRelatedData(user);
    }

    // Send OTP before account deletion.
    @Transactional
    @Override
    public void requestDeletion(User user) {

        int otp = new Random().nextInt(900000) + 100000;
        Date expiration = new Date(System.currentTimeMillis() + 10 * 60 * 1000);

        ForgotPassword fp = forgotPasswordRepository.findByUser(user)
                .orElse(new ForgotPassword());

        fp.setUser(user);
        fp.setOtp(otp);
        fp.setExpirationTime(expiration);
        fp.setLastSentAt(new Date());

        forgotPasswordRepository.save(fp);

        emailUtils.sendMail(new MailBody(
                user.getEmail(),
                "OTP for Account Deletion",
                "Your OTP is: " + otp + " (valid for 10 minutes)"
        ));
    }

    // Verify OTP and delete account.
    @Transactional
    @Override
    public void verifyAndDelete(User user, UserDto.DeleteAccountForgotVerifyDto dto) {

        ForgotPassword fp = forgotPasswordRepository.findByUser(user)
                .orElseThrow(() -> new RuntimeException("OTP not requested"));

        if (!fp.getOtp().equals(Integer.parseInt(dto.otp()))) {
            throw new RuntimeException("Invalid OTP");
        }

        if (fp.getExpirationTime().before(new Date())) {
            throw new RuntimeException("OTP expired");
        }

        deleteUserAndRelatedData(user);
    }

    // Update first and last name.
    @Transactional
    @Override
    public UserDto.UpdateNameDto updateName(User user, UserDto.UpdateNameDto dto) {

        user.setFirstname(dto.name());
        user.setLastName(dto.lastName());

        userRepo.save(user);

        return new UserDto.UpdateNameDto(
                user.getFirstname(),
                user.getLastName()
        );
    }

    // Send OTP to verify new email.
    @Transactional
    @Override
    public UserDto.UpdateEmailDto updateEmail(User user, UserDto.UpdateEmailDto dto) {

        String newEmail = dto.newEmail();

        if (userRepo.findByEmailIgnoreCase(newEmail).isPresent()) {
            throw new RuntimeException("Email already in use");
        }

        int otp = new Random().nextInt(900000) + 100000;

        user.setTempEmail(newEmail);
        user.setVerifyCode(String.valueOf(otp));
        user.setVerifyCodeExpiry(new Date(System.currentTimeMillis() + 5 * 60 * 1000));
        user.setLastOtpSentAt(new Date());

        userRepo.save(user);

        emailUtils.sendMail(new MailBody(
                newEmail,
                "Verify New Email",
                "Your OTP is: " + otp + " (valid for 5 minutes)"
        ));

        return new UserDto.UpdateEmailDto(newEmail);
    }

    // Confirm new email with OTP.
    @Transactional
    @Override
    public void verifyNewEmail(User user, String otp) {

        if (user.getVerifyCode() == null) {
            throw new RuntimeException("OTP not found");
        }

        if (!user.getVerifyCode().equals(otp)) {
            throw new RuntimeException("Invalid OTP");
        }

        if (user.getVerifyCodeExpiry().before(new Date())) {
            throw new RuntimeException("OTP expired");
        }

        user.setEmail(user.getTempEmail());
        user.setTempEmail(null);
        user.setVerifyCode(null);
        user.setVerifyCodeExpiry(null);

        userRepo.save(user);
    }

    // Update account password.
    @Transactional
    @Override
    public void updatePassword(User user, UserDto.UpdatePasswordDto dto) {

        if (!passwordEncoder.matches(dto.currentPassword(), user.getPassword())) {
            throw new RuntimeException("Current password is incorrect");
        }

        if (!dto.newPassword().equals(dto.confirmPassword())) {
            throw new RuntimeException("Passwords do not match");
        }

        user.setPassword(passwordEncoder.encode(dto.newPassword()));
        userRepo.save(user);
    }

    // Build quick home summary.
    @Override
    public UserDto.UserHomeDto getUserHome(Long userId) {
        String firstName = "User";
        if (userId != null) {
            firstName = userRepo.findById(userId)
                    .map(User::getFirstname)
                    .filter(name -> name != null && !name.trim().isEmpty())
                    .orElse("User");
        }

        long unreadNotifications = notificationService.getUnreadCount(userId);
        int unreadCount = (int) Math.min(unreadNotifications, Integer.MAX_VALUE);

        return new UserDto.UserHomeDto("Welcome back, " + firstName + "!", unreadCount, 5);
    }

    // Return full profile data.
    @Override
    public UserDto.UserProfileDto getProfile(Long userId) {

        User user = userRepo.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return new UserDto.UserProfileDto(
                user.getUserId(),
                user.getFirstname(),
                user.getEmail(),
                user.getLastName(),
                user.getRole(),
                user.getPhoneNumber(),
                user.getTempEmail(),
                user.getImageUrl(),
                user.getCoverImageUrl(),
                user.getYear(),
                user.getSemester()
        );
    }

    // Update phone number.
    @Transactional
    @Override
    public void updatePhoneNumber(User user, String phoneNumber) {
        if (phoneNumber == null || phoneNumber.trim().isEmpty()) {
            throw new RuntimeException("Phone number cannot be empty");
        }
        user.setPhoneNumber(phoneNumber.trim());
        userRepo.save(user);
    }

    // Update academic year.
    @Transactional
    @Override
    public void updateYear(User user, String year) {
        if (year == null || year.trim().isEmpty()) {
            throw new RuntimeException("Year cannot be empty");
        }
        try {
            user.setYear(parseYear(year));
            userRepo.save(user);
        } catch (Exception e) {
            throw new RuntimeException("Invalid year format");
        }
    }

    // Update semester.
    @Transactional
    @Override
    public void updateSemester(User user, String semester) {
        if (semester == null || semester.trim().isEmpty()) {
            throw new RuntimeException("Semester cannot be empty");
        }
        try {
            user.setSemester(parseSemester(semester));
            userRepo.save(user);
        } catch (Exception e) {
            throw new RuntimeException("Invalid semester format");
        }
    }

    // Route field update by field name.
    @Transactional
    @Override
    public void updateProfileField(User user, UserDto.UpdateProfileFieldDto dto) {
        String field = dto.field();
        String value = dto.value();

        if (value == null || value.trim().isEmpty()) {
            throw new RuntimeException("Field value cannot be empty");
        }

        switch (field.toLowerCase()) {
            case "phonenumber":
            case "phone":
                updatePhoneNumber(user, value);
                break;
            case "year":
                updateYear(user, value);
                break;
            case "semester":
                updateSemester(user, value);
                break;
            default:
                throw new RuntimeException("Unknown field: " + field);
        }
    }

    private Year parseYear(String rawValue) {
        String value = normalizeEnumInput(rawValue);

        return switch (value) {
            case "1", "FIRST", "YEAR1", "Y1", "1ST" -> Year.FIRST;
            case "2", "SECOND", "YEAR2", "Y2", "2ND" -> Year.SECOND;
            case "3", "THIRD", "YEAR3", "Y3", "3RD" -> Year.THIRD;
            case "4", "FOURTH", "YEAR4", "Y4", "4TH" -> Year.FOURTH;
            default -> throw new IllegalArgumentException("Invalid year: " + rawValue);
        };
    }

    private Semester parseSemester(String rawValue) {
        String value = normalizeEnumInput(rawValue);

        return switch (value) {
            case "1", "SEM1", "SEMESTER1", "FIRST", "FIRSTSEMESTER" -> Semester.SEM1;
            case "2", "SEM2", "SEMESTER2", "SECOND", "SECONDSEMESTER" -> Semester.SEM2;
            default -> throw new IllegalArgumentException("Invalid semester: " + rawValue);
        };
    }

    private String normalizeEnumInput(String rawValue) {
        return rawValue
                .trim()
                .replace("\"", "")
                .replace("'", "")
                .replace("-", "")
                .replace("_", "")
                .replace(" ", "")
                .toUpperCase(Locale.ROOT);
    }

    private void deleteUserAndRelatedData(User user) {
        if (user == null) {
            return;
        }

        Long userId = user.getUserId();
        if (userId == null) {
            userRepo.delete(user);
            return;
        }

        // Remove notification rows referencing this user.
        notificationRepository.deleteByRecipientUserId(userId);
        notificationRepository.flush();

        // Remove comments authored by this user.
        commentRepository.deleteByUserId(userId);
        commentRepository.flush();

        // Detach technician references from other users' tickets.
        maintenanceTicketRepository.clearAssignedTechnician(userId);
        maintenanceTicketRepository.flush();

        // Delete tickets reported by this user (attachments/comments cascade).
        java.util.List<MaintenanceTicket> reportedTickets = maintenanceTicketRepository.findByReporterUserId(userId);
        if (!reportedTickets.isEmpty()) {
            maintenanceTicketRepository.deleteAll(reportedTickets);
            maintenanceTicketRepository.flush();
        }

        // Remove OTP reset row if present.
        forgotPasswordRepository.findByUser(user).ifPresent(forgotPasswordRepository::delete);
        forgotPasswordRepository.flush();

        userRepo.delete(user);
        userRepo.flush();
    }
}
