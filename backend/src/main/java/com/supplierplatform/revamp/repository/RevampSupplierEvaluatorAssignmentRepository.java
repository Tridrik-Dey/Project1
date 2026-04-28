package com.supplierplatform.revamp.repository;

import com.supplierplatform.revamp.model.RevampSupplierEvaluatorAssignment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RevampSupplierEvaluatorAssignmentRepository extends JpaRepository<RevampSupplierEvaluatorAssignment, UUID> {
    Optional<RevampSupplierEvaluatorAssignment> findBySupplierRegistryProfileIdAndActiveTrue(UUID supplierRegistryProfileId);
    List<RevampSupplierEvaluatorAssignment> findBySupplierRegistryProfileIdOrderByAssignedAtDesc(UUID supplierRegistryProfileId);
    List<RevampSupplierEvaluatorAssignment> findByAssignedEvaluatorUserIdAndActiveTrueOrderByAssignedAtDesc(UUID assignedEvaluatorUserId);
    boolean existsBySupplierRegistryProfileIdAndAssignedEvaluatorUserIdAndActiveTrue(UUID supplierRegistryProfileId, UUID assignedEvaluatorUserId);
}
