package com.smartcampus.dto;

import com.smartcampus.enums.NotificationTargetType;
import com.smartcampus.enums.NotificationType;

import java.time.LocalDateTime;

public record NotificationResponseDTO(
        Long id,
        NotificationType type,
        NotificationTargetType targetType,
        Long targetId,
        String message,
        boolean read,
        LocalDateTime createdAt
) {
}
