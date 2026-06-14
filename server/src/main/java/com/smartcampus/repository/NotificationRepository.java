package com.smartcampus.repository;

import com.smartcampus.enums.NotificationTargetType;
import com.smartcampus.enums.NotificationType;
import com.smartcampus.model.Notification;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findByRecipientUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    long countByRecipientUserIdAndReadFalse(Long userId);

    Optional<Notification> findByIdAndRecipientUserId(Long id, Long userId);

    Optional<Notification> findFirstByTargetTypeAndTargetIdAndTypeAndMessageStartingWithOrderByCreatedAtAsc(
            NotificationTargetType targetType,
            Long targetId,
            NotificationType type,
            String messagePrefix
    );

    @Modifying
    @Query("""
            UPDATE Notification n
            SET n.read = true
            WHERE n.recipient.userId = :userId
              AND n.read = false
            """)
    int markAllAsReadByRecipient(@Param("userId") Long userId);

    @Modifying
    @Query("""
            DELETE FROM Notification n
            WHERE n.recipient.userId = :userId
            """)
    int deleteByRecipientUserId(@Param("userId") Long userId);
}
