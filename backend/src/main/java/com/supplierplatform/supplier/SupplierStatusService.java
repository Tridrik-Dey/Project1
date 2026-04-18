package com.supplierplatform.supplier;

import com.supplierplatform.status.StatusHistory;
import com.supplierplatform.status.StatusHistoryRepository;
import com.supplierplatform.supplier.entity.SupplierProfile;
import com.supplierplatform.supplier.enums.SupplierStatus;
import com.supplierplatform.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class SupplierStatusService {

    private final SupplierProfileRepository supplierProfileRepository;
    private final StatusHistoryRepository statusHistoryRepository;

    @Transactional
    public void submit(SupplierProfile profile, User actor) {
        SupplierStatus current = profile.getStatus();
        if (current != SupplierStatus.DRAFT && current != SupplierStatus.NEEDS_REVISION) {
            throw new IllegalStateException(
                    "Cannot submit profile from status: " + current + ". Must be DRAFT or NEEDS_REVISION.");
        }
        SupplierStatus previous = current;
        profile.setStatus(SupplierStatus.PENDING);
        profile.setSubmittedAt(LocalDateTime.now());
        supplierProfileRepository.save(profile);
        saveStatusHistory(profile, previous, SupplierStatus.PENDING, actor, null);
    }

    @Transactional
    public void approve(SupplierProfile profile, User actor) {
        if (profile.getStatus() != SupplierStatus.PENDING) {
            throw new IllegalStateException(
                    "Cannot approve profile from status: " + profile.getStatus() + ". Must be PENDING.");
        }
        SupplierStatus previous = profile.getStatus();
        profile.setStatus(SupplierStatus.APPROVED);
        profile.setReviewer(actor);
        profile.setLastReviewedAt(LocalDateTime.now());
        supplierProfileRepository.save(profile);
        saveStatusHistory(profile, previous, SupplierStatus.APPROVED, actor, null);
    }

    @Transactional
    public void reject(SupplierProfile profile, User actor, String reason) {
        if (profile.getStatus() != SupplierStatus.PENDING) {
            throw new IllegalStateException(
                    "Cannot reject profile from status: " + profile.getStatus() + ". Must be PENDING.");
        }
        SupplierStatus previous = profile.getStatus();
        profile.setStatus(SupplierStatus.REJECTED);
        profile.setRejectionReason(reason);
        profile.setReviewer(actor);
        profile.setLastReviewedAt(LocalDateTime.now());
        supplierProfileRepository.save(profile);
        saveStatusHistory(profile, previous, SupplierStatus.REJECTED, actor, reason);
    }

    @Transactional
    public void requestRevision(SupplierProfile profile, User actor, String notes) {
        if (profile.getStatus() != SupplierStatus.PENDING) {
            throw new IllegalStateException(
                    "Cannot request revision from status: " + profile.getStatus() + ". Must be PENDING.");
        }
        SupplierStatus previous = profile.getStatus();
        profile.setStatus(SupplierStatus.NEEDS_REVISION);
        profile.setRevisionNotes(notes);
        profile.setReviewer(actor);
        profile.setLastReviewedAt(LocalDateTime.now());
        supplierProfileRepository.save(profile);
        saveStatusHistory(profile, previous, SupplierStatus.NEEDS_REVISION, actor, notes);
    }

    @Transactional
    public void activate(SupplierProfile profile, User actor) {
        if (profile.getStatus() != SupplierStatus.APPROVED) {
            throw new IllegalStateException(
                    "Cannot activate profile from status: " + profile.getStatus() + ". Must be APPROVED.");
        }
        SupplierStatus previous = profile.getStatus();
        profile.setStatus(SupplierStatus.ACTIVE);
        supplierProfileRepository.save(profile);
        saveStatusHistory(profile, previous, SupplierStatus.ACTIVE, actor, null);
    }

    @Transactional
    public void deactivate(SupplierProfile profile, User actor) {
        if (profile.getStatus() != SupplierStatus.ACTIVE) {
            throw new IllegalStateException(
                    "Cannot deactivate profile from status: " + profile.getStatus() + ". Must be ACTIVE.");
        }
        SupplierStatus previous = profile.getStatus();
        profile.setStatus(SupplierStatus.INACTIVE);
        supplierProfileRepository.save(profile);
        saveStatusHistory(profile, previous, SupplierStatus.INACTIVE, actor, null);
    }

    @Transactional
    public void triggerCriticalEditReview(SupplierProfile profile, User actor) {
        SupplierStatus current = profile.getStatus();
        if (current != SupplierStatus.ACTIVE && current != SupplierStatus.APPROVED) {
            throw new IllegalStateException(
                    "Critical edit re-review can only be triggered from ACTIVE or APPROVED status. Current status: " + current);
        }
        SupplierStatus previous = current;
        profile.setStatus(SupplierStatus.PENDING);
        profile.setIsCriticalEditPending(true);
        supplierProfileRepository.save(profile);
        saveStatusHistory(profile, previous, SupplierStatus.PENDING, actor, "Critical field edited — re-review required.");
    }

    private void saveStatusHistory(SupplierProfile profile, SupplierStatus from, SupplierStatus to, User changedBy, String reason) {
        StatusHistory history = StatusHistory.builder()
                .supplier(profile)
                .fromStatus(from)
                .toStatus(to)
                .changedBy(changedBy)
                .reason(reason)
                .build();
        statusHistoryRepository.save(history);
    }
}
