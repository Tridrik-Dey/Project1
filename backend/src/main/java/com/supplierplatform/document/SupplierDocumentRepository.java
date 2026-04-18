package com.supplierplatform.document;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;
import java.time.LocalDate;

@Repository
public interface SupplierDocumentRepository extends JpaRepository<SupplierDocument, UUID> {

    List<SupplierDocument> findBySupplierIdAndIsCurrentTrue(UUID supplierId);

    List<SupplierDocument> findBySupplierId(UUID supplierId);

    List<SupplierDocument> findBySupplierIdAndDocumentType(UUID supplierId, DocumentType documentType);

    List<SupplierDocument> findByIsCurrentTrueAndExpiryDateBetween(LocalDate fromInclusive, LocalDate toInclusive);
}
