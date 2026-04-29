package com.supplierplatform.revamp.service;

import com.supplierplatform.common.EntityNotFoundException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.supplierplatform.revamp.dto.RevampAuditEventInputDto;
import com.supplierplatform.revamp.dto.RevampEvaluationAggregateDto;
import com.supplierplatform.revamp.dto.RevampEvaluationAnalyticsDto;
import com.supplierplatform.revamp.dto.RevampEvaluationHistoryItemDto;
import com.supplierplatform.revamp.dto.RevampEvaluationOverviewDto;
import com.supplierplatform.revamp.dto.RevampEvaluationOverviewRowDto;
import com.supplierplatform.revamp.dto.RevampEvaluationSummaryDto;
import com.supplierplatform.revamp.enums.RegistryProfileStatus;
import com.supplierplatform.revamp.mapper.RevampEvaluationMapper;
import com.supplierplatform.revamp.model.RevampEvaluation;
import com.supplierplatform.revamp.model.RevampEvaluationDimension;
import com.supplierplatform.revamp.model.RevampSupplierEvaluatorAssignment;
import com.supplierplatform.revamp.model.RevampSupplierRegistryProfile;
import com.supplierplatform.revamp.repository.RevampEvaluationDimensionRepository;
import com.supplierplatform.revamp.repository.RevampEvaluationRepository;
import com.supplierplatform.revamp.repository.RevampSupplierRegistryProfileRepository;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RevampEvaluationService {

    private final RevampEvaluationRepository evaluationRepository;
    private final RevampEvaluationDimensionRepository evaluationDimensionRepository;
    private final RevampSupplierRegistryProfileRepository supplierRegistryProfileRepository;
    private final UserRepository userRepository;
    private final RevampEvaluationMapper evaluationMapper;
    private final RevampEvaluationAssignmentService evaluationAssignmentService;
    private final RevampAuditService auditService;
    private final ObjectMapper objectMapper;

    @Transactional
    public RevampEvaluationSummaryDto submitEvaluation(
            UUID supplierRegistryProfileId,
            UUID evaluatorUserId,
            String collaborationType,
            String collaborationPeriod,
            String referenceCode,
            short overallScore,
            String comment,
            Map<String, Short> dimensions
    ) {
        evaluationAssignmentService.requireAssignedEvaluator(supplierRegistryProfileId, evaluatorUserId);
        RevampEvaluationSummaryDto summary = createEvaluation(
                supplierRegistryProfileId,
                evaluatorUserId,
                collaborationType,
                collaborationPeriod,
                referenceCode,
                overallScore,
                comment,
                dimensions
        );
        RevampEvaluation saved = evaluationRepository.findById(summary.id())
                .orElseThrow(() -> new EntityNotFoundException("RevampEvaluation", summary.id()));
        evaluationAssignmentService.markCompleted(supplierRegistryProfileId, evaluatorUserId, saved);
        appendEvaluationAudit("revamp.evaluation.completed", saved, evaluatorUserId, null);
        return summary;
    }

    @Transactional
    public RevampEvaluationSummaryDto submitAssignment(UUID assignmentId, UUID actorUserId) {
        RevampSupplierEvaluatorAssignment assignment = evaluationAssignmentService.getAssignmentForSubmit(assignmentId, actorUserId);
        UUID supplierId = assignment.getSupplierRegistryProfile() != null ? assignment.getSupplierRegistryProfile().getId() : null;
        UUID evaluatorId = assignment.getAssignedEvaluatorUser() != null ? assignment.getAssignedEvaluatorUser().getId() : null;
        if (supplierId == null || evaluatorId == null) {
            throw new IllegalStateException("Assignment is missing supplier or evaluator");
        }
        if (assignment.getDraftOverallScore() == null || assignment.getDraftOverallScore() < 1 || assignment.getDraftOverallScore() > 5) {
            throw new IllegalStateException("Overall score is required before submitting");
        }
        if (assignment.getDraftCollaborationType() == null || assignment.getDraftCollaborationType().isBlank()
                || assignment.getDraftCollaborationPeriod() == null || assignment.getDraftCollaborationPeriod().isBlank()) {
            throw new IllegalStateException("Collaboration type and period are required before submitting");
        }

        RevampEvaluationSummaryDto summary = createEvaluation(
                supplierId,
                evaluatorId,
                assignment.getDraftCollaborationType(),
                assignment.getDraftCollaborationPeriod(),
                assignment.getDraftReferenceCode(),
                assignment.getDraftOverallScore(),
                assignment.getDraftComment(),
                draftDimensions(assignment)
        );
        RevampEvaluation saved = evaluationRepository.findById(summary.id())
                .orElseThrow(() -> new EntityNotFoundException("RevampEvaluation", summary.id()));
        evaluationAssignmentService.markCompleted(supplierId, evaluatorId, saved);
        appendEvaluationAudit("revamp.evaluation.completed", saved, actorUserId, assignmentId);
        return summary;
    }

    private RevampEvaluationSummaryDto createEvaluation(
            UUID supplierRegistryProfileId,
            UUID evaluatorUserId,
            String collaborationType,
            String collaborationPeriod,
            String referenceCode,
            short overallScore,
            String comment,
            Map<String, Short> dimensions
    ) {
        if (evaluationRepository.findBySupplierRegistryProfileIdAndEvaluatorUserIdAndCollaborationPeriod(
                supplierRegistryProfileId,
                evaluatorUserId,
                collaborationPeriod
        ).isPresent()) {
            throw new IllegalStateException("An evaluation already exists for this supplier/evaluator/period");
        }

        RevampSupplierRegistryProfile profile = supplierRegistryProfileRepository.findById(supplierRegistryProfileId)
                .orElseThrow(() -> new EntityNotFoundException("RevampSupplierRegistryProfile", supplierRegistryProfileId));
        User evaluator = userRepository.findById(evaluatorUserId)
                .orElseThrow(() -> new EntityNotFoundException("User", evaluatorUserId));

        RevampEvaluation evaluation = new RevampEvaluation();
        evaluation.setSupplierRegistryProfile(profile);
        evaluation.setEvaluatorUser(evaluator);
        evaluation.setCollaborationType(collaborationType);
        evaluation.setCollaborationPeriod(collaborationPeriod);
        evaluation.setReferenceCode(referenceCode);
        evaluation.setOverallScore(overallScore);
        evaluation.setComment(comment);
        evaluation.setIsAnnulled(false);

        RevampEvaluation saved = evaluationRepository.save(evaluation);

        if (dimensions != null && !dimensions.isEmpty()) {
            for (Map.Entry<String, Short> entry : dimensions.entrySet()) {
                if (entry.getValue() == null || entry.getValue() < 1 || entry.getValue() > 5) {
                    throw new IllegalArgumentException("Dimension scores must be between 1 and 5");
                }
                RevampEvaluationDimension dimension = new RevampEvaluationDimension();
                dimension.setEvaluation(saved);
                dimension.setDimensionKey(entry.getKey());
                dimension.setScore(entry.getValue());
                evaluationDimensionRepository.save(dimension);
            }
        }

        return evaluationMapper.toSummary(saved);
    }

    @Transactional
    public RevampEvaluationSummaryDto annul(UUID evaluationId, UUID actorUserId) {
        RevampEvaluation evaluation = evaluationRepository.findById(evaluationId)
                .orElseThrow(() -> new EntityNotFoundException("RevampEvaluation", evaluationId));
        User actor = userRepository.findById(actorUserId)
                .orElseThrow(() -> new EntityNotFoundException("User", actorUserId));

        evaluation.setIsAnnulled(true);
        evaluation.setAnnulledByUser(actor);
        evaluation.setAnnulledAt(LocalDateTime.now());
        RevampEvaluation saved = evaluationRepository.save(evaluation);
        appendEvaluationAudit("revamp.evaluation.edited", saved, actorUserId, null);
        return evaluationMapper.toSummary(saved);
    }

    @Transactional(readOnly = true)
    public List<RevampEvaluationSummaryDto> listBySupplier(UUID supplierRegistryProfileId) {
        return evaluationRepository.findBySupplierRegistryProfileIdOrderByCreatedAtDesc(supplierRegistryProfileId).stream()
                .map(evaluationMapper::toSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public RevampEvaluationAggregateDto getAggregateForSupplierUser(UUID supplierUserId) {
        List<RevampSupplierRegistryProfile> profiles = supplierRegistryProfileRepository.findBySupplierUserId(supplierUserId);
        if (profiles.isEmpty()) {
            return new RevampEvaluationAggregateDto(null, 0, 0, 0.0);
        }
        // use the most recently created profile
        RevampSupplierRegistryProfile profile = profiles.stream()
                .max(Comparator.comparing(p -> p.getCreatedAt() != null ? p.getCreatedAt() : java.time.LocalDateTime.MIN))
                .get();

        List<RevampEvaluation> evals = evaluationRepository
                .findBySupplierRegistryProfileIdOrderByCreatedAtDesc(profile.getId());

        List<RevampEvaluation> activeEvaluations = evals.stream()
                .filter(e -> !Boolean.TRUE.equals(e.getIsAnnulled()))
                .toList();
        long active = activeEvaluations.size();
        double avg = activeEvaluations.stream()
                .mapToInt(e -> e.getOverallScore() != null ? e.getOverallScore() : 0)
                .average()
                .orElse(0.0);
        Map<Integer, Long> scoreDistribution = scoreDistribution(activeEvaluations);

        return new RevampEvaluationAggregateDto(profile.getId(), evals.size(), active, avg, scoreDistribution);
    }

    @Transactional(readOnly = true)
    public RevampEvaluationAggregateDto summaryBySupplier(UUID supplierRegistryProfileId) {
        List<RevampEvaluationSummaryDto> rows = listBySupplier(supplierRegistryProfileId);
        long total = rows.size();
        List<RevampEvaluationSummaryDto> activeRows = rows.stream()
                .filter(row -> !row.annulled())
                .toList();
        long active = activeRows.size();
        double average = activeRows.stream()
                .mapToInt(RevampEvaluationSummaryDto::overallScore)
                .average()
                .orElse(0.0);
        Map<Integer, Long> scoreDistribution = scoreDistributionFromSummaries(activeRows);

        return new RevampEvaluationAggregateDto(
                supplierRegistryProfileId,
                total,
                active,
                Math.round(average * 100.0) / 100.0,
                scoreDistribution
        );
    }

    private Map<Integer, Long> scoreDistribution(List<RevampEvaluation> evaluations) {
        Map<Integer, Long> distribution = new java.util.LinkedHashMap<>();
        for (int score = 1; score <= 5; score++) {
            final int currentScore = score;
            long count = evaluations.stream()
                    .filter(e -> e.getOverallScore() != null && e.getOverallScore() == currentScore)
                    .count();
            distribution.put(score, count);
        }
        return distribution;
    }

    private Map<Integer, Long> scoreDistributionFromSummaries(List<RevampEvaluationSummaryDto> evaluations) {
        Map<Integer, Long> distribution = new java.util.LinkedHashMap<>();
        for (int score = 1; score <= 5; score++) {
            final int currentScore = score;
            long count = evaluations.stream()
                    .filter(e -> e.overallScore() == currentScore)
                    .count();
            distribution.put(score, count);
        }
        return distribution;
    }

    @Transactional(readOnly = true)
    public RevampEvaluationOverviewDto overview(
            String query,
            String type,
            String period,
            Double minScore,
            String evaluator,
            int limit
    ) {
        List<RevampEvaluation> all = evaluationRepository.findAllByOrderByCreatedAtDesc().stream()
                .filter(e -> !Boolean.TRUE.equals(e.getIsAnnulled()))
                .toList();

        Map<UUID, List<RevampEvaluationDimension>> dimensionsByEvaluationId = loadDimensions(all);
        List<RevampEvaluationOverviewRowDto> evaluationRows = all.stream()
                .map(e -> toOverviewRow(e, dimensionsByEvaluationId.getOrDefault(e.getId(), List.of())))
                .toList();
        Map<UUID, Boolean> hasEvaluationBySupplierId = evaluationRows.stream()
                .filter(row -> row.supplierRegistryProfileId() != null)
                .collect(Collectors.toMap(
                        RevampEvaluationOverviewRowDto::supplierRegistryProfileId,
                        ignored -> true,
                        (a, b) -> true
                ));
        List<RevampEvaluationOverviewRowDto> supplierRows = supplierRegistryProfileRepository.findByStatus(RegistryProfileStatus.APPROVED).stream()
                .filter(profile -> profile.getId() != null && !hasEvaluationBySupplierId.containsKey(profile.getId()))
                .map(this::toUnevaluatedOverviewRow)
                .toList();
        List<RevampEvaluationOverviewRowDto> rows = java.util.stream.Stream.concat(evaluationRows.stream(), supplierRows.stream())
                .filter(row -> filterRow(row, query, type, period, minScore, evaluator))
                .sorted(Comparator.comparing(RevampEvaluationOverviewRowDto::createdAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(Math.max(1, Math.min(500, limit)))
                .toList();

        LocalDate firstDayOfMonth = LocalDate.now().withDayOfMonth(1);
        long currentMonthEvaluations = all.stream()
                .filter(e -> e.getCreatedAt() != null && !e.getCreatedAt().toLocalDate().isBefore(firstDayOfMonth))
                .count();
        long evaluatedSuppliers = all.stream()
                .map(e -> e.getSupplierRegistryProfile() != null ? e.getSupplierRegistryProfile().getId() : null)
                .filter(Objects::nonNull)
                .distinct()
                .count();
        double average = all.stream()
                .mapToDouble(e -> e.getOverallScore() != null ? e.getOverallScore() : 0.0)
                .average()
                .orElse(0.0);

        return new RevampEvaluationOverviewDto(
                all.size(),
                Math.round(average * 100.0) / 100.0,
                currentMonthEvaluations,
                evaluatedSuppliers,
                rows
        );
    }

    @Transactional(readOnly = true)
    public RevampEvaluationAnalyticsDto analyticsBySupplier(UUID supplierRegistryProfileId) {
        RevampSupplierRegistryProfile supplier = supplierRegistryProfileRepository.findById(supplierRegistryProfileId)
                .orElseThrow(() -> new EntityNotFoundException("RevampSupplierRegistryProfile", supplierRegistryProfileId));

        List<RevampEvaluation> evaluations = evaluationRepository.findBySupplierRegistryProfileIdOrderByCreatedAtDesc(supplierRegistryProfileId).stream()
                .filter(e -> !Boolean.TRUE.equals(e.getIsAnnulled()))
                .toList();

        Map<UUID, List<RevampEvaluationDimension>> dimensionsByEvaluationId = loadDimensions(evaluations);
        List<RevampEvaluationHistoryItemDto> history = new ArrayList<>();
        Map<String, List<Double>> dimensionScoreAccumulator = new java.util.LinkedHashMap<>();
        Map<Integer, Long> distribution = new java.util.LinkedHashMap<>();
        for (int score = 5; score >= 1; score -= 1) {
            distribution.put(score, 0L);
        }

        for (RevampEvaluation evaluation : evaluations) {
            List<RevampEvaluationDimension> dimensions = dimensionsByEvaluationId.getOrDefault(evaluation.getId(), List.of());
            Map<String, Double> dimensionScores = dimensions.stream()
                    .collect(Collectors.toMap(
                            d -> normalizeDimensionKey(d.getDimensionKey()),
                            d -> round2(d.getScore() != null ? d.getScore() : 0.0),
                            (a, b) -> b,
                            java.util.LinkedHashMap::new
                    ));

            dimensionScores.forEach((key, value) -> dimensionScoreAccumulator.computeIfAbsent(key, ignored -> new ArrayList<>()).add(value));

            int scoreBucket = evaluation.getOverallScore() != null ? evaluation.getOverallScore() : 0;
            if (distribution.containsKey(scoreBucket)) {
                distribution.put(scoreBucket, distribution.get(scoreBucket) + 1);
            }

            history.add(new RevampEvaluationHistoryItemDto(
                    evaluation.getId(),
                    evaluation.getCreatedAt(),
                    evaluation.getCollaborationType(),
                    evaluation.getCollaborationPeriod(),
                    evaluation.getReferenceCode(),
                    evaluation.getComment(),
                    round2(calculateAverageScore(evaluation, dimensions)),
                    dimensionScores,
                    anonymizeEvaluator(evaluation.getEvaluatorUser() != null ? evaluation.getEvaluatorUser().getFullName() : null)
            ));
        }

        Map<String, Double> dimensionAverages = dimensionScoreAccumulator.entrySet().stream()
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        e -> round2(e.getValue().stream().mapToDouble(Double::doubleValue).average().orElse(0.0)),
                        (a, b) -> b,
                        java.util.LinkedHashMap::new
                ));

        double overallAverage = evaluations.stream()
                .mapToDouble(e -> e.getOverallScore() != null ? e.getOverallScore() : 0.0)
                .average()
                .orElse(0.0);

        return new RevampEvaluationAnalyticsDto(
                supplierRegistryProfileId,
                supplier.getDisplayName(),
                supplier.getRegistryType() != null ? supplier.getRegistryType().name() : null,
                evaluations.size(),
                round2(overallAverage),
                dimensionAverages,
                distribution,
                history
        );
    }

    private Map<UUID, List<RevampEvaluationDimension>> loadDimensions(List<RevampEvaluation> evaluations) {
        List<UUID> evaluationIds = evaluations.stream().map(RevampEvaluation::getId).filter(Objects::nonNull).toList();
        if (evaluationIds.isEmpty()) {
            return Map.of();
        }
        return evaluationDimensionRepository.findByEvaluationIdIn(evaluationIds).stream()
                .filter(d -> d.getEvaluation() != null && d.getEvaluation().getId() != null)
                .collect(Collectors.groupingBy(
                        d -> d.getEvaluation().getId(),
                        Collectors.mapping(Function.identity(), Collectors.toList())
                ));
    }

    private RevampEvaluationOverviewRowDto toOverviewRow(RevampEvaluation evaluation, List<RevampEvaluationDimension> dimensions) {
        Map<String, Double> dimensionScores = dimensions.stream()
                .collect(Collectors.toMap(
                        d -> normalizeDimensionKey(d.getDimensionKey()),
                        d -> round2(d.getScore() != null ? d.getScore() : 0.0),
                        (a, b) -> b,
                        java.util.LinkedHashMap::new
                ));

        String supplierType = evaluation.getSupplierRegistryProfile() != null && evaluation.getSupplierRegistryProfile().getRegistryType() != null
                ? evaluation.getSupplierRegistryProfile().getRegistryType().name()
                : null;
        String evaluatorDisplay = evaluation.getEvaluatorUser() != null ? evaluation.getEvaluatorUser().getFullName() : null;

        return new RevampEvaluationOverviewRowDto(
                evaluation.getId(),
                evaluation.getSupplierRegistryProfile() != null ? evaluation.getSupplierRegistryProfile().getId() : null,
                evaluation.getSupplierRegistryProfile() != null ? evaluation.getSupplierRegistryProfile().getDisplayName() : null,
                supplierType,
                evaluation.getCreatedAt(),
                evaluation.getCollaborationType(),
                evaluation.getCollaborationPeriod(),
                evaluation.getReferenceCode(),
                evaluation.getComment(),
                evaluatorDisplay,
                round2(calculateAverageScore(evaluation, dimensions)),
                dimensionScores
        );
    }

    private RevampEvaluationOverviewRowDto toUnevaluatedOverviewRow(RevampSupplierRegistryProfile profile) {
        return new RevampEvaluationOverviewRowDto(
                null,
                profile.getId(),
                profile.getDisplayName() != null ? profile.getDisplayName() : (profile.getSupplierUser() != null ? profile.getSupplierUser().getFullName() : null),
                profile.getRegistryType() != null ? profile.getRegistryType().name() : null,
                profile.getUpdatedAt() != null ? profile.getUpdatedAt() : profile.getCreatedAt(),
                null,
                null,
                null,
                null,
                null,
                0.0,
                Map.of()
        );
    }

    private boolean filterRow(
            RevampEvaluationOverviewRowDto row,
            String query,
            String type,
            String period,
            Double minScore,
            String evaluator
    ) {
        if (query != null && !query.isBlank()) {
            String q = query.toLowerCase(Locale.ROOT).trim();
            String haystack = String.join(" ",
                    row.supplierName() != null ? row.supplierName() : "",
                    row.comment() != null ? row.comment() : "",
                    row.referenceCode() != null ? row.referenceCode() : ""
            ).toLowerCase(Locale.ROOT);
            if (!haystack.contains(q)) {
                return false;
            }
        }

        if (type != null && !type.isBlank() && !"ALL".equalsIgnoreCase(type)) {
            String normalized = type.toUpperCase(Locale.ROOT);
            if (!normalized.equalsIgnoreCase(row.supplierType())) {
                return false;
            }
        }

        if (period != null && !period.isBlank()) {
            if (row.collaborationPeriod() == null || !row.collaborationPeriod().toLowerCase(Locale.ROOT).contains(period.toLowerCase(Locale.ROOT))) {
                return false;
            }
        }

        if (minScore != null && row.averageScore() < minScore) {
            return false;
        }

        if (evaluator != null && !evaluator.isBlank() && !"ALL".equalsIgnoreCase(evaluator)) {
            String normalized = evaluator.toLowerCase(Locale.ROOT);
            String display = row.evaluatorDisplay() != null ? row.evaluatorDisplay().toLowerCase(Locale.ROOT) : "";
            if (!display.contains(normalized)) {
                return false;
            }
        }

        return true;
    }

    private double calculateAverageScore(RevampEvaluation evaluation, List<RevampEvaluationDimension> dimensions) {
        if (dimensions == null || dimensions.isEmpty()) {
            return evaluation.getOverallScore() != null ? evaluation.getOverallScore() : 0.0;
        }
        return dimensions.stream()
                .mapToDouble(d -> d.getScore() != null ? d.getScore() : 0.0)
                .average()
                .orElse(evaluation.getOverallScore() != null ? evaluation.getOverallScore() : 0.0);
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private String normalizeDimensionKey(String key) {
        if (key == null || key.isBlank()) return "Altro";
        String normalized = key.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "quality", "qualita", "qualita_tecnica", "technical_quality" -> "Qualita tecnica";
            case "timeliness", "rispetto_tempi", "delivery_time", "tempi" -> "Rispetto tempi";
            case "communication", "comunicazione" -> "Comunicazione";
            case "flexibility", "flessibilita", "problem_solving" -> "Flessibilita";
            case "value", "qualita_prezzo", "price_quality" -> "Qualita/Prezzo";
            default -> key;
        };
    }

    private String anonymizeEvaluator(String fullName) {
        if (fullName == null || fullName.isBlank()) {
            return "Valutatore anonimo";
        }
        String[] parts = fullName.trim().split("\\s+");
        if (parts.length >= 2) {
            return "Val. " + parts[0] + " " + parts[1].charAt(0) + ".";
        }
        return "Val. " + parts[0] + ".";
    }

    private Map<String, Short> draftDimensions(RevampSupplierEvaluatorAssignment assignment) {
        if (assignment.getDraftDimensionScoresJson() == null || assignment.getDraftDimensionScoresJson().isNull()) {
            return Map.of();
        }
        try {
            Map<?, ?> raw = objectMapper.treeToValue(assignment.getDraftDimensionScoresJson(), Map.class);
            Map<String, Short> result = new java.util.LinkedHashMap<>();
            raw.forEach((key, value) -> {
                if (key == null || value == null) return;
                if (value instanceof Number number) {
                    result.put(String.valueOf(key), number.shortValue());
                }
            });
            return result;
        } catch (JsonProcessingException ex) {
            return Map.of();
        }
    }

    private void appendEvaluationAudit(String eventKey, RevampEvaluation evaluation, UUID actorUserId, UUID assignmentId) {
        UUID supplierId = evaluation.getSupplierRegistryProfile() != null ? evaluation.getSupplierRegistryProfile().getId() : null;
        String actorRole = null;
        if (actorUserId != null) {
            try {
                User actor = userRepository.findById(actorUserId).orElse(null);
                actorRole = actor != null && actor.getRole() != null ? actor.getRole().name() : null;
            } catch (RuntimeException ignored) {
                actorRole = null;
            }
        }
        String metadata = "{\"evaluationId\":\"" + evaluation.getId()
                + "\",\"assignmentId\":\"" + (assignmentId != null ? assignmentId : "")
                + "\",\"supplierName\":\"" + esc(evaluation.getSupplierRegistryProfile() != null ? evaluation.getSupplierRegistryProfile().getDisplayName() : "")
                + "\",\"overallScore\":\"" + evaluation.getOverallScore() + "\"}";
        auditService.append(new RevampAuditEventInputDto(
                eventKey,
                "REVAMP_SUPPLIER_REGISTRY_PROFILE",
                supplierId,
                actorUserId,
                actorRole,
                null,
                null,
                null,
                "{\"overallScore\":\"" + evaluation.getOverallScore() + "\"}",
                metadata
        ));
    }

    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
