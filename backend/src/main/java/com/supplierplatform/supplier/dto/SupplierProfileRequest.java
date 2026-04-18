package com.supplierplatform.supplier.dto;

import com.supplierplatform.supplier.enums.AnnualRevenueRange;
import com.supplierplatform.supplier.enums.CompanyType;
import com.supplierplatform.supplier.enums.EmployeeCountRange;
import com.supplierplatform.supplier.enums.PreferredLanguage;
import com.supplierplatform.validation.ItalianBusinessValidators;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.AssertTrue;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
public class SupplierProfileRequest {

    @NotBlank(message = "Company name is required")
    private String companyName;

    private String tradingName;

    private CompanyType companyType;

    private String registrationNumber;

    private String vatNumber;

    private String taxId;

    private String countryOfIncorporation;

    private LocalDate incorporationDate;

    private String website;

    private String description;

    private EmployeeCountRange employeeCountRange;

    private AnnualRevenueRange annualRevenueRange;

    private String addressLine1;

    private String addressLine2;

    private String city;

    private String stateProvince;

    private String postalCode;

    @NotBlank(message = "Country is required")
    private String country;

    private PreferredLanguage preferredLanguage;

    @AssertTrue(message = "For Italian businesses, registration number is required and must be valid")
    public boolean isItalianRegistrationNumberValid() {
        if (!isItalianBusiness()) return true;
        return ItalianBusinessValidators.isRegistrationNumberValid(registrationNumber);
    }

    @AssertTrue(message = "For Italian businesses, tax ID is required and must be valid")
    public boolean isItalianTaxIdValid() {
        if (!isItalianBusiness()) return true;
        return ItalianBusinessValidators.isTaxIdValid(taxId);
    }

    @AssertTrue(message = "For Italian businesses, VAT number must be exactly 11 digits")
    public boolean isItalianVatNumberValid() {
        if (!isItalianBusiness()) return true;
        return ItalianBusinessValidators.isVatNumberValid(vatNumber);
    }

    private boolean isItalianBusiness() {
        return ItalianBusinessValidators.isItalianBusiness(country, countryOfIncorporation);
    }
}
