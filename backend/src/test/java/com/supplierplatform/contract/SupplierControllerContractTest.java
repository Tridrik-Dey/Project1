package com.supplierplatform.contract;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.supplierplatform.supplier.SupplierProfileService;
import com.supplierplatform.supplier.dto.SupplierProfileRequest;
import com.supplierplatform.supplier.dto.SupplierProfileResponse;
import com.supplierplatform.supplier.enums.SupplierStatus;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
class SupplierControllerContractTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private SupplierProfileService supplierProfileService;

    private User supplierUser;

    @BeforeEach
    void setAuthentication() {
        supplierUser = new User();
        supplierUser.setId(UUID.randomUUID());
        supplierUser.setEmail("supplier.contract@test.com");
        supplierUser.setRole(UserRole.SUPPLIER);
        supplierUser.setPasswordHash("hash");
        supplierUser.setFullName("Supplier Contract");
        supplierUser.setIsActive(true);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(supplierUser, null, supplierUser.getAuthorities()));
        SecurityContextHolder.setContext(context);
    }

    @Test
    void updateProfileReturnsExpectedContract() throws Exception {
        UUID profileId = UUID.randomUUID();
        SupplierProfileResponse existing = SupplierProfileResponse.builder()
                .id(profileId)
                .userId(supplierUser.getId())
                .status(SupplierStatus.DRAFT)
                .build();
        SupplierProfileResponse updated = SupplierProfileResponse.builder()
                .id(profileId)
                .userId(supplierUser.getId())
                .companyName("Contract SRL")
                .country("Italy")
                .status(SupplierStatus.DRAFT)
                .build();

        when(supplierProfileService.getProfileByUserId(eq(supplierUser.getId()))).thenReturn(existing, existing);
        when(supplierProfileService.updateProfile(eq(profileId), any(SupplierProfileRequest.class), eq(supplierUser)))
                .thenReturn(updated);

        SupplierProfileRequest request = new SupplierProfileRequest();
        request.setCompanyName("Contract SRL");
        request.setCountry("France");

        mockMvc.perform(put("/api/supplier/profile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Profile updated successfully"))
                .andExpect(jsonPath("$.data.id").value(profileId.toString()))
                .andExpect(jsonPath("$.data.companyName").value("Contract SRL"))
                .andExpect(jsonPath("$.data.country").value("Italy"))
                .andExpect(jsonPath("$.data.status").value("DRAFT"));
    }
}

