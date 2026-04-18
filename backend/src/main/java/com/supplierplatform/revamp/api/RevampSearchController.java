package com.supplierplatform.revamp.api;

import com.supplierplatform.common.ApiResponse;
import com.supplierplatform.config.RevampAccessGuard;
import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.service.RevampGovernanceAuthorizationService;
import com.supplierplatform.search.SearchService;
import com.supplierplatform.search.dto.AdvancedSearchRequest;
import com.supplierplatform.search.dto.SearchResultRowResponse;
import com.supplierplatform.supplier.dto.SupplierProfileResponse;
import com.supplierplatform.user.User;
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

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v2/search")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class RevampSearchController {

    private final SearchService searchService;
    private final RevampAccessGuard revampAccessGuard;
    private final RevampGovernanceAuthorizationService governanceAuthorizationService;

    @GetMapping("/suppliers")
    public ResponseEntity<ApiResponse<Page<SearchResultRowResponse>>> searchSuppliers(
            @RequestParam(name = "q") String q,
            @RequestParam(name = "fields") List<String> fields,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size
    ) {
        revampAccessGuard.requireReadEnabled();
        AdminRole actorRole = governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO,
                AdminRole.REVISORE,
                AdminRole.VIEWER
        );
        boolean activeOnly = actorRole == AdminRole.VIEWER;
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(ApiResponse.ok(searchService.searchSuppliersNormalized(q, fields, pageable, activeOnly)));
    }

    @PostMapping("/advanced")
    public ResponseEntity<ApiResponse<Page<SupplierProfileResponse>>> advancedSearch(
            @Valid @RequestBody AdvancedSearchRequest request
    ) {
        revampAccessGuard.requireReadEnabled();
        AdminRole actorRole = governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO,
                AdminRole.REVISORE,
                AdminRole.VIEWER
        );
        boolean activeOnly = actorRole == AdminRole.VIEWER;
        int page = request.getPage() != null ? request.getPage() : 0;
        int size = request.getSize() != null ? request.getSize() : 20;
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(ApiResponse.ok(searchService.searchSuppliersAdvanced(request.getCriteria(), pageable, activeOnly)));
    }

    private UUID getCurrentUserId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof User user) {
            return user.getId();
        }
        return null;
    }
}


