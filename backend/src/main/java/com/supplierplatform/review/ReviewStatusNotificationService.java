package com.supplierplatform.review;

import com.supplierplatform.supplier.SupplierContactRepository;
import com.supplierplatform.supplier.entity.SupplierContact;
import com.supplierplatform.supplier.entity.SupplierProfile;
import com.supplierplatform.supplier.enums.PreferredLanguage;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReviewStatusNotificationService {

    private static final DateTimeFormatter TIMESTAMP_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final SupplierContactRepository supplierContactRepository;
    private final JavaMailSender javaMailSender;

    @Value("${app.reviews.status-mail.enabled:true}")
    private boolean mailEnabled;

    @Value("${app.reviews.status-mail.from:no-reply@supplierplatform.local}")
    private String fromEmail;

    @Value("${app.mail.retry.max-attempts:3}")
    private int mailRetryMaxAttempts;

    @Value("${app.mail.retry.backoff-ms:500}")
    private long mailRetryBackoffMs;

    public void notifySupplierContacts(ValidationReview review) {
        if (!mailEnabled) {
            log.info("Review status mail is disabled. Skipping notifications for review {}", review.getId());
            return;
        }
        if (review.getSupplier() == null || review.getSupplier().getId() == null) {
            log.warn("Cannot send review status notification: supplier is missing for review {}", review.getId());
            return;
        }

        SupplierProfile supplier = review.getSupplier();
        Set<String> recipients = collectRecipientEmails(supplier.getId(), supplier.getUser() != null ? supplier.getUser().getEmail() : null);
        if (recipients.isEmpty()) {
            log.warn("No recipient emails found for supplier {} review {}", supplier.getId(), review.getId());
            return;
        }

        for (String recipient : recipients) {
            if (sendEmailWithRetry(review, recipient)) {
                log.info("Review status notification sent to {} for supplier {} review {}", recipient, supplier.getId(), review.getId());
            }
        }
    }

    private Set<String> collectRecipientEmails(UUID supplierId, String fallbackUserEmail) {
        List<SupplierContact> contacts = supplierContactRepository.findBySupplierId(supplierId);
        Set<String> emails = new LinkedHashSet<>();

        contacts.stream()
                .filter(c -> Boolean.TRUE.equals(c.getIsPrimary()))
                .map(SupplierContact::getEmail)
                .map(this::normalizeEmail)
                .filter(this::isPresent)
                .forEach(emails::add);

        contacts.stream()
                .map(SupplierContact::getEmail)
                .map(this::normalizeEmail)
                .filter(this::isPresent)
                .forEach(emails::add);

        String normalizedFallback = normalizeEmail(fallbackUserEmail);
        if (isPresent(normalizedFallback)) {
            emails.add(normalizedFallback);
        }

        return emails;
    }

    private boolean sendEmailWithRetry(ValidationReview review, String toEmail) {
        int maxAttempts = Math.max(1, mailRetryMaxAttempts);
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                sendEmail(review, toEmail);
                return true;
            } catch (Exception ex) {
                if (attempt == maxAttempts) {
                    log.error(
                            "Review status mail failed after {} attempts to={} reviewId={}: {}",
                            maxAttempts,
                            toEmail,
                            review.getId(),
                            ex.getMessage(),
                            ex
                    );
                    return false;
                }
                log.warn(
                        "Review status mail attempt {}/{} failed to={} reviewId={}: {}",
                        attempt,
                        maxAttempts,
                        toEmail,
                        review.getId(),
                        ex.getMessage()
                );
                sleepBackoff();
            }
        }
        return false;
    }

    private void sendEmail(ValidationReview review, String toEmail) throws Exception {
        SupplierProfile supplier = review.getSupplier();
        String companyName = isPresent(supplier.getCompanyName()) ? supplier.getCompanyName() : "N/A";
        String comment = isPresent(review.getComment()) ? review.getComment() : "N/A";
        String action = review.getAction() != null ? review.getAction().name() : "N/A";
        String newStatus = review.getNewStatus() != null ? review.getNewStatus().name() : "N/A";
        String previousStatus = review.getPreviousStatus() != null ? review.getPreviousStatus().name() : "N/A";
        String reviewerName = review.getReviewer() != null && isPresent(review.getReviewer().getFullName())
                ? review.getReviewer().getFullName()
                : (review.getReviewer() != null ? review.getReviewer().getEmail() : "N/A");
        LocalDateTime reviewedAt = review.getCreatedAt();
        String reviewedAtText = reviewedAt != null ? reviewedAt.format(TIMESTAMP_FORMATTER) : LocalDateTime.now().format(TIMESTAMP_FORMATTER);
        PreferredLanguage language = resolveLanguage(supplier);

        MimeMessage message = javaMailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
        helper.setFrom(fromEmail);
        helper.setTo(toEmail);
        helper.setSubject(buildSubject(newStatus, language));

        String body = buildBody(companyName, action, previousStatus, newStatus, reviewerName, reviewedAtText, comment, language);

        helper.setText(body, false);
        javaMailSender.send(message);
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

    private PreferredLanguage resolveLanguage(SupplierProfile supplier) {
        if (supplier == null || supplier.getPreferredLanguage() == null) {
            return PreferredLanguage.IT;
        }
        return supplier.getPreferredLanguage();
    }

    private String buildSubject(String newStatus, PreferredLanguage language) {
        if (language == PreferredLanguage.EN) {
            return "Supplier profile review update - " + newStatus;
        }
        return "Aggiornamento revisione profilo fornitore - " + newStatus;
    }

    private String buildBody(
            String companyName,
            String action,
            String previousStatus,
            String newStatus,
            String reviewerName,
            String reviewedAtText,
            String comment,
            PreferredLanguage language
    ) {
        if (language == PreferredLanguage.EN) {
            return """
                    Dear Supplier,

                    Your supplier profile has been reviewed by our validation team.

                    Company: %s
                    Action Category: %s
                    Previous Status: %s
                    New Status: %s
                    Reviewer: %s
                    Review Date: %s
                    Comment: %s

                    Please access the Supplier Platform for details and next steps.

                    Regards,
                    Supplier Platform
                    """.formatted(
                    companyName,
                    action,
                    previousStatus,
                    newStatus,
                    reviewerName,
                    reviewedAtText,
                    comment
            );
        }
        return """
                Gentile Fornitore,

                il suo profilo fornitore e stato revisionato dal team di validazione.

                Azienda: %s
                Categoria azione: %s
                Stato precedente: %s
                Nuovo stato: %s
                Revisore: %s
                Data revisione: %s
                Commento: %s

                Acceda alla Supplier Platform per i dettagli e i prossimi passi.

                Cordiali saluti,
                Supplier Platform
                """.formatted(
                companyName,
                action,
                previousStatus,
                newStatus,
                reviewerName,
                reviewedAtText,
                comment
        );
    }

    private String normalizeEmail(String email) {
        return email == null ? null : email.trim();
    }

    private boolean isPresent(String value) {
        return value != null && !value.isBlank();
    }
}
