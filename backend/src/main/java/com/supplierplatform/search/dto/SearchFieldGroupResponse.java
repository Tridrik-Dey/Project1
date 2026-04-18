package com.supplierplatform.search.dto;

import lombok.Builder;

import java.util.List;

@Builder
public record SearchFieldGroupResponse(
        String tableName,
        List<SearchFieldOptionResponse> fields
) {
}
