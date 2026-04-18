package com.supplierplatform.notification;

import com.supplierplatform.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reminders")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class ReminderController {

    private final DocumentExpiryReminderService documentExpiryReminderService;

    @PostMapping("/run-document-expiry")
    public ResponseEntity<ApiResponse<DocumentExpiryReminderService.ReminderRunResult>> runDocumentExpiryReminderNow() {
        DocumentExpiryReminderService.ReminderRunResult result = documentExpiryReminderService.processExpiringDocuments();
        return ResponseEntity.ok(ApiResponse.ok("Document expiry reminder run completed", result));
    }
}


