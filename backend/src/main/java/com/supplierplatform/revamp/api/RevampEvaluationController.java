package com.supplierplatform.revamp.api;

import com.supplierplatform.common.ApiResponse;
import com.supplierplatform.config.RevampAccessGuard;
import com.supplierplatform.revamp.api.dto.CreateEvaluationRequest;
import com.supplierplatform.revamp.dto.RevampEvaluationAggregateDto;
import com.supplierplatform.revamp.dto.RevampEvaluationAnalyticsDto;
import com.supplierplatform.revamp.dto.RevampEvaluationOverviewDto;
import com.supplierplatform.revamp.dto.RevampEvaluationSummaryDto;
import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.service.RevampGovernanceAuthorizationService;
import com.supplierplatform.revamp.service.RevampEvaluationService;
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
@RequestMapping({"/api/v2/evaluations", "/api/evaluations"})
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class RevampEvaluationController {

    private final RevampEvaluationService evaluationService;
    private final RevampAccessGuard revampAccessGuard;
    private final RevampGovernanceAuthorizationService governanceAuthorizationService;

    @PostMapping
    public ResponseEntity<ApiResponse<RevampEvaluationSummaryDto>> submit(@Valid @RequestBody CreateEvaluationRequest request) {
        revampAccessGuard.requireWriteEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO,
                AdminRole.REVISORE
        );
        User currentUser = getCurrentUser();
        RevampEvaluationSummaryDto dto = evaluationService.submitEvaluation(
                request.getSupplierRegistryProfileId(),
                currentUser.getId(),
                request.getCollaborationType(),
                request.getCollaborationPeriod(),
                request.getReferenceCode(),
                request.getOverallScore(),
                request.getComment(),
                request.getDimensions()
        );
        return ResponseEntity.ok(ApiResponse.ok("Evaluation submitted", dto));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<RevampEvaluationSummaryDto>>> listBySupplier(
            @RequestParam("supplierId") UUID supplierId
    ) {
        revampAccessGuard.requireReadEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO,
                AdminRole.REVISORE,
                AdminRole.VIEWER
        );
        return ResponseEntity.ok(ApiResponse.ok(evaluationService.listBySupplier(supplierId)));
    }

    @GetMapping("/overview")
    public ResponseEntity<ApiResponse<RevampEvaluationOverviewDto>> overview(
            @RequestParam(name = "q", required = false) String q,
            @RequestParam(name = "type", required = false) String type,
            @RequestParam(name = "period", required = false) String period,
            @RequestParam(name = "minScore", required = false) Double minScore,
            @RequestParam(name = "evaluator", required = false) String evaluator,
            @RequestParam(name = "limit", defaultValue = "200") Integer limit
    ) {
        revampAccessGuard.requireReadEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO,
                AdminRole.REVISORE,
                AdminRole.VIEWER
        );
        RevampEvaluationOverviewDto dto = evaluationService.overview(q, type, period, minScore, evaluator, limit);
        return ResponseEntity.ok(ApiResponse.ok(dto));
    }

    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<RevampEvaluationAggregateDto>> summaryBySupplier(
            @RequestParam("supplierId") UUID supplierId
    ) {
        revampAccessGuard.requireReadEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO,
                AdminRole.REVISORE,
                AdminRole.VIEWER
        );
        return ResponseEntity.ok(ApiResponse.ok(evaluationService.summaryBySupplier(supplierId)));
    }

    @GetMapping("/{supplierId}/analytics")
    public ResponseEntity<ApiResponse<RevampEvaluationAnalyticsDto>> analyticsBySupplier(@PathVariable UUID supplierId) {
        revampAccessGuard.requireReadEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO,
                AdminRole.REVISORE,
                AdminRole.VIEWER
        );
        return ResponseEntity.ok(ApiResponse.ok(evaluationService.analyticsBySupplier(supplierId)));
    }

    @PostMapping("/{evaluationId}/annul")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<RevampEvaluationSummaryDto>> annul(@PathVariable UUID evaluationId) {
        revampAccessGuard.requireWriteEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO
        );
        User currentUser = getCurrentUser();
        RevampEvaluationSummaryDto dto = evaluationService.annul(evaluationId, currentUser.getId());
        return ResponseEntity.ok(ApiResponse.ok("Evaluation annulled", dto));
    }

    private User getCurrentUser() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof User user) {
            return user;
        }
        return null;
    }

    private UUID getCurrentUserId() {
        User user = getCurrentUser();
        return user != null ? user.getId() : null;
    }
}


