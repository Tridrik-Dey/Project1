package com.supplierplatform.revamp.service;

import com.supplierplatform.revamp.dto.RevampReportKpisDto;
import com.supplierplatform.revamp.enums.ApplicationStatus;
import com.supplierplatform.revamp.enums.InviteStatus;
import com.supplierplatform.revamp.repository.RevampApplicationRepository;
import com.supplierplatform.revamp.repository.RevampInviteRepository;
import com.supplierplatform.search.SearchService;
import com.supplierplatform.supplier.SupplierProfileRepository;
import com.supplierplatform.supplier.enums.SupplierStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.util.List;

@Service
@RequiredArgsConstructor
public class RevampReportService {

    private final SupplierProfileRepository supplierProfileRepository;
    private final RevampApplicationRepository applicationRepository;
    private final RevampInviteRepository inviteRepository;
    private final SearchService searchService;

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
}
