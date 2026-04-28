package com.supplierplatform.revamp.model;

import com.supplierplatform.revamp.schema.RevampTableNames;
import com.supplierplatform.revamp.enums.EvaluationAssignmentStatus;
import com.fasterxml.jackson.databind.JsonNode;
import com.supplierplatform.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = RevampTableNames.SUPPLIER_EVALUATOR_ASSIGNMENTS)
@EntityListeners(AuditingEntityListener.class)
public class RevampSupplierEvaluatorAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_registry_profile_id", nullable = false)
    private RevampSupplierRegistryProfile supplierRegistryProfile;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_evaluator_user_id", nullable = false)
    private User assignedEvaluatorUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_by_user_id", nullable = false)
    private User assignedByUser;

    @Column(name = "reason", columnDefinition = "TEXT")
    private String reason;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 40)
    private EvaluationAssignmentStatus status = EvaluationAssignmentStatus.ASSEGNATA;

    @Column(name = "due_at")
    private LocalDateTime dueAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reassigned_from_user_id")
    private User reassignedFromUser;

    @Column(name = "reassignment_reason", columnDefinition = "TEXT")
    private String reassignmentReason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "completed_evaluation_id")
    private RevampEvaluation completedEvaluation;

    @Column(name = "draft_overall_score")
    private Short draftOverallScore;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "draft_dimension_scores_json", columnDefinition = "jsonb")
    private JsonNode draftDimensionScoresJson;

    @Column(name = "draft_collaboration_type")
    private String draftCollaborationType;

    @Column(name = "draft_collaboration_period")
    private String draftCollaborationPeriod;

    @Column(name = "draft_reference_code")
    private String draftReferenceCode;

    @Column(name = "draft_comment", columnDefinition = "TEXT")
    private String draftComment;

    @Column(name = "active", nullable = false)
    private Boolean active = true;

    @CreatedDate
    @Column(name = "assigned_at", nullable = false, updatable = false)
    private LocalDateTime assignedAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
