package com.smartcampus.service;

import com.smartcampus.dto.NotificationResponseDTO;
import com.smartcampus.enums.NotificationTargetType;
import com.smartcampus.enums.NotificationType;
import com.smartcampus.enums.Role;
import com.smartcampus.model.Notification;
import com.smartcampus.model.User;
import com.smartcampus.repository.NotificationRepository;
import com.smartcampus.repository.UserRepo;
import com.smartcampus.websocket.NotificationRealtimeGateway;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepo userRepo;
    private final NotificationRealtimeGateway realtimeGateway;

    @Transactional
    public Notification createNotification(
            User recipient,
            NotificationType type,
            NotificationTargetType targetType,
            Long targetId,
            String message
    ) {
        // Skip invalid recipients.
        if (recipient == null || recipient.getUserId() == null) {
            return null;
        }

        try {
            // Persist one notification row.
            Notification notification = Notification.builder()
                    .recipient(recipient)
                    .type(type)
                    .targetType(targetType)
                    .targetId(targetId)
                    .message(message)
                    .read(false)
                    .build();

            Notification savedNotification = notificationRepository.save(notification);
            // Push new notification to active websocket sessions.
            pushRealtime(recipient, savedNotification);
            return savedNotification;
        } catch (RuntimeException ex) {
            log.warn("Skipping notification create due to persistence error: {}", ex.getMessage());
            return null;
        }
    }

    @Transactional
    public Notification createNotification(
            Long recipientUserId,
            NotificationType type,
            NotificationTargetType targetType,
            Long targetId,
            String message
    ) {
        // Skip when user id is missing.
        if (recipientUserId == null) {
            return null;
        }

        try {
            return userRepo.findById(recipientUserId)
                    .map(recipient -> createNotification(recipient, type, targetType, targetId, message))
                    .orElse(null);
        } catch (RuntimeException ex) {
            log.warn("Skipping notification create by user id due to error: {}", ex.getMessage());
            return null;
        }
    }

    @Transactional
    public void createForUsers(
            Collection<User> recipients,
            Long excludeUserId,
            NotificationType type,
            NotificationTargetType targetType,
            Long targetId,
            String message
    ) {
        // Skip empty recipient collections.
        if (recipients == null || recipients.isEmpty()) {
            return;
        }

        // Use set to avoid sending duplicates.
        Set<Long> sentTo = new LinkedHashSet<>();
        for (User user : recipients) {
            if (user == null || user.getUserId() == null) {
                continue;
            }
            if (excludeUserId != null && excludeUserId.equals(user.getUserId())) {
                continue;
            }
            if (!sentTo.add(user.getUserId())) {
                continue;
            }
            createNotification(user, type, targetType, targetId, message);
        }
    }

    @Transactional
    public void notifyAdmins(
            NotificationType type,
            NotificationTargetType targetType,
            Long targetId,
            String message,
            Long excludeUserId
    ) {
        try {
            // Broadcast to all admin users.
            List<User> admins = userRepo.findByRole(Role.ADMIN);
            createForUsers(admins, excludeUserId, type, targetType, targetId, message);
        } catch (RuntimeException ex) {
            log.warn("Skipping admin notifications due to error: {}", ex.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public List<NotificationResponseDTO> getNotificationsForUser(Long userId, int limit) {
        // Guard against missing user id.
        if (userId == null) {
            return List.of();
        }

        // Keep API limit within safe range.
        int safeLimit = Math.min(Math.max(limit, 1), 100);

        try {
            return notificationRepository
                    .findByRecipientUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, safeLimit))
                    .stream()
                    .map(this::mapToResponse)
                    .toList();
        } catch (RuntimeException ex) {
            log.warn("Notifications unavailable for user {}: {}", userId, ex.getMessage());
            return List.of();
        }
    }

    @Transactional(readOnly = true)
    public long getUnreadCount(Long userId) {
        if (userId == null) {
            return 0L;
        }
        try {
            return notificationRepository.countByRecipientUserIdAndReadFalse(userId);
        } catch (RuntimeException ex) {
            log.warn("Unread count unavailable for user {}: {}", userId, ex.getMessage());
            return 0L;
        }
    }

    @Transactional
    public NotificationResponseDTO markAsRead(Long userId, Long notificationId) {
        // Only allow updates to user's own notifications.
        Notification notification = notificationRepository.findByIdAndRecipientUserId(notificationId, userId)
                .orElseThrow(() -> new RuntimeException("Notification not found"));

        // Avoid extra update when already read.
        if (!notification.isRead()) {
            notification.setRead(true);
            notification = notificationRepository.save(notification);
        }

        return mapToResponse(notification);
    }

    @Transactional
    public int markAllAsRead(Long userId) {
        try {
            return notificationRepository.markAllAsReadByRecipient(userId);
        } catch (RuntimeException ex) {
            log.warn("Mark all read failed for user {}: {}", userId, ex.getMessage());
            return 0;
        }
    }

    @Transactional
    public void deleteForUser(Long userId, Long notificationId) {
        // Only delete notifications owned by current user.
        Notification notification = notificationRepository.findByIdAndRecipientUserId(notificationId, userId)
                .orElseThrow(() -> new RuntimeException("Notification not found"));
        notificationRepository.delete(notification);
    }

    @Transactional(readOnly = true)
    public Long findBookingOwnerFromCreateNotification(Long bookingId) {
        // Resolve booking owner from earliest booking-created notification.
        if (bookingId == null) {
            return null;
        }

        try {
            return notificationRepository
                    .findFirstByTargetTypeAndTargetIdAndTypeAndMessageStartingWithOrderByCreatedAtAsc(
                            NotificationTargetType.BOOKING,
                            bookingId,
                            NotificationType.BOOKING_CREATED,
                            "Your booking request"
                    )
                    .map(Notification::getRecipient)
                    .map(User::getUserId)
                    .orElse(null);
        } catch (RuntimeException ex) {
            log.warn("Failed resolving booking owner from booking-created notification: {}", ex.getMessage());
            return null;
        }
    }

    private NotificationResponseDTO mapToResponse(Notification notification) {
        return new NotificationResponseDTO(
                notification.getId(),
                notification.getType(),
                notification.getTargetType(),
                notification.getTargetId(),
                notification.getMessage(),
                notification.isRead(),
                notification.getCreatedAt()
        );
    }

    private void pushRealtime(User recipient, Notification notification) {
        // Skip when recipient or payload is missing.
        if (recipient == null || notification == null) {
            return;
        }

        // Use email as websocket user key.
        String username = recipient.getEmail();
        if (username == null || username.isBlank()) {
            return;
        }

        realtimeGateway.pushToUser(username, mapToResponse(notification));
    }
}
