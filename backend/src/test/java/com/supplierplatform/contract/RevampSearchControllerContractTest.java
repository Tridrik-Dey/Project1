package com.supplierplatform.contract;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.supplierplatform.search.SearchService;
import com.supplierplatform.search.dto.AdvancedSearchCriterionRequest;
import com.supplierplatform.search.dto.AdvancedSearchRequest;
import com.supplierplatform.search.dto.SearchResultRowResponse;
import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.service.RevampGovernanceAuthorizationService;
import com.supplierplatform.supplier.dto.SupplierProfileResponse;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
class RevampSearchControllerContractTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private SearchService searchService;

    @MockBean
    private RevampGovernanceAuthorizationService governanceAuthorizationService;

    @BeforeEach
    void setAuthentication() {
        User adminUser = new User();
        adminUser.setId(UUID.randomUUID());
        adminUser.setEmail("admin.revamp.search@test.com");
        adminUser.setRole(UserRole.ADMIN);
        adminUser.setPasswordHash("hash");
        adminUser.setFullName("Admin Revamp Search");
        adminUser.setIsActive(true);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(adminUser, null, adminUser.getAuthorities()));
        SecurityContextHolder.setContext(context);
        when(governanceAuthorizationService.requireAnyRole(any(), any(AdminRole[].class))).thenReturn(AdminRole.SUPER_ADMIN);
    }

    @Test
    void searchSuppliersReturnsExpectedContract() throws Exception {
        UUID supplierId = UUID.randomUUID();
        Page<SearchResultRowResponse> page = new PageImpl<>(
                List.of(SearchResultRowResponse.builder()
                        .supplierId(supplierId)
                        .status("ACTIVE")
                        .values(Map.of("supplier.companyName", "ACME"))
                        .build()),
                PageRequest.of(0, 20),
                1
        );
        when(searchService.searchSuppliersNormalized(eq("acme"), eq(List.of("supplier.companyName")), any(), anyBoolean()))
                .thenReturn(page);

        mockMvc.perform(get("/api/v2/search/suppliers")
                        .param("q", "acme")
                        .param("fields", "supplier.companyName")
                        .param("page", "0")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content[0].supplierId").value(supplierId.toString()))
                .andExpect(jsonPath("$.data.content[0].status").value("ACTIVE"));
    }

    @Test
    void advancedSearchReturnsExpectedContract() throws Exception {
        SupplierProfileResponse supplier = SupplierProfileResponse.builder()
                .id(UUID.randomUUID())
                .companyName("Beta SRL")
                .build();
        Page<SupplierProfileResponse> page = new PageImpl<>(List.of(supplier), PageRequest.of(0, 20), 1);
        when(searchService.searchSuppliersAdvanced(any(), any(), anyBoolean())).thenReturn(page);

        AdvancedSearchCriterionRequest criterion = new AdvancedSearchCriterionRequest();
        criterion.setFieldKey("supplier.companyName");
        criterion.setValue("beta");
        AdvancedSearchRequest request = new AdvancedSearchRequest();
        request.setCriteria(List.of(criterion));
        request.setPage(0);
        request.setSize(20);

        mockMvc.perform(post("/api/v2/search/advanced")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content[0].companyName").value("Beta SRL"));
    }

}

