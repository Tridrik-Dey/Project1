package com.supplierplatform.supplier;

import com.supplierplatform.common.EntityNotFoundException;
import com.supplierplatform.supplier.dto.SupplierContactRequest;
import com.supplierplatform.supplier.entity.SupplierContact;
import com.supplierplatform.supplier.entity.SupplierProfile;
import com.supplierplatform.supplier.enums.ContactType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SupplierContactServiceTest {

    @Mock
    private SupplierContactRepository supplierContactRepository;

    @InjectMocks
    private SupplierContactService supplierContactService;

    @Test
    void addContactSavesNewContactWhenConstraintsAreSatisfied() {
        UUID supplierId = UUID.randomUUID();
        SupplierProfile supplierProfile = SupplierProfile.builder().id(supplierId).build();

        when(supplierContactRepository.findBySupplierId(supplierId)).thenReturn(List.of());
        when(supplierContactRepository.findBySupplierIdAndContactType(supplierId, ContactType.PRIMARY))
                .thenReturn(Optional.empty());
        when(supplierContactRepository.findBySupplierIdAndIsPrimaryTrue(supplierId))
                .thenReturn(Optional.empty());

        SupplierContactRequest request = new SupplierContactRequest();
        request.setContactType(ContactType.PRIMARY);
        request.setFullName("Mario Rossi");
        request.setJobTitle("Manager");
        request.setEmail("mario.rossi@example.com");
        request.setPhone("+39 3400000000");
        request.setIsPrimary(true);

        supplierContactService.addContact(supplierProfile, request);

        ArgumentCaptor<SupplierContact> savedCaptor = ArgumentCaptor.forClass(SupplierContact.class);
        verify(supplierContactRepository).save(savedCaptor.capture());
        SupplierContact saved = savedCaptor.getValue();

        assertEquals(ContactType.PRIMARY, saved.getContactType());
        assertEquals("Mario Rossi", saved.getFullName());
        assertEquals("Manager", saved.getJobTitle());
        assertEquals("mario.rossi@example.com", saved.getEmail());
        assertEquals("+39 3400000000", saved.getPhone());
    }

    @Test
    void getByIdThrowsWhenMissing() {
        UUID contactId = UUID.randomUUID();
        when(supplierContactRepository.findById(contactId)).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class, () -> supplierContactService.getById(contactId));
    }
}

