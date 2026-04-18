package com.supplierplatform.supplier;

import com.supplierplatform.common.EntityNotFoundException;
import com.supplierplatform.supplier.dto.SupplierContactRequest;
import com.supplierplatform.supplier.entity.SupplierContact;
import com.supplierplatform.supplier.entity.SupplierProfile;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SupplierContactService {

    private final SupplierContactRepository supplierContactRepository;

    public SupplierContact getById(UUID contactId) {
        return supplierContactRepository.findById(contactId)
                .orElseThrow(() -> new EntityNotFoundException("SupplierContact", contactId));
    }

    public void addContact(SupplierProfile profile, SupplierContactRequest request) {
        UUID supplierId = profile.getId();

        List<SupplierContact> existingContacts = supplierContactRepository.findBySupplierId(supplierId);
        if (existingContacts.size() >= com.supplierplatform.supplier.enums.ContactType.values().length) {
            throw new IllegalStateException("Maximum contacts reached for this supplier");
        }

        supplierContactRepository
                .findBySupplierIdAndContactType(supplierId, request.getContactType())
                .ifPresent(existing -> {
                    throw new IllegalStateException("Contact type already exists for this supplier: " + existing.getContactType());
                });

        if (Boolean.TRUE.equals(request.getIsPrimary())) {
            supplierContactRepository
                    .findBySupplierIdAndIsPrimaryTrue(supplierId)
                    .ifPresent(existingPrimary -> {
                        throw new IllegalStateException("Primary contact already exists for this supplier");
                    });
        }

        SupplierContact contact = SupplierContact.builder()
                .supplier(profile)
                .contactType(request.getContactType())
                .fullName(request.getFullName())
                .jobTitle(request.getJobTitle())
                .email(request.getEmail())
                .phone(request.getPhone())
                .isPrimary(Boolean.TRUE.equals(request.getIsPrimary()))
                .build();

        supplierContactRepository.save(contact);
    }

    public void delete(SupplierContact contact) {
        supplierContactRepository.delete(contact);
    }
}
