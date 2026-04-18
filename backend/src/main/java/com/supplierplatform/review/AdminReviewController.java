package com.supplierplatform.review;

import com.supplierplatform.common.ApiResponse;
import com.supplierplatform.common.EntityNotFoundException;
import com.supplierplatform.review.dto.AdminQueueNotificationResponse;
import com.supplierplatform.review.dto.ReviewRequest;
import com.supplierplatform.review.dto.ReviewResponse;
import com.supplierplatform.supplier.SupplierProfileRepository;
import com.supplierplatform.supplier.SupplierProfileService;
import com.supplierplatform.supplier.SupplierStatusService;
import com.supplierplatform.supplier.dto.SupplierProfileResponse;
import com.supplierplatform.supplier.entity.SupplierProfile;
import com.supplierplatform.supplier.enums.SupplierStatus;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/review")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminReviewController {

    private final SupplierProfileRepository supplierProfileRepository;
    private final SupplierProfileService supplierProfileService;
    private final SupplierStatusService supplierStatusService;
    private final ReviewService reviewService;
    private final UserRepository userRepository;

    @GetMapping("/queue")
    public ResponseEntity<ApiResponse<Page<SupplierProfileResponse>>> getReviewQueue(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Pageable pageable = PageRequest.of(page, size, Sort.by("submittedAt").descending());
        User currentUser = getCurrentUser();
        LocalDateTime lastSeenAt = currentUser.getAdminLastSeenPendingAt();
        Page<SupplierProfile> profiles = supplierProfileRepository.findByStatusIn(
                List.of(SupplierStatus.PENDING, SupplierStatus.NEEDS_REVISION), pageable);
        Page<SupplierProfileResponse> response = profiles.map(profile -> {
            SupplierProfileResponse dto = supplierProfileService.toResponse(profile);
            boolean isNewPending = profile.getStatus() == SupplierStatus.PENDING
                    && profile.getSubmittedAt() != null
                    && lastSeenAt != null
                    && profile.getSubmittedAt().isAfter(lastSeenAt);
            dto.setIsNew(isNewPending);
            return dto;
        });
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping("/queue/notifications")
    public ResponseEntity<ApiResponse<AdminQueueNotificationResponse>> getQueueNotifications() {
        User currentUser = getCurrentUser();
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime lastSeenAt = currentUser.getAdminLastSeenPendingAt();
        long newPendingCount = 0;

        if (lastSeenAt != null) {
            newPendingCount = supplierProfileRepository.countByStatusAndSubmittedAtAfter(SupplierStatus.PENDING, lastSeenAt);
        }

        AdminQueueNotificationResponse response = AdminQueueNotificationResponse.builder()
                .newPendingCount(newPendingCount)
                .lastSeenAt(lastSeenAt)
                .serverTime(now)
                .build();

        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @PostMapping("/queue/notifications/seen")
    public ResponseEntity<ApiResponse<AdminQueueNotificationResponse>> markQueueNotificationsSeen() {
        User currentUser = getCurrentUser();
        LocalDateTime now = LocalDateTime.now();
        currentUser.setAdminLastSeenPendingAt(now);
        userRepository.save(currentUser);

        AdminQueueNotificationResponse response = AdminQueueNotificationResponse.builder()
                .newPendingCount(0)
                .lastSeenAt(now)
                .serverTime(now)
                .build();

        return ResponseEntity.ok(ApiResponse.ok("Queue notifications marked as seen", response));
    }

    @GetMapping("/suppliers")
    public ResponseEntity<ApiResponse<Page<SupplierProfileResponse>>> getAllSuppliers(
            @RequestParam(required = false) SupplierStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<SupplierProfile> profiles;

        if (status != null) {
            profiles = supplierProfileRepository.findByStatusIn(List.of(status), pageable);
        } else {
            profiles = supplierProfileRepository.findAll(pageable);
        }

        Page<SupplierProfileResponse> response = profiles.map(supplierProfileService::toResponse);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping("/suppliers/{id}")
    public ResponseEntity<ApiResponse<SupplierProfileResponse>> getSupplierDetail(@PathVariable UUID id) {
        SupplierProfileResponse response = supplierProfileService.getProfileById(id);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @PostMapping("/suppliers/{id}/review")
    public ResponseEntity<ApiResponse<ReviewResponse>> submitReview(
            @PathVariable UUID id,
            @Valid @RequestBody ReviewRequest request) {
        User currentUser = getCurrentUser();
        ReviewResponse response = reviewService.submitReview(id, request, currentUser);
        return ResponseEntity.ok(ApiResponse.ok("Review submitted successfully", response));
    }

    @GetMapping("/suppliers/{id}/reviews")
    public ResponseEntity<ApiResponse<List<ReviewResponse>>> getReviewHistory(@PathVariable UUID id) {
        List<ReviewResponse> history = reviewService.getReviewHistory(id);
        return ResponseEntity.ok(ApiResponse.ok(history));
    }

    @PostMapping("/suppliers/{id}/activate")
    public ResponseEntity<ApiResponse<SupplierProfileResponse>> activateSupplier(@PathVariable UUID id) {
        User currentUser = getCurrentUser();
        SupplierProfile profile = supplierProfileRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("SupplierProfile", id));
        supplierStatusService.activate(profile, currentUser);
        SupplierProfileResponse response = supplierProfileService.getProfileById(id);
        return ResponseEntity.ok(ApiResponse.ok("Supplier activated successfully", response));
    }

    @PostMapping("/suppliers/{id}/deactivate")
    public ResponseEntity<ApiResponse<SupplierProfileResponse>> deactivateSupplier(@PathVariable UUID id) {
        User currentUser = getCurrentUser();
        SupplierProfile profile = supplierProfileRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("SupplierProfile", id));
        supplierStatusService.deactivate(profile, currentUser);
        SupplierProfileResponse response = supplierProfileService.getProfileById(id);
        return ResponseEntity.ok(ApiResponse.ok("Supplier deactivated successfully", response));
    }

    private User getCurrentUser() {
        return (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }
}


