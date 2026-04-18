package com.supplierplatform.supplier;

import com.supplierplatform.category.ServiceCategory;
import com.supplierplatform.supplier.dto.SupplierProfileResponse;
import com.supplierplatform.supplier.entity.SupplierContact;
import com.supplierplatform.supplier.entity.SupplierProfile;
import com.supplierplatform.supplier.enums.CompanyType;
import com.supplierplatform.supplier.enums.ContactType;
import com.supplierplatform.supplier.enums.SupplierStatus;
import com.supplierplatform.user.User;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SupplierProfileMapperTest {

    @Mock
    private SupplierContactRepository supplierContactRepository;

    @InjectMocks
    private SupplierProfileMapper mapper;

    @Test
    void mapsProfileWithContactsAndOnlyActiveCategories() {
        UUID profileId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        User user = new User();
        user.setId(userId);
        user.setFullName("Supplier User");

        SupplierProfile profile = SupplierProfile.builder()
                .id(profileId)
                .user(user)
                .companyName("Acme SRL")
                .companyType(CompanyType.LLC)
                .status(SupplierStatus.DRAFT)
                .categories(Set.of(
                        ServiceCategory.builder().id(UUID.randomUUID()).code("A").name("Active").isActive(true).build(),
                        ServiceCategory.builder().id(UUID.randomUUID()).code("X").name("Inactive").isActive(false).build()
                ))
                .build();

        SupplierContact contact = SupplierContact.builder()
                .id(UUID.randomUUID())
                .supplier(profile)
                .contactType(ContactType.PRIMARY)
                .fullName("Mario Rossi")
                .email("mario.rossi@example.com")
                .phone("+39 3400000000")
                .createdAt(LocalDateTime.now())
                .build();

        when(supplierContactRepository.findBySupplierId(profileId)).thenReturn(List.of(contact));

        SupplierProfileResponse response = mapper.toResponse(profile);

        assertEquals(profileId, response.getId());
        assertEquals(userId, response.getUserId());
        assertEquals(1, response.getContacts().size());
        assertEquals("Mario Rossi", response.getContacts().get(0).getFullName());
        assertEquals(1, response.getCategories().size());
        assertEquals("A", response.getCategories().iterator().next().getCode());
        assertNull(response.getReviewerName());
    }
}

