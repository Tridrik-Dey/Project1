package com.supplierplatform.search;

import com.supplierplatform.common.ApiResponse;
import com.supplierplatform.search.dto.AdvancedSearchRequest;
import com.supplierplatform.search.dto.SearchFieldGroupResponse;
import com.supplierplatform.search.dto.SearchResultRowResponse;
import com.supplierplatform.supplier.dto.SupplierProfileResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@RestController
@RequestMapping("/api/search")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class SearchController {

    private final SearchService searchService;
    private final SearchFieldService searchFieldService;

    @GetMapping("/fields")
    public ResponseEntity<ApiResponse<List<SearchFieldGroupResponse>>> getSearchFields() {
        return ResponseEntity.ok(ApiResponse.ok(searchFieldService.getAvailableFields()));
    }

    @GetMapping("/suppliers")
    public ResponseEntity<ApiResponse<Page<SupplierProfileResponse>>> searchSuppliers(
            @RequestParam(name = "q", required = false) String q,
            @RequestParam(name = "fields") List<String> fields,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size) {

        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<SupplierProfileResponse> result = searchService.searchSuppliers(q, fields, pageable);
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    @GetMapping("/query")
    public ResponseEntity<ApiResponse<Page<SearchResultRowResponse>>> searchSuppliersNormalized(
            @RequestParam(name = "q", required = false) String q,
            @RequestParam(name = "fields") List<String> fields,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size) {

        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<SearchResultRowResponse> result = searchService.searchSuppliersNormalized(q, fields, pageable);
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> exportSearchResults(
            @RequestParam(name = "q", required = false) String q,
            @RequestParam(name = "fields") List<String> fields) {

        byte[] excel = searchService.exportSuppliersSearchToExcel(q, fields);
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
        String filename = "supplier_search_" + timestamp + ".xlsx";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(excel);
    }

    @PostMapping("/advanced")
    public ResponseEntity<ApiResponse<Page<SupplierProfileResponse>>> advancedSearch(
            @Valid @RequestBody AdvancedSearchRequest request
    ) {
        int page = request.getPage() != null ? request.getPage() : 0;
        int size = request.getSize() != null ? request.getSize() : 20;
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<SupplierProfileResponse> result = searchService.searchSuppliersAdvanced(request.getCriteria(), pageable);
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    @PostMapping("/advanced/export")
    public ResponseEntity<byte[]> exportAdvancedSearchResults(
            @Valid @RequestBody AdvancedSearchRequest request
    ) {
        byte[] excel = searchService.exportSuppliersAdvancedToExcel(request.getCriteria());
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
        String filename = "supplier_advanced_search_" + timestamp + ".xlsx";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(excel);
    }
}


