package com.supplierplatform.revamp.service;

import com.supplierplatform.revamp.dto.RevampReportAnalyticsDto;
import com.supplierplatform.revamp.dto.RevampReportFilterParams;
import com.supplierplatform.revamp.dto.RevampReportKpisDto;
import com.supplierplatform.revamp.enums.ApplicationStatus;
import com.supplierplatform.revamp.enums.InviteStatus;
import com.supplierplatform.revamp.repository.RevampApplicationRepository;
import com.supplierplatform.revamp.repository.RevampInviteRepository;
import com.supplierplatform.search.SearchService;
import com.supplierplatform.supplier.SupplierProfileRepository;
import com.supplierplatform.supplier.enums.SupplierStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RevampReportService {

    private final SupplierProfileRepository supplierProfileRepository;
    private final RevampApplicationRepository applicationRepository;
    private final RevampInviteRepository inviteRepository;
    private final SearchService searchService;
    private final JdbcTemplate jdbcTemplate;

    @Transactional(readOnly = true)
    public RevampReportKpisDto getKpis() {
        long totalSuppliers = supplierProfileRepository.count();
        long activeSuppliers = supplierProfileRepository.findByStatus(SupplierStatus.ACTIVE).size();
        long pendingSuppliers = supplierProfileRepository.findByStatus(SupplierStatus.PENDING).size();
        long submittedApplications = applicationRepository.findByStatus(ApplicationStatus.SUBMITTED).size();
        long pendingInvites = inviteRepository.findAll().stream()
                .filter(invite -> invite.getStatus() == InviteStatus.SENT)
                .count();

        return new RevampReportKpisDto(
                totalSuppliers,
                activeSuppliers,
                pendingSuppliers,
                submittedApplications,
                pendingInvites
        );
    }

    @Transactional(readOnly = true)
    public byte[] exportKpisCsv() {
        RevampReportKpisDto kpis = getKpis();
        String csv = "metric,value\n" +
                "totalSuppliers," + kpis.totalSuppliers() + "\n" +
                "activeSuppliers," + kpis.activeSuppliers() + "\n" +
                "pendingSuppliers," + kpis.pendingSuppliers() + "\n" +
                "submittedApplications," + kpis.submittedApplications() + "\n" +
                "pendingInvites," + kpis.pendingInvites() + "\n";
        return csv.getBytes(StandardCharsets.UTF_8);
    }

    @Transactional(readOnly = true)
    public byte[] exportSearchExcel(String q, List<String> fields) {
        return searchService.exportSuppliersSearchToExcel(q, fields);
    }

    @Transactional(readOnly = true)
    public byte[] exportReportExcel(RevampReportFilterParams filters) {
        List<UUID> supplierUserIds = queryFilteredSupplierUserIds(filters);
        return searchService.exportSuppliersByUserIdsToExcel(supplierUserIds);
    }

    @Transactional(readOnly = true)
    public RevampReportAnalyticsDto getAnalytics() {
        return getAnalytics(null);
    }

    @Transactional(readOnly = true)
    public RevampReportAnalyticsDto getAnalytics(RevampReportFilterParams filters) {
        RevampReportKpisDto kpis = getFilteredKpis(filters);
        String profileWhere = profileWhereClause(filters, "p", "d");

        long alboAActive = count("""
                SELECT COUNT(*)
                FROM supplier_registry_profiles
                WHERE registry_type = 'ALBO_A'
                  AND status IN ('APPROVED', 'RENEWAL_DUE')
                """);
        long alboBActive = count("""
                SELECT COUNT(*)
                FROM supplier_registry_profiles
                WHERE registry_type = 'ALBO_B'
                  AND status IN ('APPROVED', 'RENEWAL_DUE')
                """);
        if (filters != null && filters.registryType() != null && !filters.registryType().isBlank()) {
            String rt = filters.registryType().trim().toUpperCase();
            if ("ALBO_A".equals(rt)) {
                alboBActive = 0L;
            } else if ("ALBO_B".equals(rt)) {
                alboAActive = 0L;
            }
        }
        if (hasProfileFilters(filters)) {
            alboAActive = count("""
                    SELECT COUNT(*)
                    FROM supplier_registry_profiles p
                    LEFT JOIN supplier_registry_profile_details d ON d.profile_id = p.id
                    """ + profileWhere + """
                    AND p.registry_type = 'ALBO_A'
                    AND p.status IN ('APPROVED', 'RENEWAL_DUE')
                    """);
            alboBActive = count("""
                    SELECT COUNT(*)
                    FROM supplier_registry_profiles p
                    LEFT JOIN supplier_registry_profile_details d ON d.profile_id = p.id
                    """ + profileWhere + """
                    AND p.registry_type = 'ALBO_B'
                    AND p.status IN ('APPROVED', 'RENEWAL_DUE')
                    """);
        }

        int targetYear = filters != null && filters.year() != null ? filters.year() : LocalDate.now().getYear();
        long newRegistrationsYtd = count("""
                SELECT COUNT(*)
                FROM applications
                WHERE submitted_at IS NOT NULL
                  AND EXTRACT(YEAR FROM submitted_at) = ?
                """, targetYear);

        long evaluationsYtd = count("""
                SELECT COUNT(*)
                FROM evaluations e
                JOIN supplier_registry_profiles p ON p.id = e.supplier_registry_profile_id
                LEFT JOIN supplier_registry_profile_details d ON d.profile_id = p.id
                WHERE COALESCE(is_annulled, false) = false
                  AND EXTRACT(YEAR FROM e.created_at) = ?
                """ + profileFilterTail(filters, "p", "d"), targetYear);

        long approvedApplications = count("SELECT COUNT(*) FROM applications WHERE status = 'APPROVED'");
        long rejectedApplications = count("SELECT COUNT(*) FROM applications WHERE status = 'REJECTED'");
        double approvalRatePct = approvedApplications + rejectedApplications > 0
                ? (approvedApplications * 100.0) / (approvedApplications + rejectedApplications)
                : 0d;

        List<RevampReportAnalyticsDto.MonthlyPointDto> monthlyPoints = buildMonthlyPoints(filters);
        List<RevampReportAnalyticsDto.TopicRankingRowDto> thematicRanking = buildThematicRanking(filters);
        List<RevampReportAnalyticsDto.DistributionRowDto> distribution = buildDistributionRows();
        List<RevampReportAnalyticsDto.TopSupplierRowDto> topSuppliers = buildTopSuppliers(filters);

        return new RevampReportAnalyticsDto(
                kpis,
                alboAActive,
                alboBActive,
                newRegistrationsYtd,
                evaluationsYtd,
                round1(approvalRatePct),
                monthlyPoints,
                thematicRanking,
                distribution,
                topSuppliers
        );
    }

    private List<RevampReportAnalyticsDto.MonthlyPointDto> buildMonthlyPoints(RevampReportFilterParams filters) {
        int targetYear = filters != null && filters.year() != null ? filters.year() : LocalDate.now().getYear();
        String registryTypeClause = (filters != null && filters.registryType() != null && !filters.registryType().isBlank())
                ? " AND registry_type = ? "
                : "";
        List<Object> args = new ArrayList<>();
        args.add(targetYear);
        if (!registryTypeClause.isBlank()) {
            args.add(filters.registryType().trim().toUpperCase());
        }
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT
                    EXTRACT(MONTH FROM submitted_at)::int AS m,
                    SUM(CASE WHEN registry_type = 'ALBO_A' THEN 1 ELSE 0 END)::bigint AS albo_a,
                    SUM(CASE WHEN registry_type = 'ALBO_B' THEN 1 ELSE 0 END)::bigint AS albo_b
                FROM applications
                WHERE submitted_at IS NOT NULL
                  AND EXTRACT(YEAR FROM submitted_at) = ?
                """ + registryTypeClause + """
                GROUP BY EXTRACT(MONTH FROM submitted_at)
                ORDER BY m
                """, args.toArray());

        Map<Integer, long[]> byMonth = new HashMap<>();
        for (Map<String, Object> row : rows) {
            int month = number(row.get("m")).intValue();
            long alboA = number(row.get("albo_a")).longValue();
            long alboB = number(row.get("albo_b")).longValue();
            byMonth.put(month, new long[]{alboA, alboB});
        }

        String[] labels = {"Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"};
        List<RevampReportAnalyticsDto.MonthlyPointDto> out = new ArrayList<>();
        for (int month = 1; month <= 12; month++) {
            long[] values = byMonth.getOrDefault(month, new long[]{0L, 0L});
            out.add(new RevampReportAnalyticsDto.MonthlyPointDto(labels[month - 1], values[0], values[1]));
        }
        return out;
    }

    private List<RevampReportAnalyticsDto.TopicRankingRowDto> buildThematicRanking(RevampReportFilterParams filters) {
        String registryTypeClause = (filters != null && filters.registryType() != null && !filters.registryType().isBlank())
                ? " AND a.registry_type = ? "
                : " AND a.registry_type = 'ALBO_A' ";
        List<Object> args = new ArrayList<>();
        if (filters != null && filters.registryType() != null && !filters.registryType().isBlank()) {
            args.add(filters.registryType().trim().toUpperCase());
        }
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT label, cnt
                FROM (
                    SELECT
                        NULLIF(BTRIM(comp->>'theme'), '') AS label,
                        COUNT(*)::bigint AS cnt
                    FROM application_sections s
                    JOIN applications a ON a.id = s.application_id
                    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.payload_json->'competencies', '[]'::jsonb)) comp
                    WHERE s.section_key = 'S3A'
                      AND s.is_latest = TRUE
                """ + registryTypeClause + """
                    GROUP BY NULLIF(BTRIM(comp->>'theme'), '')
                ) x
                WHERE label IS NOT NULL
                ORDER BY cnt DESC, label ASC
                LIMIT 7
                """, args.toArray());

        if (rows.isEmpty()) {
            rows = jdbcTemplate.queryForList("""
                    SELECT
                        NULLIF(BTRIM(service), '') AS label,
                        COUNT(*)::bigint AS cnt
                    FROM application_sections s
                    JOIN applications a ON a.id = s.application_id
                    CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(s.payload_json->'services', '[]'::jsonb)) service
                    WHERE s.section_key = 'S3B'
                      AND s.is_latest = TRUE
                """ + registryTypeClause + """
                    GROUP BY NULLIF(BTRIM(service), '')
                    HAVING NULLIF(BTRIM(service), '') IS NOT NULL
                    ORDER BY cnt DESC, label ASC
                    LIMIT 7
                    """, args.toArray());
        }

        long max = rows.stream()
                .map(row -> number(row.get("cnt")).longValue())
                .max(Comparator.naturalOrder())
                .orElse(1L);
        if (max <= 0) max = 1L;

        List<RevampReportAnalyticsDto.TopicRankingRowDto> out = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            String label = Optional.ofNullable((String) row.get("label"))
                    .map(String::trim)
                    .filter(value -> !value.isEmpty())
                    .orElse("Altro");
            long value = number(row.get("cnt")).longValue();
            int pct = (int) Math.max(0, Math.min(100, Math.round((value * 100.0) / max)));
            out.add(new RevampReportAnalyticsDto.TopicRankingRowDto(label, value, pct));
        }
        return out;
    }

    private List<RevampReportAnalyticsDto.DistributionRowDto> buildDistributionRows() {
        long active = count("SELECT COUNT(*) FROM supplier_profiles WHERE status IN ('ACTIVE','APPROVED')");
        long suspended = count("SELECT COUNT(*) FROM supplier_profiles WHERE status IN ('INACTIVE')");
        long waiting = count("SELECT COUNT(*) FROM supplier_profiles WHERE status IN ('PENDING','NEEDS_REVISION')");
        long rejected = count("SELECT COUNT(*) FROM supplier_profiles WHERE status IN ('REJECTED')");
        long compiling = count("SELECT COUNT(*) FROM supplier_profiles WHERE status IN ('DRAFT')");
        return List.of(
                new RevampReportAnalyticsDto.DistributionRowDto("Attivi", active),
                new RevampReportAnalyticsDto.DistributionRowDto("Sospesi", suspended),
                new RevampReportAnalyticsDto.DistributionRowDto("In attesa", waiting),
                new RevampReportAnalyticsDto.DistributionRowDto("Rigettati", rejected),
                new RevampReportAnalyticsDto.DistributionRowDto("In comp.", compiling)
        );
    }

    private List<RevampReportAnalyticsDto.TopSupplierRowDto> buildTopSuppliers(RevampReportFilterParams filters) {
        String profileWhere = profileWhereClause(filters, "srp", "d");
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT
                    COALESCE(NULLIF(BTRIM(srp.display_name), ''), 'Fornitore') AS name,
                    srp.registry_type AS registry_type,
                    ROUND(AVG(e.overall_score)::numeric, 1) AS avg_score,
                    COUNT(*)::bigint AS eval_count
                FROM evaluations e
                JOIN supplier_registry_profiles srp ON srp.id = e.supplier_registry_profile_id
                LEFT JOIN supplier_registry_profile_details d ON d.profile_id = srp.id
                WHERE COALESCE(e.is_annulled, false) = false
                """ + profileFilterTail(filters, "srp", "d") + """
                GROUP BY COALESCE(NULLIF(BTRIM(srp.display_name), ''), 'Fornitore'), srp.registry_type
                ORDER BY avg_score DESC, eval_count DESC, name ASC
                LIMIT 5
                """);

        List<RevampReportAnalyticsDto.TopSupplierRowDto> out = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            String name = Optional.ofNullable((String) row.get("name")).orElse("Fornitore");
            String registryType = Optional.ofNullable((String) row.get("registry_type")).orElse("");
            String subtitle = "ALBO_A".equalsIgnoreCase(registryType) ? "Albo A" : "Albo B";
            double avg = number(row.get("avg_score")).doubleValue();
            long count = number(row.get("eval_count")).longValue();
            out.add(new RevampReportAnalyticsDto.TopSupplierRowDto(name, subtitle, round1(avg), count));
        }
        return out;
    }

    private long count(String sql, Object... args) {
        Long value = jdbcTemplate.queryForObject(sql, Long.class, args);
        return value == null ? 0L : value;
    }

    private RevampReportKpisDto getFilteredKpis(RevampReportFilterParams filters) {
        String where = profileWhereClause(filters, "p", "d");
        long totalSuppliers = count("""
                SELECT COUNT(*)
                FROM supplier_registry_profiles p
                LEFT JOIN supplier_registry_profile_details d ON d.profile_id = p.id
                """ + where);
        long activeSuppliers = count("""
                SELECT COUNT(*)
                FROM supplier_registry_profiles p
                LEFT JOIN supplier_registry_profile_details d ON d.profile_id = p.id
                """ + where + """
                AND p.status IN ('APPROVED', 'RENEWAL_DUE')
                """);
        long pendingSuppliers = count("""
                SELECT COUNT(*)
                FROM applications a
                LEFT JOIN supplier_registry_profiles p ON p.application_id = a.id
                LEFT JOIN supplier_registry_profile_details d ON d.profile_id = p.id
                WHERE a.status IN ('SUBMITTED', 'UNDER_REVIEW')
                """ + applicationFilterTail(filters, "a", "p", "d"));
        long submittedApplications = count("""
                SELECT COUNT(*)
                FROM applications a
                LEFT JOIN supplier_registry_profiles p ON p.application_id = a.id
                LEFT JOIN supplier_registry_profile_details d ON d.profile_id = p.id
                WHERE a.status = 'SUBMITTED'
                """ + applicationFilterTail(filters, "a", "p", "d"));
        long pendingInvites = count("""
                SELECT COUNT(*)
                FROM invites i
                WHERE i.status = 'SENT'
                """ + inviteFilterTail(filters, "i"));
        return new RevampReportKpisDto(totalSuppliers, activeSuppliers, pendingSuppliers, submittedApplications, pendingInvites);
    }

    private String profileWhereClause(RevampReportFilterParams filters, String profileAlias, String detailsAlias) {
        return "WHERE 1=1 " + profileFilterTail(filters, profileAlias, detailsAlias);
    }

    private String profileFilterTail(RevampReportFilterParams filters, String profileAlias, String detailsAlias) {
        if (filters == null) return "";
        StringBuilder out = new StringBuilder();
        if (hasText(filters.registryType())) {
            out.append(" AND ").append(profileAlias).append(".registry_type = '").append(escapeLiteral(filters.registryType().trim().toUpperCase())).append("' ");
        }
        if (hasText(filters.profileStatus())) {
            out.append(" AND ").append(profileAlias).append(".status = '").append(escapeLiteral(filters.profileStatus().trim().toUpperCase())).append("' ");
        }
        if (hasText(filters.groupCompany())) {
            out.append(" AND COALESCE(").append(detailsAlias).append(".projected_json->>'groupCompany','') = '")
                    .append(escapeLiteral(filters.groupCompany().trim())).append("' ");
        }
        if (hasText(filters.category())) {
            String cat = escapeLiteral(filters.category().trim().toUpperCase());
            out.append(" AND (UPPER(COALESCE(").append(detailsAlias).append(".projected_json->>'category','')) = '").append(cat).append("' ")
                    .append(" OR UPPER(COALESCE(").append(detailsAlias).append(".search_service_categories_csv,'')) LIKE '%").append(cat).append("%') ");
        }
        if (filters.year() != null) {
            out.append(" AND EXTRACT(YEAR FROM ").append(profileAlias).append(".created_at) = ").append(filters.year()).append(" ");
        }
        if (filters.periodFrom() != null) {
            out.append(" AND ").append(profileAlias).append(".created_at::date >= '").append(filters.periodFrom()).append("' ");
        }
        if (filters.periodTo() != null) {
            out.append(" AND ").append(profileAlias).append(".created_at::date <= '").append(filters.periodTo()).append("' ");
        }
        if (hasText(filters.ratingBand())) {
            appendRatingBand(out, filters.ratingBand(), profileAlias + ".aggregate_score");
        }
        return out.toString();
    }

    private String applicationFilterTail(RevampReportFilterParams filters, String appAlias, String profileAlias, String detailsAlias) {
        if (filters == null) return "";
        StringBuilder out = new StringBuilder();
        if (hasText(filters.registryType())) {
            out.append(" AND ").append(appAlias).append(".registry_type = '").append(escapeLiteral(filters.registryType().trim().toUpperCase())).append("' ");
        }
        if (filters.year() != null) {
            out.append(" AND EXTRACT(YEAR FROM ").append(appAlias).append(".submitted_at) = ").append(filters.year()).append(" ");
        }
        if (filters.periodFrom() != null) {
            out.append(" AND ").append(appAlias).append(".submitted_at::date >= '").append(filters.periodFrom()).append("' ");
        }
        if (filters.periodTo() != null) {
            out.append(" AND ").append(appAlias).append(".submitted_at::date <= '").append(filters.periodTo()).append("' ");
        }
        out.append(profileFilterTail(filters, profileAlias, detailsAlias));
        return out.toString();
    }

    private String inviteFilterTail(RevampReportFilterParams filters, String inviteAlias) {
        if (filters == null || !hasText(filters.registryType())) return "";
        return " AND " + inviteAlias + ".registry_type = '" + escapeLiteral(filters.registryType().trim().toUpperCase()) + "' ";
    }

    private List<UUID> queryFilteredSupplierUserIds(RevampReportFilterParams filters) {
        List<Object> rows = jdbcTemplate.queryForList("""
                SELECT DISTINCT p.supplier_user_id
                FROM supplier_registry_profiles p
                LEFT JOIN supplier_registry_profile_details d ON d.profile_id = p.id
                """ + profileWhereClause(filters, "p", "d") + """
                ORDER BY p.supplier_user_id
                """, Object.class);
        List<UUID> out = new ArrayList<>();
        for (Object value : rows) {
            if (value == null) continue;
            out.add(UUID.fromString(String.valueOf(value)));
        }
        return out;
    }

    private boolean hasProfileFilters(RevampReportFilterParams filters) {
        if (filters == null) return false;
        return hasText(filters.registryType())
                || hasText(filters.groupCompany())
                || hasText(filters.category())
                || hasText(filters.profileStatus())
                || hasText(filters.ratingBand())
                || filters.year() != null
                || filters.periodFrom() != null
                || filters.periodTo() != null;
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private String escapeLiteral(String value) {
        return value.replace("'", "''");
    }

    private void appendRatingBand(StringBuilder out, String rawBand, String scoreColumn) {
        String band = rawBand.trim().toUpperCase();
        try {
            if (band.endsWith("+")) {
                double min = Double.parseDouble(band.substring(0, band.length() - 1));
                out.append(" AND ").append(scoreColumn).append(" >= ").append(min).append(" ");
                return;
            }
            if (band.contains("-")) {
                String[] parts = band.split("-");
                if (parts.length == 2) {
                    double min = Double.parseDouble(parts[0]);
                    double max = Double.parseDouble(parts[1]);
                    out.append(" AND ").append(scoreColumn).append(" BETWEEN ").append(min).append(" AND ").append(max).append(" ");
                    return;
                }
            }
            if (band.contains("_")) {
                String[] parts = band.split("_");
                if (parts.length == 2) {
                    double min = Double.parseDouble(parts[0]);
                    double max = Double.parseDouble(parts[1]);
                    out.append(" AND ").append(scoreColumn).append(" BETWEEN ").append(min).append(" AND ").append(max).append(" ");
                    return;
                }
            }
            double min = Double.parseDouble(band);
            out.append(" AND ").append(scoreColumn).append(" >= ").append(min).append(" ");
        } catch (NumberFormatException ignored) {
            // Ignore invalid rating bands instead of failing the whole report endpoint.
        }
    }

    private Number number(Object value) {
        if (value instanceof Number n) {
            return n;
        }
        return Double.parseDouble(String.valueOf(value));
    }

    private double round1(double value) {
        return Math.round(value * 10.0d) / 10.0d;
    }

}
