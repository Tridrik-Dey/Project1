package com.supplierplatform.review;

import com.supplierplatform.common.EntityNotFoundException;
import com.supplierplatform.review.dto.ReviewRequest;
import com.supplierplatform.review.dto.ReviewResponse;
import com.supplierplatform.supplier.SupplierProfileRepository;
import com.supplierplatform.supplier.SupplierStatusService;
import com.supplierplatform.supplier.entity.SupplierProfile;
import com.supplierplatform.supplier.enums.SupplierStatus;
import com.supplierplatform.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReviewService {

    private final ValidationReviewRepository reviewRepository;
    private final SupplierProfileRepository supplierProfileRepository;
    private final SupplierStatusService supplierStatusService;
    private final ReviewStatusNotificationService reviewStatusNotificationService;

    @Transactional
    public ReviewResponse submitReview(UUID supplierId, ReviewRequest request, User reviewer) {
        log.info(
                "Submitting review supplierId={} reviewerId={} action={}",
                supplierId,
                reviewer != null ? reviewer.getId() : null,
                request != null ? request.getAction() : null
        );
        SupplierProfile supplier = supplierProfileRepository.findById(supplierId)
                .orElseThrow(() -> new EntityNotFoundException("SupplierProfile", supplierId));

        SupplierStatus previousStatus = supplier.getStatus();

        switch (request.getAction()) {
            case APPROVED -> supplierStatusService.approve(supplier, reviewer);
            case REJECTED -> supplierStatusService.reject(supplier, reviewer, request.getComment());
            case REVISION_REQUESTED -> supplierStatusService.requestRevision(supplier, reviewer, request.getComment());
            default -> throw new IllegalStateException("Unhandled review action: " + request.getAction());
        }

        supplier.setLastReviewedAt(LocalDateTime.now());
        supplier.setReviewer(reviewer);
        supplierProfileRepository.save(supplier);

        ValidationReview review = ValidationReview.builder()
                .supplier(supplier)
                .reviewer(reviewer)
                .action(request.getAction())
                .comment(request.getComment())
                .internalNote(request.getInternalNote())
                .previousStatus(previousStatus)
                .newStatus(supplier.getStatus())
                .build();

        ValidationReview saved = reviewRepository.save(review);
        reviewStatusNotificationService.notifySupplierContacts(saved);
        log.info(
                "Review submitted reviewId={} supplierId={} previousStatus={} newStatus={}",
                saved.getId(),
                supplierId,
                previousStatus,
                supplier.getStatus()
        );
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<ReviewResponse> getReviewHistory(UUID supplierId) {
        return reviewRepository.findBySupplierIdOrderByCreatedAtDesc(supplierId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    private ReviewResponse toResponse(ValidationReview review) {
        String reviewerName = review.getReviewer() != null ? review.getReviewer().getFullName() : null;

        return ReviewResponse.builder()
                .id(review.getId())
                .action(review.getAction())
                .comment(review.getComment())
                .previousStatus(review.getPreviousStatus())
                .newStatus(review.getNewStatus())
                .reviewerName(reviewerName)
                .createdAt(review.getCreatedAt())
                .build();
    }
}
