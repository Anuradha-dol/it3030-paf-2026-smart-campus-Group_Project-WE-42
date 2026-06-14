package com.smartcampus.controller;

import com.smartcampus.dto.NotificationResponseDTO;
import com.smartcampus.model.User;
import com.smartcampus.repository.UserRepo;
import com.smartcampus.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;
    private final UserRepo userRepo;

    @GetMapping
    public ResponseEntity<List<NotificationResponseDTO>> getMyNotifications(
            @AuthenticationPrincipal User user,
            Authentication authentication,
            @RequestParam(defaultValue = "20") int limit
    ) {
        // Resolve current user from principal/authentication.
        User currentUser = resolveLoggedUser(user, authentication);
        // Return latest notifications up to the given limit.
        return ResponseEntity.ok(notificationService.getNotificationsForUser(currentUser.getUserId(), limit));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Long>> getUnreadCount(
            @AuthenticationPrincipal User user,
            Authentication authentication
    ) {
        // Return unread count for bell badge.
        User currentUser = resolveLoggedUser(user, authentication);
        return ResponseEntity.ok(Map.of("count", notificationService.getUnreadCount(currentUser.getUserId())));
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<NotificationResponseDTO> markAsRead(
            @AuthenticationPrincipal User user,
            Authentication authentication,
            @PathVariable("id") Long id
    ) {
        // Mark one notification as read for current user.
        User currentUser = resolveLoggedUser(user, authentication);
        NotificationResponseDTO response = notificationService.markAsRead(currentUser.getUserId(), id);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/read-all")
    public ResponseEntity<Map<String, Integer>> markAllAsRead(
            @AuthenticationPrincipal User user,
            Authentication authentication
    ) {
        // Mark all unread notifications as read.
        User currentUser = resolveLoggedUser(user, authentication);
        int updated = notificationService.markAllAsRead(currentUser.getUserId());
        return ResponseEntity.ok(Map.of("updated", updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteNotification(
            @AuthenticationPrincipal User user,
            Authentication authentication,
            @PathVariable("id") Long id
    ) {
        // Delete one notification owned by current user.
        User currentUser = resolveLoggedUser(user, authentication);
        notificationService.deleteForUser(currentUser.getUserId(), id);
        return ResponseEntity.noContent().build();
    }

    private User resolveLoggedUser(User loggedUser, Authentication authentication) {
        // First try injected principal model.
        if (loggedUser != null) {
            if (loggedUser.getEmail() != null && !loggedUser.getEmail().isBlank()) {
                return findUserByEmail(loggedUser.getEmail());
            }
            if (loggedUser.getUserId() != null) {
                return userRepo.findById(loggedUser.getUserId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
            }
        }

        // Then fallback to Spring Authentication principal types.
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
