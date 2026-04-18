package com.supplierplatform.notification;

import com.supplierplatform.document.SupplierDocument;
import com.supplierplatform.document.SupplierDocumentRepository;
import com.supplierplatform.supplier.SupplierContactRepository;
import com.supplierplatform.supplier.entity.SupplierContact;
import com.supplierplatform.supplier.enums.PreferredLanguage;
import com.supplierplatform.supplier.enums.SupplierStatus;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class DocumentExpiryReminderService {

    private final SupplierDocumentRepository supplierDocumentRepository;
    private final SupplierContactRepository supplierContactRepository;
    private final NotificationReminderRepository notificationReminderRepository;
    private final JavaMailSender javaMailSender;

    @Value("${app.reminders.document-expiry.days-before:30}")
    private int daysBeforeExpiry;

    @Value("${app.reminders.document-expiry.mail.enabled:false}")
    private boolean mailEnabled;

    @Value("${app.reminders.document-expiry.mail.from:no-reply@supplierplatform.local}")
    private String fromEmail;

    @Value("${app.mail.retry.max-attempts:3}")
    private int mailRetryMaxAttempts;

    @Value("${app.mail.retry.backoff-ms:500}")
    private long mailRetryBackoffMs;

    @Scheduled(cron = "${app.reminders.document-expiry.cron:0 0 9 * * *}")
    @Transactional
    public void runScheduledReminderScan() {
        processExpiringDocuments();
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void runStartupReminderScan() {
        processExpiringDocuments();
    }

    @Transactional
    public ReminderRunResult processExpiringDocuments() {
        LocalDate today = LocalDate.now();
        LocalDate threshold = today.plusDays(daysBeforeExpiry);

        List<SupplierDocument> expiring = supplierDocumentRepository.findByIsCurrentTrueAndExpiryDateBetween(today, threshold);
        log.info(
                "Starting reminder scan windowStart={} windowEnd={} expiringDocs={} mailEnabled={}",
                today,
                threshold,
                expiring.size(),
                mailEnabled
        );
        int mailsSent = 0;
        int skipped = 0;

        for (SupplierDocument doc : expiring) {
            if (doc.getSupplier() == null
                    || doc.getSupplier().getStatus() == null
                    || doc.getSupplier().getStatus() == SupplierStatus.DRAFT) {
                skipped++;
                continue;
            }

            UUID supplierId = doc.getSupplier().getId();
            Set<String> recipientEmails = collectRecipientEmails(supplierId);
            if (recipientEmails.isEmpty()) {
                skipped++;
                continue;
            }

            for (String email : recipientEmails) {
                boolean alreadySent = notificationReminderRepository
                        .existsBySupplierIdAndDocumentIdAndReminderTypeAndRecipientEmailAndIsDismissedFalse(
                                supplierId,
                                doc.getId(),
                                ReminderType.DOCUMENT_EXPIRY,
                                email
                        );
                if (alreadySent) {
                    skipped++;
                    continue;
                }

                if (mailEnabled) {
                    boolean sent = sendEmailWithRetry(doc, email);
                    if (!sent) {
                        skipped++;
                        continue;
                    }
                } else {
                    log.info("Mail disabled, skipping actual send to {} for document {}", email, doc.getId());
                }

                NotificationReminder reminder = NotificationReminder.builder()
                        .supplier(doc.getSupplier())
                        .document(doc)
                        .recipientEmail(email)
                        .reminderType(ReminderType.DOCUMENT_EXPIRY)
                        .scheduledFor(LocalDateTime.now())
                        .sentAt(LocalDateTime.now())
                        .isDismissed(false)
                        .build();
                notificationReminderRepository.save(reminder);
                mailsSent++;
            }
        }

        log.info(
                "Reminder scan completed windowStart={} windowEnd={} expiringDocs={} sent={} skipped={}",
                today,
                threshold,
                expiring.size(),
                mailsSent,
                skipped
        );
        return new ReminderRunResult(expiring.size(), mailsSent, skipped, today, threshold);
    }

    private Set<String> collectRecipientEmails(UUID supplierId) {
        List<SupplierContact> contacts = supplierContactRepository.findBySupplierId(supplierId);
        Set<String> emails = new LinkedHashSet<>();

        contacts.stream()
                .filter(c -> Boolean.TRUE.equals(c.getIsPrimary()))
                .map(SupplierContact::getEmail)
                .filter(e -> e != null && !e.isBlank())
                .forEach(emails::add);

        contacts.stream()
                .map(SupplierContact::getEmail)
                .filter(e -> e != null && !e.isBlank())
                .forEach(emails::add);

        return emails;
    }

    private boolean sendEmailWithRetry(SupplierDocument document, String toEmail) {
        int maxAttempts = Math.max(1, mailRetryMaxAttempts);
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                sendEmail(document, toEmail);
                return true;
            } catch (Exception ex) {
                if (attempt == maxAttempts) {
                    log.error(
                            "Reminder email failed after {} attempts to={} supplierId={} documentId={}: {}",
                            maxAttempts,
                            toEmail,
                            document.getSupplier() != null ? document.getSupplier().getId() : null,
                            document.getId(),
                            ex.getMessage()
                    );
                    return false;
                }
                log.warn(
                        "Reminder email attempt {}/{} failed to={} documentId={}: {}",
                        attempt,
                        maxAttempts,
                        toEmail,
                        document.getId(),
                        ex.getMessage()
                );
                sleepBackoff();
            }
        }
        return false;
    }

    private void sendEmail(SupplierDocument document, String toEmail) throws Exception {
        try {
            MimeMessage message = javaMailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(toEmail);
            PreferredLanguage language = resolveLanguage(document);
            helper.setSubject(buildSubject(document, language));

            String company = document.getSupplier().getCompanyName();
            String expiryDate = document.getExpiryDate() != null ? document.getExpiryDate().toString() : "N/A";
            String body = buildBody(company, document.getDocumentType().name(), expiryDate, language);

            helper.setText(body, false);
            javaMailSender.send(message);
            log.info("Document expiry reminder sent to {} for supplier {}", toEmail, document.getSupplier().getId());
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to send reminder email to " + toEmail + ": " + ex.getMessage(), ex);
        }
    }

    private void sleepBackoff() {
        if (mailRetryBackoffMs <= 0) {
            return;
        }
        try {
            Thread.sleep(mailRetryBackoffMs);
        } catch (InterruptedException interruptedEx) {
            Thread.currentThread().interrupt();
        }
    }

    private PreferredLanguage resolveLanguage(SupplierDocument document) {
        if (document.getSupplier() == null || document.getSupplier().getPreferredLanguage() == null) {
            return PreferredLanguage.IT;
        }
        return document.getSupplier().getPreferredLanguage();
    }

    private String buildSubject(SupplierDocument document, PreferredLanguage language) {
        if (language == PreferredLanguage.EN) {
            return "Document expiry reminder - " + document.getDocumentType().name();
        }
        return "Promemoria scadenza documento - " + document.getDocumentType().name();
    }

    private String buildBody(String company, String documentType, String expiryDate, PreferredLanguage language) {
        if (language == PreferredLanguage.EN) {
            return """
                    Dear Supplier,

                    This is a reminder that your document is approaching expiry.

                    Company: %s
                    Document Type: %s
                    Expiry Date: %s

                    Please upload a renewed document in the Supplier Platform before expiry.

                    Regards,
                    Supplier Platform
                    """.formatted(company, documentType, expiryDate);
        }
        return """
                Gentile Fornitore,

                questo e un promemoria: uno dei suoi documenti e prossimo alla scadenza.

                Azienda: %s
                Tipo documento: %s
                Data di scadenza: %s

                Carichi un documento aggiornato sulla Supplier Platform prima della scadenza.

                Cordiali saluti,
                Supplier Platform
                """.formatted(company, documentType, expiryDate);
    }

    public record ReminderRunResult(
            int expiringDocuments,
            int remindersCreatedAndSent,
            int skipped,
            LocalDate windowStart,
            LocalDate windowEnd
    ) {
    }
}
