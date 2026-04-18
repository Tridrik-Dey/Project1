package com.supplierplatform.supplier.dto;

import com.supplierplatform.supplier.enums.ContactType;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SupplierContactRequest {

    @NotBlank(message = "Full name is required")
    private String fullName;

    @Email(message = "Contact email must be valid")
    @Pattern(
            regexp = "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$",
            message = "Contact email must include a valid domain suffix (e.g. .com, .it)"
    )
    private String email;

    @NotNull(message = "Contact type is required")
    private ContactType contactType;

    private String jobTitle;

    @Pattern(regexp = "^\\+[0-9]{1,4}\\s[0-9]{6,15}$", message = "Phone must include country code and valid number")
    private String phone;

    private Boolean isPrimary = false;
}
