package com.supplierplatform.supplier;

import com.supplierplatform.category.ServiceCategory;
import com.supplierplatform.document.SupplierDocument;
import com.supplierplatform.document.SupplierDocumentRepository;
import com.supplierplatform.supplier.entity.SupplierContact;
import com.supplierplatform.supplier.entity.SupplierProfile;
import com.supplierplatform.supplier.enums.AnnualRevenueRange;
import com.supplierplatform.supplier.enums.CompanyType;
import com.supplierplatform.supplier.enums.ContactType;
import com.supplierplatform.supplier.enums.EmployeeCountRange;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SupplierProfileSubmissionValidatorTest {

    @Mock
    private SupplierContactRepository supplierContactRepository;

    @Mock
    private SupplierDocumentRepository supplierDocumentRepository;

    @InjectMocks
    private SupplierProfileSubmissionValidator validator;

    @Test
    void validatesCompleteProfileWithoutThrowing() {
        SupplierProfile profile = createCompleteProfile();
        when(supplierContactRepository.findBySupplierId(profile.getId()))
                .thenReturn(List.of(validContact(profile)));
        when(supplierDocumentRepository.findBySupplierIdAndIsCurrentTrue(profile.getId()))
                .thenReturn(List.of(SupplierDocument.builder().id(UUID.randomUUID()).build()));

        assertDoesNotThrow(() -> validator.validateCompletenessForSubmission(profile));
    }

    @Test
    void throwsWhenCurrentDocumentIsMissing() {
        SupplierProfile profile = createCompleteProfile();
        when(supplierContactRepository.findBySupplierId(profile.getId()))
                .thenReturn(List.of(validContact(profile)));
        when(supplierDocumentRepository.findBySupplierIdAndIsCurrentTrue(profile.getId()))
                .thenReturn(List.of());

        try {
            validator.validateCompletenessForSubmission(profile);
            fail("Expected IllegalStateException");
        } catch (IllegalStateException ex) {
            assertTrue(ex.getMessage().contains("at least one current document"));
        }
    }

    @Test
    void throwsForInvalidItalianTaxIdFormat() {
        SupplierProfile profile = createCompleteProfile();
        profile.setTaxId("INVALID");
        when(supplierContactRepository.findBySupplierId(profile.getId()))
                .thenReturn(List.of(validContact(profile)));
        when(supplierDocumentRepository.findBySupplierIdAndIsCurrentTrue(profile.getId()))
                .thenReturn(List.of(SupplierDocument.builder().id(UUID.randomUUID()).build()));

        try {
            validator.validateCompletenessForSubmission(profile);
            fail("Expected IllegalStateException");
        } catch (IllegalStateException ex) {
            assertTrue(ex.getMessage().contains("valid Italian tax ID (16 alphanumeric or 11 digits)"));
        }
    }

    private SupplierProfile createCompleteProfile() {
        ServiceCategory category = ServiceCategory.builder()
                .id(UUID.randomUUID())
                .code("A")
                .name("Agriculture")
                .isActive(true)
                .build();

        return SupplierProfile.builder()
                .id(UUID.randomUUID())
                .companyName("Acme SRL")
                .country("Italy")
                .tradingName("Acme")
                .companyType(CompanyType.LLC)
                .registrationNumber("1234567890")
                .taxId("12345678901")
                .vatNumber("12345678901")
                .countryOfIncorporation("Italy")
                .incorporationDate(LocalDate.of(2020, 1, 1))
                .website("https://acme.example.com")
                .employeeCountRange(EmployeeCountRange.SMALL)
                .annualRevenueRange(AnnualRevenueRange._100K_500K)
                .addressLine1("Via Roma 1")
                .addressLine2("Piano 2")
                .city("Milan")
                .stateProvince("MI")
                .postalCode("20100")
                .categories(Set.of(category))
                .build();
    }

    private SupplierContact validContact(SupplierProfile profile) {
        return SupplierContact.builder()
                .id(UUID.randomUUID())
                .supplier(profile)
                .contactType(ContactType.PRIMARY)
                .fullName("Mario Rossi")
                .email("mario.rossi@example.com")
                .phone("+39 3400000000")
                .isPrimary(true)
                .build();
    }
}

