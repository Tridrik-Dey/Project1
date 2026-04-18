package com.supplierplatform.search;

import com.supplierplatform.search.dto.SearchFieldGroupResponse;
import com.supplierplatform.search.dto.SearchFieldOptionResponse;
import com.supplierplatform.search.policy.SearchFieldPolicy;
import com.supplierplatform.search.policy.SearchScopePolicy;
import com.supplierplatform.user.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SearchFieldService {

    private final SearchScopePolicy searchScopePolicy;

    public List<SearchFieldGroupResponse> getAvailableFields() {
        UserRole currentRole = getCurrentUserRole();

        Map<String, List<SearchFieldOptionResponse>> grouped = searchScopePolicy.getAllowedFields(currentRole).stream()
                .map(this::toOption)
                .collect(Collectors.groupingBy(SearchFieldOptionResponse::tableName));

        return grouped.entrySet().stream()
                .map(entry -> SearchFieldGroupResponse.builder()
                        .tableName(entry.getKey())
                        .fields(entry.getValue().stream()
                                .sorted(Comparator.comparing(SearchFieldOptionResponse::label))
                                .toList())
                        .build())
                .sorted(Comparator.comparing(SearchFieldGroupResponse::tableName))
                .toList();
    }

    private SearchFieldOptionResponse toOption(SearchFieldPolicy fieldPolicy) {
        return SearchFieldOptionResponse.builder()
                .fieldKey(fieldPolicy.fieldKey())
                .label(fieldPolicy.label())
                .tableName(fieldPolicy.tableName())
                .columnName(fieldPolicy.columnName())
                .dataType(fieldPolicy.dataType().name())
                .matchMode(fieldPolicy.matchMode().name())
                .exportable(fieldPolicy.exportable())
                .build();
    }

    private UserRole getCurrentUserRole() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null) {
            throw new IllegalStateException("No authentication found");
        }

        for (GrantedAuthority authority : authentication.getAuthorities()) {
            String roleName = authority.getAuthority();
            if (roleName != null && roleName.startsWith("ROLE_")) {
                return UserRole.valueOf(roleName.substring("ROLE_".length()));
            }
        }

        throw new IllegalStateException("Unable to resolve current authenticated user role");
    }
}
