package com.supplierplatform.search;

import com.supplierplatform.search.dto.AdvancedSearchCriterionRequest;
import com.supplierplatform.search.policy.SearchFieldPolicy;
import com.supplierplatform.search.policy.SearchScopePolicy;
import com.supplierplatform.search.dto.SearchResultRowResponse;
import com.supplierplatform.supplier.SupplierProfileRepository;
import com.supplierplatform.supplier.SupplierProfileService;
import com.supplierplatform.supplier.dto.SupplierProfileResponse;
import com.supplierplatform.supplier.entity.SupplierProfile;
import com.supplierplatform.supplier.enums.AnnualRevenueRange;
import com.supplierplatform.supplier.enums.CompanyType;
import com.supplierplatform.supplier.enums.EmployeeCountRange;
import com.supplierplatform.supplier.enums.SupplierStatus;
import com.supplierplatform.user.UserRole;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.Row;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class SearchService {

    private final SupplierProfileRepository supplierProfileRepository;
    private final SupplierProfileService supplierProfileService;
    private final SearchScopePolicy searchScopePolicy;

    @Transactional(readOnly = true)
    public Page<SupplierProfileResponse> searchSuppliers(
            String searchTerm,
            List<String> selectedFields,
            Pageable pageable) {

        List<SearchFieldPolicy> resolvedFields = resolveAndValidate(searchTerm, selectedFields, pageable.getPageSize());
        Specification<SupplierProfile> spec = buildSpecification(searchTerm, resolvedFields, false);
        Page<SupplierProfile> page = supplierProfileRepository.findAll(spec, pageable);
        return page.map(supplierProfileService::toResponse);
    }

    @Transactional(readOnly = true)
    public Page<SearchResultRowResponse> searchSuppliersNormalized(
            String searchTerm,
            List<String> selectedFields,
            Pageable pageable) {
        return searchSuppliersNormalized(searchTerm, selectedFields, pageable, false);
    }

    @Transactional(readOnly = true)
    public Page<SearchResultRowResponse> searchSuppliersNormalized(
            String searchTerm,
            List<String> selectedFields,
            Pageable pageable,
            boolean activeOnly
    ) {

        List<SearchFieldPolicy> resolvedFields = resolveAndValidate(searchTerm, selectedFields, pageable.getPageSize());
        Specification<SupplierProfile> spec = buildSpecification(searchTerm, resolvedFields, activeOnly);
        Page<SupplierProfile> page = supplierProfileRepository.findAll(spec, pageable);

        return page.map(profile -> SearchResultRowResponse.builder()
                .supplierId(profile.getId())
                .status(profile.getStatus() != null ? profile.getStatus().name() : null)
                .values(extractValues(profile, resolvedFields))
                .build());
    }

    @Transactional(readOnly = true)
    public byte[] exportSuppliersSearchToExcel(String searchTerm, List<String> selectedFields) {
        List<SearchFieldPolicy> resolvedFields = resolveAndValidate(
                searchTerm,
                selectedFields,
                SearchScopePolicy.MAX_PAGE_SIZE
        );

        Specification<SupplierProfile> spec = buildSpecification(searchTerm, resolvedFields, false);
        Pageable pageable = org.springframework.data.domain.PageRequest.of(
                0,
                SearchScopePolicy.MAX_EXPORT_ROWS,
                org.springframework.data.domain.Sort.by("createdAt").descending()
        );
        List<SupplierProfile> rows = supplierProfileRepository.findAll(spec, pageable).getContent();

        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
            writeSuppliersSheet(workbook, rows, resolvedFields);
            writeContactsSheet(workbook, rows);
            writeCategoriesSheet(workbook, rows);
            writeDocumentsSheet(workbook, rows);
            writeReviewsSheet(workbook, rows);
            writeStatusHistorySheet(workbook, rows);

            workbook.write(bos);
            return bos.toByteArray();
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to generate Excel export", ex);
        }
    }

    @Transactional(readOnly = true)
    public Page<SupplierProfileResponse> searchSuppliersAdvanced(List<AdvancedSearchCriterionRequest> criteria, Pageable pageable) {
        return searchSuppliersAdvanced(criteria, pageable, false);
    }

    @Transactional(readOnly = true)
    public Page<SupplierProfileResponse> searchSuppliersAdvanced(
            List<AdvancedSearchCriterionRequest> criteria,
            Pageable pageable,
            boolean activeOnly
    ) {
        List<SearchFieldPolicy> resolvedFields = resolveAndValidateAdvanced(criteria, pageable.getPageSize());
        Specification<SupplierProfile> spec = buildAdvancedSpecification(criteria, resolvedFields, activeOnly);
        Page<SupplierProfile> page = supplierProfileRepository.findAll(spec, pageable);
        return page.map(supplierProfileService::toResponse);
    }

    @Transactional(readOnly = true)
    public byte[] exportSuppliersAdvancedToExcel(List<AdvancedSearchCriterionRequest> criteria) {
        List<SearchFieldPolicy> resolvedFields = resolveAndValidateAdvanced(criteria, SearchScopePolicy.MAX_PAGE_SIZE);
        Specification<SupplierProfile> spec = buildAdvancedSpecification(criteria, resolvedFields, false);
        Pageable pageable = org.springframework.data.domain.PageRequest.of(
                0,
                SearchScopePolicy.MAX_EXPORT_ROWS,
                org.springframework.data.domain.Sort.by("createdAt").descending()
        );
        List<SupplierProfile> rows = supplierProfileRepository.findAll(spec, pageable).getContent();

        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
            writeSuppliersSheet(workbook, rows, resolvedFields);
            writeContactsSheet(workbook, rows);
            writeCategoriesSheet(workbook, rows);
            writeDocumentsSheet(workbook, rows);
            writeReviewsSheet(workbook, rows);
            writeStatusHistorySheet(workbook, rows);
            workbook.write(bos);
            return bos.toByteArray();
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to generate Excel export", ex);
        }
    }

    private void writeSuppliersSheet(XSSFWorkbook workbook, List<SupplierProfile> rows, List<SearchFieldPolicy> resolvedFields) {
        XSSFSheet sheet = workbook.createSheet("Suppliers");
        int rowIdx = 0;
        Row header = sheet.createRow(rowIdx++);
        int col = 0;
        header.createCell(col++).setCellValue("supplier_id");
        for (SearchFieldPolicy field : resolvedFields) {
            header.createCell(col++).setCellValue(field.label());
        }
        header.createCell(col++).setCellValue("status");
        header.createCell(col++).setCellValue("user_email");
        header.createCell(col).setCellValue("user_full_name");

        for (SupplierProfile profile : rows) {
            Row data = sheet.createRow(rowIdx++);
            int c = 0;
            data.createCell(c++).setCellValue(string(profile.getId()));
            Map<String, String> values = extractValues(profile, resolvedFields);
            for (SearchFieldPolicy field : resolvedFields) {
                data.createCell(c++).setCellValue(string(values.get(field.fieldKey())));
            }
            data.createCell(c++).setCellValue(string(profile.getStatus() != null ? profile.getStatus().name() : null));
            data.createCell(c++).setCellValue(string(profile.getUser() != null ? profile.getUser().getEmail() : null));
            data.createCell(c).setCellValue(string(profile.getUser() != null ? profile.getUser().getFullName() : null));
        }
        autoSize(sheet, col + 1);
    }

    private void writeContactsSheet(XSSFWorkbook workbook, List<SupplierProfile> rows) {
        XSSFSheet sheet = workbook.createSheet("Supplier Contacts");
        Row header = sheet.createRow(0);
        String[] headers = {"supplier_id", "contact_id", "full_name", "email", "contact_type", "job_title", "phone", "is_primary", "created_at"};
        for (int i = 0; i < headers.length; i++) header.createCell(i).setCellValue(headers[i]);

        int rowIdx = 1;
        for (SupplierProfile profile : rows) {
            for (var contact : profile.getContacts()) {
                Row data = sheet.createRow(rowIdx++);
                data.createCell(0).setCellValue(string(profile.getId()));
                data.createCell(1).setCellValue(string(contact.getId()));
                data.createCell(2).setCellValue(string(contact.getFullName()));
                data.createCell(3).setCellValue(string(contact.getEmail()));
                data.createCell(4).setCellValue(string(contact.getContactType()));
                data.createCell(5).setCellValue(string(contact.getJobTitle()));
                data.createCell(6).setCellValue(string(contact.getPhone()));
                data.createCell(7).setCellValue(string(contact.getIsPrimary()));
                data.createCell(8).setCellValue(string(contact.getCreatedAt()));
            }
        }
        autoSize(sheet, headers.length);
    }

    private void writeCategoriesSheet(XSSFWorkbook workbook, List<SupplierProfile> rows) {
        XSSFSheet sheet = workbook.createSheet("Supplier Categories");
        Row header = sheet.createRow(0);
        String[] headers = {"supplier_id", "category_id", "code", "name", "parent_id", "is_active"};
        for (int i = 0; i < headers.length; i++) header.createCell(i).setCellValue(headers[i]);

        int rowIdx = 1;
        for (SupplierProfile profile : rows) {
            for (var category : profile.getCategories()) {
                Row data = sheet.createRow(rowIdx++);
                data.createCell(0).setCellValue(string(profile.getId()));
                data.createCell(1).setCellValue(string(category.getId()));
                data.createCell(2).setCellValue(string(category.getCode()));
                data.createCell(3).setCellValue(string(category.getName()));
                data.createCell(4).setCellValue(string(category.getParent() != null ? category.getParent().getId() : null));
                data.createCell(5).setCellValue(string(category.getIsActive()));
            }
        }
        autoSize(sheet, headers.length);
    }

    private void writeDocumentsSheet(XSSFWorkbook workbook, List<SupplierProfile> rows) {
        XSSFSheet sheet = workbook.createSheet("Supplier Documents");
        Row header = sheet.createRow(0);
        String[] headers = {"supplier_id", "document_id", "document_type", "original_filename", "mime_type", "file_size_bytes", "is_current", "expiry_date", "notes", "uploaded_at", "uploaded_by_email"};
        for (int i = 0; i < headers.length; i++) header.createCell(i).setCellValue(headers[i]);

        int rowIdx = 1;
        for (SupplierProfile profile : rows) {
            for (var doc : profile.getDocuments()) {
                Row data = sheet.createRow(rowIdx++);
                data.createCell(0).setCellValue(string(profile.getId()));
                data.createCell(1).setCellValue(string(doc.getId()));
                data.createCell(2).setCellValue(string(doc.getDocumentType()));
                data.createCell(3).setCellValue(string(doc.getOriginalFilename()));
                data.createCell(4).setCellValue(string(doc.getMimeType()));
                data.createCell(5).setCellValue(string(doc.getFileSizeBytes()));
                data.createCell(6).setCellValue(string(doc.getIsCurrent()));
                data.createCell(7).setCellValue(string(doc.getExpiryDate()));
                data.createCell(8).setCellValue(string(doc.getNotes()));
                data.createCell(9).setCellValue(string(doc.getUploadedAt()));
                data.createCell(10).setCellValue(string(doc.getUploadedBy() != null ? doc.getUploadedBy().getEmail() : null));
            }
        }
        autoSize(sheet, headers.length);
    }

    private void writeReviewsSheet(XSSFWorkbook workbook, List<SupplierProfile> rows) {
        XSSFSheet sheet = workbook.createSheet("Validation Reviews");
        Row header = sheet.createRow(0);
        String[] headers = {"supplier_id", "review_id", "action", "comment", "internal_note", "previous_status", "new_status", "reviewer_email", "created_at"};
        for (int i = 0; i < headers.length; i++) header.createCell(i).setCellValue(headers[i]);

        int rowIdx = 1;
        for (SupplierProfile profile : rows) {
            for (var review : profile.getReviews()) {
                Row data = sheet.createRow(rowIdx++);
                data.createCell(0).setCellValue(string(profile.getId()));
                data.createCell(1).setCellValue(string(review.getId()));
                data.createCell(2).setCellValue(string(review.getAction()));
                data.createCell(3).setCellValue(string(review.getComment()));
                data.createCell(4).setCellValue(string(review.getInternalNote()));
                data.createCell(5).setCellValue(string(review.getPreviousStatus()));
                data.createCell(6).setCellValue(string(review.getNewStatus()));
                data.createCell(7).setCellValue(string(review.getReviewer() != null ? review.getReviewer().getEmail() : null));
                data.createCell(8).setCellValue(string(review.getCreatedAt()));
            }
        }
        autoSize(sheet, headers.length);
    }

    private void writeStatusHistorySheet(XSSFWorkbook workbook, List<SupplierProfile> rows) {
        XSSFSheet sheet = workbook.createSheet("Status History");
        Row header = sheet.createRow(0);
        String[] headers = {"supplier_id", "history_id", "from_status", "to_status", "changed_by_email", "reason", "created_at"};
        for (int i = 0; i < headers.length; i++) header.createCell(i).setCellValue(headers[i]);

        int rowIdx = 1;
        for (SupplierProfile profile : rows) {
            for (var history : profile.getStatusHistories()) {
                Row data = sheet.createRow(rowIdx++);
                data.createCell(0).setCellValue(string(profile.getId()));
                data.createCell(1).setCellValue(string(history.getId()));
                data.createCell(2).setCellValue(string(history.getFromStatus()));
                data.createCell(3).setCellValue(string(history.getToStatus()));
                data.createCell(4).setCellValue(string(history.getChangedBy() != null ? history.getChangedBy().getEmail() : null));
                data.createCell(5).setCellValue(string(history.getReason()));
                data.createCell(6).setCellValue(string(history.getCreatedAt()));
            }
        }
        autoSize(sheet, headers.length);
    }

    private void autoSize(XSSFSheet sheet, int columns) {
        for (int i = 0; i < columns; i++) {
            sheet.autoSizeColumn(i);
        }
    }

    private String string(Object value) {
        return value == null ? "" : value.toString();
    }

    private List<SearchFieldPolicy> resolveAndValidate(String searchTerm, List<String> selectedFields, int pageSize) {
        validateInput(searchTerm, selectedFields, pageSize);
        UserRole currentRole = getCurrentUserRole();
        return searchScopePolicy.resolveFields(currentRole, selectedFields);
    }

    private List<SearchFieldPolicy> resolveAndValidateAdvanced(List<AdvancedSearchCriterionRequest> criteria, int pageSize) {
        if (criteria == null || criteria.isEmpty()) {
            throw new IllegalArgumentException("At least one search criterion is required");
        }
        if (criteria.size() > SearchScopePolicy.MAX_SELECTED_FIELDS) {
            throw new IllegalArgumentException("Too many selected fields");
        }
        if (pageSize > SearchScopePolicy.MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("Page size exceeds maximum limit");
        }

        List<String> selectedFields = criteria.stream()
                .map(AdvancedSearchCriterionRequest::getFieldKey)
                .toList();
        UserRole currentRole = getCurrentUserRole();
        List<SearchFieldPolicy> resolvedFields = searchScopePolicy.resolveFields(currentRole, selectedFields);

        for (AdvancedSearchCriterionRequest criterion : criteria) {
            if (criterion.getValue() == null || criterion.getValue().isBlank()) {
                throw new IllegalArgumentException("Each selected field requires a value");
            }
            if (criterion.getValue().length() > SearchScopePolicy.MAX_SEARCH_TERM_LENGTH) {
                throw new IllegalArgumentException("Search term is too long");
            }
        }

        return resolvedFields;
    }

    private void validateInput(String searchTerm, List<String> selectedFields, int pageSize) {
        if (selectedFields == null || selectedFields.isEmpty()) {
            throw new IllegalArgumentException("At least one search field must be selected");
        }
        if (selectedFields.size() > SearchScopePolicy.MAX_SELECTED_FIELDS) {
            throw new IllegalArgumentException("Too many selected fields");
        }
        if (searchTerm == null || searchTerm.isBlank()) {
            throw new IllegalArgumentException("Search term is required");
        }
        if (searchTerm.length() > SearchScopePolicy.MAX_SEARCH_TERM_LENGTH) {
            throw new IllegalArgumentException("Search term is too long");
        }
        if (pageSize > SearchScopePolicy.MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("Page size exceeds maximum limit");
        }
    }

    private Specification<SupplierProfile> buildSpecification(
            String searchTerm,
            List<SearchFieldPolicy> fields,
            boolean activeOnly
    ) {
        return (root, query, cb) -> {
            String normalized = searchTerm.trim().toLowerCase();
            List<Predicate> orPredicates = new ArrayList<>();

            for (SearchFieldPolicy field : fields) {
                switch (field.fieldKey()) {
                    case "supplier.companyName" ->
                            orPredicates.add(cb.like(cb.lower(root.get("companyName")), "%" + normalized + "%"));
                    case "supplier.tradingName" ->
                            orPredicates.add(cb.like(cb.lower(root.get("tradingName")), "%" + normalized + "%"));
                    case "supplier.vatNumber" ->
                            orPredicates.add(cb.like(cb.lower(root.get("vatNumber")), "%" + normalized + "%"));
                    case "supplier.taxId" ->
                            orPredicates.add(cb.like(cb.lower(root.get("taxId")), "%" + normalized + "%"));
                    case "supplier.registrationNumber" ->
                            orPredicates.add(cb.like(cb.lower(root.get("registrationNumber")), "%" + normalized + "%"));
                    case "supplier.countryOfIncorporation" ->
                            orPredicates.add(cb.like(cb.lower(root.get("countryOfIncorporation")), "%" + normalized + "%"));
                    case "supplier.website" ->
                            orPredicates.add(cb.like(cb.lower(root.get("website")), "%" + normalized + "%"));
                    case "supplier.addressLine1" ->
                            orPredicates.add(cb.like(cb.lower(root.get("addressLine1")), "%" + normalized + "%"));
                    case "supplier.addressLine2" ->
                            orPredicates.add(cb.like(cb.lower(root.get("addressLine2")), "%" + normalized + "%"));
                    case "supplier.city" ->
                            orPredicates.add(cb.like(cb.lower(root.get("city")), "%" + normalized + "%"));
                    case "supplier.stateProvince" ->
                            orPredicates.add(cb.like(cb.lower(root.get("stateProvince")), "%" + normalized + "%"));
                    case "supplier.postalCode" ->
                            orPredicates.add(cb.like(cb.lower(root.get("postalCode")), "%" + normalized + "%"));
                    case "supplier.description" ->
                            orPredicates.add(cb.like(cb.lower(root.get("description")), "%" + normalized + "%"));
                    case "supplier.country" ->
                            orPredicates.add(cb.like(cb.lower(root.get("country")), "%" + normalized + "%"));
                    case "user.email" -> {
                        var userJoin = root.join("user");
                        orPredicates.add(cb.like(cb.lower(userJoin.get("email")), "%" + normalized + "%"));
                    }
                    case "user.fullName" -> {
                        var userJoin = root.join("user");
                        orPredicates.add(cb.like(cb.lower(userJoin.get("fullName")), "%" + normalized + "%"));
                    }
                    case "supplier.status" -> {
                        SupplierStatus parsed = parseStatus(normalized);
                        if (parsed != null) {
                            orPredicates.add(cb.equal(root.get("status"), parsed));
                        }
                    }
                    case "supplier.companyType" -> {
                        CompanyType parsed = parseCompanyType(normalized);
                        if (parsed != null) {
                            orPredicates.add(cb.equal(root.get("companyType"), parsed));
                        }
                    }
                    case "supplier.employeeCountRange" -> {
                        EmployeeCountRange parsed = parseEmployeeCount(normalized);
                        if (parsed != null) {
                            orPredicates.add(cb.equal(root.get("employeeCountRange"), parsed));
                        }
                    }
                    case "supplier.annualRevenueRange" -> {
                        AnnualRevenueRange parsed = parseAnnualRevenue(normalized);
                        if (parsed != null) {
                            orPredicates.add(cb.equal(root.get("annualRevenueRange"), parsed));
                        }
                    }
                    case "supplier.incorporationDate" -> {
                        LocalDate parsed = parseDate(normalized);
                        if (parsed != null) {
                            orPredicates.add(cb.equal(root.get("incorporationDate"), parsed));
                        }
                    }
                    default -> throw new IllegalArgumentException("Unsupported field: " + field.fieldKey());
                }
            }

            if (orPredicates.isEmpty()) {
                return cb.disjunction();
            }

            query.distinct(true);
            Predicate searchPredicate = cb.or(orPredicates.toArray(new Predicate[0]));
            if (!activeOnly) {
                return searchPredicate;
            }
            return cb.and(searchPredicate, cb.equal(root.get("status"), SupplierStatus.ACTIVE));
        };
    }

    private Specification<SupplierProfile> buildAdvancedSpecification(
            List<AdvancedSearchCriterionRequest> criteria,
            List<SearchFieldPolicy> resolvedFields,
            boolean activeOnly
    ) {
        Map<String, SearchFieldPolicy> fieldsByKey = new HashMap<>();
        for (SearchFieldPolicy field : resolvedFields) {
            fieldsByKey.put(field.fieldKey(), field);
        }

        return (root, query, cb) -> {
            List<Predicate> andPredicates = new ArrayList<>();
            for (AdvancedSearchCriterionRequest criterion : criteria) {
                SearchFieldPolicy policy = fieldsByKey.get(criterion.getFieldKey());
                if (policy == null) {
                    throw new IllegalArgumentException("Unsupported field: " + criterion.getFieldKey());
                }

                Predicate predicate = buildPredicateForField(root, cb, policy.fieldKey(), criterion.getValue().trim());
                andPredicates.add(predicate);
            }

            query.distinct(true);
            Predicate criteriaPredicate = cb.and(andPredicates.toArray(new Predicate[0]));
            if (!activeOnly) {
                return criteriaPredicate;
            }
            return cb.and(criteriaPredicate, cb.equal(root.get("status"), SupplierStatus.ACTIVE));
        };
    }

    private Predicate buildPredicateForField(
            jakarta.persistence.criteria.Root<SupplierProfile> root,
            jakarta.persistence.criteria.CriteriaBuilder cb,
            String fieldKey,
            String rawValue
    ) {
        String normalized = rawValue.toLowerCase();
        return switch (fieldKey) {
            case "supplier.companyName" -> cb.like(cb.lower(root.get("companyName")), "%" + normalized + "%");
            case "supplier.tradingName" -> cb.like(cb.lower(root.get("tradingName")), "%" + normalized + "%");
            case "supplier.vatNumber" -> cb.like(cb.lower(root.get("vatNumber")), "%" + normalized + "%");
            case "supplier.taxId" -> cb.like(cb.lower(root.get("taxId")), "%" + normalized + "%");
            case "supplier.registrationNumber" -> cb.like(cb.lower(root.get("registrationNumber")), "%" + normalized + "%");
            case "supplier.countryOfIncorporation" -> cb.like(cb.lower(root.get("countryOfIncorporation")), "%" + normalized + "%");
            case "supplier.incorporationDate" -> {
                LocalDate parsed = parseDate(rawValue);
                if (parsed == null) throw new IllegalArgumentException("Invalid date value for incorporation date");
                yield cb.equal(root.get("incorporationDate"), parsed);
            }
            case "supplier.companyType" -> {
                CompanyType parsed = parseCompanyType(rawValue);
                if (parsed == null) throw new IllegalArgumentException("Invalid company type value");
                yield cb.equal(root.get("companyType"), parsed);
            }
            case "supplier.employeeCountRange" -> {
                EmployeeCountRange parsed = parseEmployeeCount(rawValue);
                if (parsed == null) throw new IllegalArgumentException("Invalid employee count value");
                yield cb.equal(root.get("employeeCountRange"), parsed);
            }
            case "supplier.annualRevenueRange" -> {
                AnnualRevenueRange parsed = parseAnnualRevenue(rawValue);
                if (parsed == null) throw new IllegalArgumentException("Invalid annual revenue value");
                yield cb.equal(root.get("annualRevenueRange"), parsed);
            }
            case "supplier.city" -> cb.like(cb.lower(root.get("city")), "%" + normalized + "%");
            case "supplier.stateProvince" -> cb.like(cb.lower(root.get("stateProvince")), "%" + normalized + "%");
            case "supplier.postalCode" -> cb.like(cb.lower(root.get("postalCode")), "%" + normalized + "%");
            case "supplier.country" -> cb.like(cb.lower(root.get("country")), "%" + normalized + "%");
            case "supplier.description" -> cb.like(cb.lower(root.get("description")), "%" + normalized + "%");
            case "supplier.status" -> {
                SupplierStatus parsed = parseStatus(rawValue);
                if (parsed == null) throw new IllegalArgumentException("Invalid supplier status value");
                yield cb.equal(root.get("status"), parsed);
            }
            case "user.email" -> cb.like(cb.lower(root.join("user").get("email")), "%" + normalized + "%");
            case "user.fullName" -> cb.like(cb.lower(root.join("user").get("fullName")), "%" + normalized + "%");
            default -> throw new IllegalArgumentException("Unsupported field: " + fieldKey);
        };
    }

    private Map<String, String> extractValues(SupplierProfile profile, List<SearchFieldPolicy> fields) {
        Map<String, String> values = new LinkedHashMap<>();
        for (SearchFieldPolicy field : fields) {
            values.put(field.fieldKey(), valueForField(profile, field.fieldKey()));
        }
        return values;
    }

    private String valueForField(SupplierProfile profile, String fieldKey) {
        return switch (fieldKey) {
            case "supplier.companyName" -> profile.getCompanyName();
            case "supplier.tradingName" -> profile.getTradingName();
            case "supplier.companyType" -> profile.getCompanyType() != null ? profile.getCompanyType().name() : null;
            case "supplier.vatNumber" -> profile.getVatNumber();
            case "supplier.taxId" -> profile.getTaxId();
            case "supplier.registrationNumber" -> profile.getRegistrationNumber();
            case "supplier.countryOfIncorporation" -> profile.getCountryOfIncorporation();
            case "supplier.incorporationDate" -> profile.getIncorporationDate() != null ? profile.getIncorporationDate().toString() : null;
            case "supplier.website" -> profile.getWebsite();
            case "supplier.employeeCountRange" -> profile.getEmployeeCountRange() != null ? profile.getEmployeeCountRange().name() : null;
            case "supplier.annualRevenueRange" -> profile.getAnnualRevenueRange() != null ? profile.getAnnualRevenueRange().name() : null;
            case "supplier.addressLine1" -> profile.getAddressLine1();
            case "supplier.addressLine2" -> profile.getAddressLine2();
            case "supplier.city" -> profile.getCity();
            case "supplier.stateProvince" -> profile.getStateProvince();
            case "supplier.postalCode" -> profile.getPostalCode();
            case "supplier.description" -> profile.getDescription();
            case "supplier.country" -> profile.getCountry();
            case "supplier.status" -> profile.getStatus() != null ? profile.getStatus().name() : null;
            case "user.email" -> profile.getUser() != null ? profile.getUser().getEmail() : null;
            case "user.fullName" -> profile.getUser() != null ? profile.getUser().getFullName() : null;
            default -> null;
        };
    }

    private SupplierStatus parseStatus(String value) {
        try {
            return SupplierStatus.valueOf(value.toUpperCase());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private CompanyType parseCompanyType(String value) {
        try {
            return CompanyType.valueOf(value.toUpperCase());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private EmployeeCountRange parseEmployeeCount(String value) {
        try {
            return EmployeeCountRange.valueOf(value.toUpperCase());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private AnnualRevenueRange parseAnnualRevenue(String value) {
        try {
            return AnnualRevenueRange.valueOf(value.toUpperCase());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private LocalDate parseDate(String value) {
        try {
            return LocalDate.parse(value);
        } catch (Exception ex) {
            return null;
        }
    }

    private UserRole getCurrentUserRole() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null) {
            throw new IllegalStateException("No authentication found");
        }

        for (GrantedAuthority authority : authentication.getAuthorities()) {
            String roleName = authority.getAuthority();
            if (roleName != null && roleName.startsWith("ROLE_")) {
                return UserRole.valueOf(roleName.substring("ROLE_".length()));
            }
        }
        throw new IllegalStateException("Unable to resolve current authenticated user role");
    }
}
