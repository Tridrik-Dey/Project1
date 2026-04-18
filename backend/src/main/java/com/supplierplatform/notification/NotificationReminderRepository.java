package com.supplierplatform.notification;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface NotificationReminderRepository extends JpaRepository<NotificationReminder, UUID> {

    List<NotificationReminder> findBySupplierId(UUID supplierId);

    List<NotificationReminder> findByScheduledForBeforeAndSentAtIsNull(LocalDateTime time);

    boolean existsBySupplierIdAndDocumentIdAndReminderTypeAndRecipientEmailAndIsDismissedFalse(
            UUID supplierId,
            UUID documentId,
            ReminderType reminderType,
            String recipientEmail
    );
}
