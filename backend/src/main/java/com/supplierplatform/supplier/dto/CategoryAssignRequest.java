package com.supplierplatform.supplier.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

import java.util.List;
import java.util.UUID;

@Getter
@Setter
public class CategoryAssignRequest {

    @NotEmpty(message = "At least one category must be selected")
    private List<UUID> categoryIds;
}
