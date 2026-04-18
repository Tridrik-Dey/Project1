package com.supplierplatform.revamp.api;

import com.supplierplatform.common.ApiResponse;
import com.supplierplatform.config.RevampAccessGuard;
import com.supplierplatform.revamp.api.dto.CreateApplicationDraftRequest;
import com.supplierplatform.revamp.api.dto.SaveApplicationSectionRequest;
import com.supplierplatform.revamp.dto.RevampApplicationSummaryDto;
import com.supplierplatform.revamp.dto.RevampSectionSnapshotDto;
import com.supplierplatform.revamp.service.RevampApplicationService;
import com.supplierplatform.user.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping({"/api/v2/applications", "/api/applications"})
@PreAuthorize("isAuthenticated()")
@RequiredArgsConstructor
public class RevampApplicationController {

    private final RevampApplicationService applicationService;
    private final RevampAccessGuard revampAccessGuard;

    @PostMapping
    public ResponseEntity<ApiResponse<RevampApplicationSummaryDto>> createDraft(
            @Valid @RequestBody CreateApplicationDraftRequest request
    ) {
        revampAccessGuard.requireWriteEnabled();
        User currentUser = getCurrentUser();
        RevampApplicationSummaryDto dto = applicationService.createDraft(
                currentUser.getId(),
                request.getRegistryType(),
                request.getSourceChannel(),
                request.getInviteId()
        );
        return ResponseEntity.ok(ApiResponse.ok("Draft created", dto));
    }

    @GetMapping("/{applicationId}")
    public ResponseEntity<ApiResponse<RevampApplicationSummaryDto>> getSummary(@PathVariable UUID applicationId) {
        revampAccessGuard.requireReadEnabled();
        return ResponseEntity.ok(ApiResponse.ok(applicationService.getSummary(applicationId)));
    }

    @GetMapping("/me/latest")
    public ResponseEntity<ApiResponse<RevampApplicationSummaryDto>> getMyLatest() {
        revampAccessGuard.requireReadEnabled();
        User currentUser = getCurrentUser();
        return ResponseEntity.ok(ApiResponse.ok(applicationService.getLatestForApplicant(currentUser.getId())));
    }

    @GetMapping("/{applicationId}/sections")
    public ResponseEntity<ApiResponse<List<RevampSectionSnapshotDto>>> getSections(@PathVariable UUID applicationId) {
        revampAccessGuard.requireReadEnabled();
        return ResponseEntity.ok(ApiResponse.ok(applicationService.getLatestSections(applicationId)));
    }

    @PutMapping("/{applicationId}/sections/{sectionKey}")
    public ResponseEntity<ApiResponse<RevampSectionSnapshotDto>> saveSection(
            @PathVariable UUID applicationId,
            @PathVariable String sectionKey,
            @RequestBody SaveApplicationSectionRequest request
    ) {
        revampAccessGuard.requireWriteEnabled();
        RevampSectionSnapshotDto dto = applicationService.saveLatestSection(
                applicationId,
                sectionKey,
                request.getPayloadJson(),
                Boolean.TRUE.equals(request.getCompleted())
        );
        return ResponseEntity.ok(ApiResponse.ok("Section saved", dto));
    }

    @PostMapping("/{applicationId}/submit")
    public ResponseEntity<ApiResponse<RevampApplicationSummaryDto>> submit(@PathVariable UUID applicationId) {
        revampAccessGuard.requireWriteEnabled();
        return ResponseEntity.ok(ApiResponse.ok("Application submitted", applicationService.submit(applicationId)));
    }

    private User getCurrentUser() {
        return (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }
}
