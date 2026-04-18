package com.supplierplatform.revamp.api;

import com.supplierplatform.common.ApiResponse;
import com.supplierplatform.config.RevampAccessGuard;
import com.supplierplatform.revamp.dto.RevampReportKpisDto;
import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.service.RevampGovernanceAuthorizationService;
import com.supplierplatform.revamp.service.RevampReportService;
import com.supplierplatform.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping({"/api/v2/reports", "/api/reports"})
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class RevampReportController {

    private final RevampReportService reportService;
    private final RevampAccessGuard revampAccessGuard;
    private final RevampGovernanceAuthorizationService governanceAuthorizationService;

    @GetMapping("/kpis")
    public ResponseEntity<ApiResponse<RevampReportKpisDto>> kpis() {
        revampAccessGuard.requireReadEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO,
                AdminRole.REVISORE,
                AdminRole.VIEWER
        );
        return ResponseEntity.ok(ApiResponse.ok(reportService.getKpis()));
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> export(
            @RequestParam(name = "type", defaultValue = "kpis") String type,
            @RequestParam(name = "q", required = false) String q,
            @RequestParam(name = "fields", required = false) List<String> fields
    ) {
        revampAccessGuard.requireReadEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO
        );
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
        if ("search".equalsIgnoreCase(type)) {
            byte[] excel = reportService.exportSearchExcel(q, fields);
            String filename = "revamp_search_report_" + timestamp + ".xlsx";
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                    .body(excel);
        }

        byte[] csv = reportService.exportKpisCsv();
        String filename = "revamp_kpis_" + timestamp + ".csv";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv);
    }

    private UUID getCurrentUserId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof User user) {
            return user.getId();
        }
        return null;
    }
}


