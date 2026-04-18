package com.supplierplatform.supplier;

import com.supplierplatform.supplier.entity.SupplierContact;
import com.supplierplatform.supplier.enums.ContactType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SupplierContactRepository extends JpaRepository<SupplierContact, UUID> {

    List<SupplierContact> findBySupplierId(UUID supplierId);

    Optional<SupplierContact> findBySupplierIdAndIsPrimaryTrue(UUID supplierId);

    Optional<SupplierContact> findBySupplierIdAndContactType(UUID supplierId, ContactType contactType);
}
