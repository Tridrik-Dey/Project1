package com.supplierplatform.search.dto;

import lombok.Builder;

@Builder
public record SearchFieldOptionResponse(
        String fieldKey,
        String label,
        String tableName,
        String columnName,
        String dataType,
        String matchMode,
        boolean exportable
) {
}
