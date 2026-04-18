package com.supplierplatform.contract;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.supplierplatform.revamp.api.dto.CreateEvaluationRequest;
import com.supplierplatform.revamp.dto.RevampEvaluationAggregateDto;
import com.supplierplatform.revamp.dto.RevampEvaluationSummaryDto;
import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.service.RevampGovernanceAuthorizationService;
import com.supplierplatform.revamp.service.RevampEvaluationService;
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

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
class RevampEvaluationControllerContractTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private RevampEvaluationService evaluationService;

    @MockBean
    private RevampGovernanceAuthorizationService governanceAuthorizationService;

    private User adminUser;

    @BeforeEach
    void setAuthentication() {
        adminUser = new User();
        adminUser.setId(UUID.randomUUID());
        adminUser.setEmail("admin.revamp.eval@test.com");
        adminUser.setRole(UserRole.ADMIN);
        adminUser.setPasswordHash("hash");
        adminUser.setFullName("Admin Revamp Eval");
        adminUser.setIsActive(true);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(adminUser, null, adminUser.getAuthorities()));
        SecurityContextHolder.setContext(context);
        when(governanceAuthorizationService.requireAnyRole(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(AdminRole[].class)))
                .thenReturn(AdminRole.SUPER_ADMIN);
    }

    @Test
    void submitReturnsExpectedContract() throws Exception {
        UUID profileId = UUID.randomUUID();
        UUID evalId = UUID.randomUUID();
        RevampEvaluationSummaryDto dto = new RevampEvaluationSummaryDto(
                evalId,
                profileId,
                adminUser.getId(),
                (short) 4,
                false,
                LocalDateTime.now()
        );
        CreateEvaluationRequest request = new CreateEvaluationRequest();
        request.setSupplierRegistryProfileId(profileId);
        request.setCollaborationType("CONSULTING");
        request.setCollaborationPeriod("2026-04");
        request.setReferenceCode("REF-77");
        request.setOverallScore((short) 4);
        request.setComment("Good");
        request.setDimensions(Map.of("quality", (short) 5));

        when(evaluationService.submitEvaluation(
                eq(profileId),
                eq(adminUser.getId()),
                eq("CONSULTING"),
                eq("2026-04"),
                eq("REF-77"),
                eq((short) 4),
                eq("Good"),
                eq(request.getDimensions())
        )).thenReturn(dto);

        mockMvc.perform(post("/api/v2/evaluations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Evaluation submitted"))
                .andExpect(jsonPath("$.data.id").value(evalId.toString()))
                .andExpect(jsonPath("$.data.overallScore").value(4));
    }

    @Test
    void listReturnsExpectedContract() throws Exception {
        UUID profileId = UUID.randomUUID();
        UUID evalId = UUID.randomUUID();
        RevampEvaluationSummaryDto row = new RevampEvaluationSummaryDto(
                evalId,
                profileId,
                adminUser.getId(),
                (short) 5,
                false,
                LocalDateTime.now()
        );
        when(evaluationService.listBySupplier(eq(profileId))).thenReturn(List.of(row));

        mockMvc.perform(get("/api/v2/evaluations").param("supplierId", profileId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].id").value(evalId.toString()))
                .andExpect(jsonPath("$.data[0].supplierRegistryProfileId").value(profileId.toString()));
    }

    @Test
    void summaryReturnsExpectedContract() throws Exception {
        UUID profileId = UUID.randomUUID();
        RevampEvaluationAggregateDto dto = new RevampEvaluationAggregateDto(profileId, 10, 8, 4.25);
        when(evaluationService.summaryBySupplier(eq(profileId))).thenReturn(dto);

        mockMvc.perform(get("/api/v2/evaluations/summary").param("supplierId", profileId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.supplierRegistryProfileId").value(profileId.toString()))
                .andExpect(jsonPath("$.data.totalEvaluations").value(10))
                .andExpect(jsonPath("$.data.activeEvaluations").value(8))
                .andExpect(jsonPath("$.data.averageOverallScore").value(4.25));
    }

    @Test
    void annulReturnsExpectedContract() throws Exception {
        UUID evalId = UUID.randomUUID();
        UUID profileId = UUID.randomUUID();
        RevampEvaluationSummaryDto dto = new RevampEvaluationSummaryDto(
                evalId,
                profileId,
                adminUser.getId(),
                (short) 3,
                true,
                LocalDateTime.now()
        );
        when(evaluationService.annul(eq(evalId), eq(adminUser.getId()))).thenReturn(dto);

        mockMvc.perform(post("/api/v2/evaluations/{evaluationId}/annul", evalId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Evaluation annulled"))
                .andExpect(jsonPath("$.data.annulled").value(true));
    }

    @Test
    void listAliasPathReturnsExpectedContract() throws Exception {
        UUID profileId = UUID.randomUUID();
        UUID evalId = UUID.randomUUID();
        RevampEvaluationSummaryDto row = new RevampEvaluationSummaryDto(
                evalId,
                profileId,
                adminUser.getId(),
                (short) 5,
                false,
                LocalDateTime.now()
        );
        when(evaluationService.listBySupplier(eq(profileId))).thenReturn(List.of(row));

        mockMvc.perform(get("/api/evaluations").param("supplierId", profileId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].id").value(evalId.toString()))
                .andExpect(jsonPath("$.data[0].supplierRegistryProfileId").value(profileId.toString()));
    }
}

