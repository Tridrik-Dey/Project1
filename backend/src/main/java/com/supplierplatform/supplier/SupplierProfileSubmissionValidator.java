package com.supplierplatform.supplier;

import com.supplierplatform.document.SupplierDocument;
import com.supplierplatform.document.SupplierDocumentRepository;
import com.supplierplatform.supplier.entity.SupplierContact;
import com.supplierplatform.supplier.entity.SupplierProfile;
import com.supplierplatform.validation.ItalianBusinessValidators;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
@RequiredArgsConstructor
public class SupplierProfileSubmissionValidator {

    private final SupplierContactRepository supplierContactRepository;
    private final SupplierDocumentRepository supplierDocumentRepository;

    public void validateCompletenessForSubmission(SupplierProfile profile) {
        List<String> issues = new ArrayList<>();

        if (isBlank(profile.getCompanyName())) issues.add("company name");
        if (isBlank(profile.getCountry())) issues.add("country");
        if (isBlank(profile.getTradingName())) issues.add("trading name");
        if (profile.getCompanyType() == null) issues.add("company type");
        if (isBlank(profile.getRegistrationNumber())) issues.add("registration number");
        if (isBlank(profile.getTaxId())) issues.add("tax ID");
        if (isBlank(profile.getVatNumber())) issues.add("VAT number");
        if (isBlank(profile.getCountryOfIncorporation())) issues.add("country of incorporation");
        if (profile.getIncorporationDate() == null) issues.add("incorporation date");
        if (isBlank(profile.getWebsite())) issues.add("website");
        if (profile.getEmployeeCountRange() == null) issues.add("employee count range");
        if (profile.getAnnualRevenueRange() == null) issues.add("annual revenue range");
        if (isBlank(profile.getAddressLine1())) issues.add("address line 1");
        if (isBlank(profile.getAddressLine2())) issues.add("address line 2");
        if (isBlank(profile.getCity())) issues.add("city");
        if (isBlank(profile.getStateProvince())) issues.add("state/province");
        if (isBlank(profile.getPostalCode())) issues.add("postal code");

        if (profile.getCategories() == null || profile.getCategories().isEmpty()) {
            issues.add("at least one category");
        }

        List<SupplierContact> contacts = supplierContactRepository.findBySupplierId(profile.getId());
        if (contacts.isEmpty()) {
            issues.add("at least one contact");
        } else {
            boolean hasInvalidContact = contacts.stream().anyMatch(c -> isBlank(c.getEmail()) || isBlank(c.getPhone()));
            if (hasInvalidContact) {
                issues.add("valid contact email and phone");
            }
        }

        List<SupplierDocument> currentDocuments = supplierDocumentRepository.findBySupplierIdAndIsCurrentTrue(profile.getId());
        if (currentDocuments.isEmpty()) {
            issues.add("at least one current document");
        }

        if (ItalianBusinessValidators.isItalianBusiness(profile.getCountry(), profile.getCountryOfIncorporation())) {
            if (!ItalianBusinessValidators.isRegistrationNumberValid(profile.getRegistrationNumber())) {
                issues.add("valid Italian registration number");
            }
            if (!ItalianBusinessValidators.isTaxIdValid(profile.getTaxId())) {
                issues.add("valid Italian tax ID (16 alphanumeric or 11 digits)");
            }
            if (!ItalianBusinessValidators.isVatNumberValid(profile.getVatNumber())) {
                issues.add("valid Italian VAT number (11 digits)");
            }
        }

        if (!issues.isEmpty()) {
            throw new IllegalStateException("Complete all required sections before submission. Missing/invalid: " + String.join(", ", issues));
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
