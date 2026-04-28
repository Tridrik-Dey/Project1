package com.supplierplatform.revamp.service;

import com.supplierplatform.revamp.enums.RegistryType;
import com.supplierplatform.revamp.model.RevampInvite;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;

@Service
@RequiredArgsConstructor
@Slf4j
public class RevampSupplierInviteMailService {

    private final JavaMailSender javaMailSender;

    @Value("${app.invites.mail.from:${app.reviews.status-mail.from:${spring.mail.username:no-reply@supplierplatform.local}}}")
    private String fromEmail;

    @Value("${app.frontend.base-url:http://127.0.0.1:5173}")
    private String frontendBaseUrl;

    public record InviteDispatchResult(boolean sent, String inviteUrl, String failureReason) {}

    public InviteDispatchResult sendInvite(RevampInvite invite) {
        String inviteUrl = buildInviteUrl(invite.getToken());
        String registryLabel = registryLabel(invite.getRegistryType());
        String displayName = invite.getInvitedName() == null || invite.getInvitedName().isBlank()
                ? "Fornitore"
                : invite.getInvitedName().trim();
        String customMessage = extractNoteValue(invite.getNote(), "Messaggio");
        String expectedType = extractNoteValue(invite.getNote(), "Tipologia attesa");

        StringBuilder body = new StringBuilder();
        body.append("Gentile ").append(displayName).append(",\n\n");
        body.append("sei stato invitato a completare l'iscrizione all'Albo Fornitori Digitale del Gruppo Solco.\n\n");
        body.append("Tipo iscrizione: ").append(registryLabel).append("\n");
        if (!expectedType.isBlank()) {
            body.append("Tipologia attesa: ").append(expectedType).append("\n");
        }
        body.append("Scadenza link: ").append(invite.getExpiresAt().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"))).append("\n\n");
        if (!customMessage.isBlank()) {
            body.append("Messaggio dall'amministrazione:\n");
            body.append(customMessage).append("\n\n");
        }
        body.append("Accedi al questionario da questo link:\n");
        body.append(inviteUrl).append("\n\n");
        body.append("Il link e personale e non va condiviso. Se non ti aspettavi questa email, ignora questo messaggio o contatta il Gruppo Solco.");

        try {
            var message = javaMailSender.createMimeMessage();
            var helper = new MimeMessageHelper(message, StandardCharsets.UTF_8.name());
            helper.setTo(invite.getInvitedEmail());
            helper.setFrom(fromEmail);
            helper.setSubject("Invito iscrizione Albo Fornitori Digitale");
            helper.setText(body.toString(), false);
            javaMailSender.send(message);
            return new InviteDispatchResult(true, inviteUrl, null);
        } catch (Exception ex) {
            log.error("Failed to send supplier invite email to {}", invite.getInvitedEmail(), ex);
            return new InviteDispatchResult(false, inviteUrl, ex.getClass().getSimpleName());
        }
    }

    public InviteDispatchResult sendExpiryReminder(RevampInvite invite, long daysRemaining) {
        String inviteUrl = buildInviteUrl(invite.getToken());
        String registryLabel = registryLabel(invite.getRegistryType());
        String displayName = invite.getInvitedName() == null || invite.getInvitedName().isBlank()
                ? "Fornitore"
                : invite.getInvitedName().trim();

        String remainingText = daysRemaining <= 1
                ? "domani"
                : "tra " + daysRemaining + " giorni";

        StringBuilder body = new StringBuilder();
        body.append("Gentile ").append(displayName).append(",\n\n");
        body.append("questo e un promemoria: il link per completare l'iscrizione all'Albo Fornitori Digitale scade ")
                .append(remainingText)
                .append(".\n\n");
        body.append("Tipo iscrizione: ").append(registryLabel).append("\n");
        body.append("Scadenza link: ").append(invite.getExpiresAt().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"))).append("\n\n");
        body.append("Puoi riprendere la compilazione da questo link:\n");
        body.append(inviteUrl).append("\n\n");
        body.append("Se hai gia completato l'iscrizione, puoi ignorare questo promemoria.");

        try {
            var message = javaMailSender.createMimeMessage();
            var helper = new MimeMessageHelper(message, StandardCharsets.UTF_8.name());
            helper.setTo(invite.getInvitedEmail());
            helper.setFrom(fromEmail);
            helper.setSubject("Promemoria scadenza invito Albo Fornitori Digitale");
            helper.setText(body.toString(), false);
            javaMailSender.send(message);
            return new InviteDispatchResult(true, inviteUrl, null);
        } catch (Exception ex) {
            log.error("Failed to send supplier invite expiry reminder to {}", invite.getInvitedEmail(), ex);
            return new InviteDispatchResult(false, inviteUrl, ex.getClass().getSimpleName());
        }
    }

    public InviteDispatchResult sendExpiredAdminNotification(RevampInvite invite) {
        String inviteUrl = buildInviteUrl(invite.getToken());
        if (invite.getSourceUser() == null || invite.getSourceUser().getEmail() == null || invite.getSourceUser().getEmail().isBlank()) {
            return new InviteDispatchResult(false, inviteUrl, "MissingSourceUserEmail");
        }
        String registryLabel = registryLabel(invite.getRegistryType());
        String supplierName = invite.getInvitedName() == null || invite.getInvitedName().isBlank()
                ? "Fornitore"
                : invite.getInvitedName().trim();

        StringBuilder body = new StringBuilder();
        body.append("Promemoria amministrativo\n\n");
        body.append("L'invito fornitore e scaduto.\n\n");
        body.append("Fornitore: ").append(supplierName).append("\n");
        body.append("Email: ").append(invite.getInvitedEmail()).append("\n");
        body.append("Tipo iscrizione: ").append(registryLabel).append("\n");
        body.append("Scadenza link: ").append(invite.getExpiresAt().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"))).append("\n\n");
        body.append("Se il fornitore deve ancora iscriversi, rinnova l'invito dall'area Inviti.");

        try {
            var message = javaMailSender.createMimeMessage();
            var helper = new MimeMessageHelper(message, StandardCharsets.UTF_8.name());
            helper.setTo(invite.getSourceUser().getEmail());
            helper.setFrom(fromEmail);
            helper.setSubject("Invito fornitore scaduto - Albo Fornitori Digitale");
            helper.setText(body.toString(), false);
            javaMailSender.send(message);
            return new InviteDispatchResult(true, inviteUrl, null);
        } catch (Exception ex) {
            log.error("Failed to send expired supplier invite admin notification to {}", invite.getSourceUser().getEmail(), ex);
            return new InviteDispatchResult(false, inviteUrl, ex.getClass().getSimpleName());
        }
    }

    public String buildInviteUrl(String inviteToken) {
        String normalizedBase = frontendBaseUrl == null ? "" : frontendBaseUrl.trim().replaceAll("/+$", "");
        return normalizedBase + "/invite/" + inviteToken;
    }

    private static String registryLabel(RegistryType registryType) {
        return registryType == RegistryType.ALBO_B ? "Albo B - Aziende" : "Albo A - Professionisti";
    }

    private static String extractNoteValue(String note, String key) {
        if (note == null || note.isBlank()) return "";
        String prefix = key + ":";
        String[] parts = note.split("\\|");
        for (String part : parts) {
            String trimmed = part.trim();
            if (trimmed.regionMatches(true, 0, prefix, 0, prefix.length())) {
                return trimmed.substring(prefix.length()).trim();
            }
        }
        return "";
    }
}
