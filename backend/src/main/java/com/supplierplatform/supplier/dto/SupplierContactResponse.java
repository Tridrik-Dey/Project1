package com.supplierplatform.supplier.dto;

import com.supplierplatform.supplier.enums.ContactType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SupplierContactResponse {

    private UUID id;
    private ContactType contactType;
    private String fullName;
    private String jobTitle;
    private String email;
    private String phone;
    private Boolean isPrimary;
    private LocalDateTime createdAt;
}
