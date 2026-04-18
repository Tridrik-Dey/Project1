package com.supplierplatform.revamp.repository;

import com.supplierplatform.revamp.model.RevampEvaluationDimension;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RevampEvaluationDimensionRepository extends JpaRepository<RevampEvaluationDimension, UUID> {
    List<RevampEvaluationDimension> findByEvaluationId(UUID evaluationId);
    List<RevampEvaluationDimension> findByEvaluationIdIn(List<UUID> evaluationIds);
}
