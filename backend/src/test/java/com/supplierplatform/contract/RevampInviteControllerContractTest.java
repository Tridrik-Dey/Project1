package com.supplierplatform.contract;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.supplierplatform.revamp.api.dto.CreateInviteRequest;
import com.supplierplatform.revamp.dto.RevampInviteListRowDto;
import com.supplierplatform.revamp.dto.RevampInviteMonitorDto;
import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.enums.InviteStatus;
import com.supplierplatform.revamp.enums.RegistryType;
import com.supplierplatform.revamp.model.RevampInvite;
import com.supplierplatform.revamp.service.RevampGovernanceAuthorizationService;
import com.supplierplatform.revamp.service.RevampInviteService;
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
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
class RevampInviteControllerContractTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private RevampInviteService inviteService;

    @MockBean
    private RevampGovernanceAuthorizationService governanceAuthorizationService;

    private User adminUser;

    @BeforeEach
    void setAuthentication() {
        adminUser = new User();
        adminUser.setId(UUID.randomUUID());
        adminUser.setEmail("admin.revamp.contract@test.com");
        adminUser.setRole(UserRole.ADMIN);
        adminUser.setPasswordHash("hash");
        adminUser.setFullName("Admin Revamp Contract");
        adminUser.setIsActive(true);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(adminUser, null, adminUser.getAuthorities()));
        SecurityContextHolder.setContext(context);
        when(governanceAuthorizationService.requireAnyRole(any(), any(AdminRole[].class))).thenReturn(AdminRole.SUPER_ADMIN);
    }

    @Test
    void createInviteReturnsExpectedContract() throws Exception {
        UUID inviteId = UUID.randomUUID();
        LocalDateTime expiresAt = LocalDateTime.now().plusDays(30);
        RevampInvite invite = new RevampInvite();
        invite.setId(inviteId);
        invite.setToken("testtoken123");
        invite.setStatus(InviteStatus.CREATED);
        invite.setRegistryType(RegistryType.ALBO_A);
        invite.setInvitedEmail("invited@test.com");
        invite.setExpiresAt(expiresAt);

        when(inviteService.createInvite(
                eq(RegistryType.ALBO_A),
                eq("invited@test.com"),
                eq("Invited Name"),
                eq(adminUser.getId()),
                any(LocalDateTime.class),
                eq("note")
        )).thenReturn(invite);

        CreateInviteRequest request = new CreateInviteRequest();
        request.setRegistryType(RegistryType.ALBO_A);
        request.setInvitedEmail("invited@test.com");
        request.setInvitedName("Invited Name");
        request.setExpiresInDays(30);
        request.setNote("note");

        mockMvc.perform(post("/api/v2/invites")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Invite created"))
                .andExpect(jsonPath("$.data.id").value(inviteId.toString()))
                .andExpect(jsonPath("$.data.token").value("testtoken123"))
                .andExpect(jsonPath("$.data.status").value("CREATED"))
                .andExpect(jsonPath("$.data.registryType").value("ALBO_A"))
                .andExpect(jsonPath("$.data.invitedEmail").value("invited@test.com"))
                .andExpect(jsonPath("$.data.expiresAt").exists());
    }

    @Test
    void getInviteByTokenReturnsExpectedContract() throws Exception {
        UUID inviteId = UUID.randomUUID();
        RevampInvite invite = new RevampInvite();
        invite.setId(inviteId);
        invite.setStatus(InviteStatus.OPENED);
        invite.setRegistryType(RegistryType.ALBO_B);
        invite.setInvitedEmail("company@test.com");
        invite.setExpiresAt(LocalDateTime.now().plusDays(10));

        when(inviteService.getByToken("token-xyz")).thenReturn(invite);

        mockMvc.perform(get("/api/v2/invites/token/token-xyz"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Success"))
                .andExpect(jsonPath("$.data.id").value(inviteId.toString()))
                .andExpect(jsonPath("$.data.status").value("OPENED"))
                .andExpect(jsonPath("$.data.registryType").value("ALBO_B"))
                .andExpect(jsonPath("$.data.invitedEmail").value("company@test.com"))
                .andExpect(jsonPath("$.data.expiresAt").exists());
    }

    @Test
    void getInviteByTokenAliasPathReturnsExpectedContract() throws Exception {
        UUID inviteId = UUID.randomUUID();
        RevampInvite invite = new RevampInvite();
        invite.setId(inviteId);
        invite.setStatus(InviteStatus.OPENED);
        invite.setRegistryType(RegistryType.ALBO_B);
        invite.setInvitedEmail("company@test.com");
        invite.setExpiresAt(LocalDateTime.now().plusDays(10));

        when(inviteService.getByToken("token-xyz")).thenReturn(invite);

        mockMvc.perform(get("/api/invites/token/token-xyz"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Success"))
                .andExpect(jsonPath("$.data.id").value(inviteId.toString()))
                .andExpect(jsonPath("$.data.status").value("OPENED"))
                .andExpect(jsonPath("$.data.registryType").value("ALBO_B"))
                .andExpect(jsonPath("$.data.invitedEmail").value("company@test.com"))
                .andExpect(jsonPath("$.data.expiresAt").exists());
    }

    @Test
    void monitorInvitesReturnsExpectedContract() throws Exception {
        UUID inviteId = UUID.randomUUID();
        RevampInviteListRowDto row = new RevampInviteListRowDto(
                inviteId,
                "Mario Bianchi",
                "mario@test.com",
                "ALBO_A",
                "OPENED",
                "IN_COMPILAZIONE",
                55,
                LocalDateTime.now().minusDays(2),
                LocalDateTime.now().plusDays(20),
                "Admin User",
                UUID.randomUUID(),
                "/admin/candidature/sample/review",
                false,
                true
        );
        RevampInviteMonitorDto dto = new RevampInviteMonitorDto(10, 3, 5, 2, java.util.List.of(row));
        when(inviteService.monitorInvites()).thenReturn(dto);

        mockMvc.perform(get("/api/v2/invites"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.totalInvites").value(10))
                .andExpect(jsonPath("$.data.completedInvites").value(3))
                .andExpect(jsonPath("$.data.rows[0].id").value(inviteId.toString()))
                .andExpect(jsonPath("$.data.rows[0].uiStatus").value("IN_COMPILAZIONE"));
    }

    @Test
    void renewInviteReturnsExpectedContract() throws Exception {
        UUID inviteId = UUID.randomUUID();
        LocalDateTime expiresAt = LocalDateTime.now().plusDays(30);
        RevampInvite renewed = new RevampInvite();
        renewed.setId(UUID.randomUUID());
        renewed.setToken("renewedtoken123");
        renewed.setStatus(InviteStatus.CREATED);
        renewed.setRegistryType(RegistryType.ALBO_B);
        renewed.setInvitedEmail("renew@test.com");
        renewed.setExpiresAt(expiresAt);

        when(inviteService.renewInvite(eq(inviteId), eq(adminUser.getId()), eq(30))).thenReturn(renewed);

        mockMvc.perform(post("/api/v2/invites/{inviteId}/renew", inviteId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expiresInDays\":30}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Invite renewed"))
                .andExpect(jsonPath("$.data.id").value(renewed.getId().toString()))
                .andExpect(jsonPath("$.data.token").value("renewedtoken123"))
                .andExpect(jsonPath("$.data.registryType").value("ALBO_B"));
    }
}

