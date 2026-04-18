package com.supplierplatform.contract;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.supplierplatform.review.ReviewAction;
import com.supplierplatform.review.ReviewService;
import com.supplierplatform.review.dto.ReviewRequest;
import com.supplierplatform.review.dto.ReviewResponse;
import com.supplierplatform.supplier.SupplierProfileRepository;
import com.supplierplatform.supplier.SupplierProfileService;
import com.supplierplatform.supplier.SupplierStatusService;
import com.supplierplatform.supplier.entity.SupplierProfile;
import com.supplierplatform.supplier.enums.SupplierStatus;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRepository;
import com.supplierplatform.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.PageImpl;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;
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
class AdminReviewControllerContractTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private SupplierProfileRepository supplierProfileRepository;

    @MockBean
    private SupplierProfileService supplierProfileService;

    @MockBean
    private SupplierStatusService supplierStatusService;

    @MockBean
    private ReviewService reviewService;

    @MockBean
    private UserRepository userRepository;

    private User adminUser;

    @BeforeEach
    void setAuthentication() {
        adminUser = new User();
        adminUser.setId(UUID.randomUUID());
        adminUser.setEmail("admin.contract@test.com");
        adminUser.setRole(UserRole.ADMIN);
        adminUser.setPasswordHash("hash");
        adminUser.setFullName("Admin Contract");
        adminUser.setIsActive(true);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(adminUser, null, adminUser.getAuthorities()));
        SecurityContextHolder.setContext(context);
    }

    @Test
    void queueEndpointReturnsPageContract() throws Exception {
        SupplierProfile profile = SupplierProfile.builder()
                .id(UUID.randomUUID())
                .status(SupplierStatus.PENDING)
                .submittedAt(LocalDateTime.now())
                .build();

        when(supplierProfileRepository.findByStatusIn(any(), any())).thenReturn(new PageImpl<>(List.of(profile)));
        when(supplierProfileService.toResponse(any(SupplierProfile.class)))
                .thenAnswer(invocation -> {
                    SupplierProfile p = invocation.getArgument(0);
                    return com.supplierplatform.supplier.dto.SupplierProfileResponse.builder()
                            .id(p.getId())
                            .status(SupplierStatus.PENDING)
                            .build();
                });

        mockMvc.perform(get("/api/admin/review/queue"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content[0].status").value("PENDING"))
                .andExpect(jsonPath("$.data.content[0].id").exists());
    }

    @Test
    void submitReviewReturnsExpectedContract() throws Exception {
        UUID supplierId = UUID.randomUUID();
        UUID reviewId = UUID.randomUUID();
        ReviewResponse reviewResponse = ReviewResponse.builder()
                .id(reviewId)
                .action(ReviewAction.APPROVED)
                .comment("Looks good")
                .previousStatus(SupplierStatus.PENDING)
                .newStatus(SupplierStatus.APPROVED)
                .reviewerName("Admin Contract")
                .createdAt(LocalDateTime.now())
                .build();

        when(reviewService.submitReview(eq(supplierId), any(ReviewRequest.class), eq(adminUser)))
                .thenReturn(reviewResponse);

        ReviewRequest request = new ReviewRequest();
        request.setAction(ReviewAction.APPROVED);
        request.setComment("Looks good");

        mockMvc.perform(post("/api/admin/review/suppliers/{id}/review", supplierId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Review submitted successfully"))
                .andExpect(jsonPath("$.data.id").value(reviewId.toString()))
                .andExpect(jsonPath("$.data.action").value("APPROVED"))
                .andExpect(jsonPath("$.data.previousStatus").value("PENDING"))
                .andExpect(jsonPath("$.data.newStatus").value("APPROVED"));
    }
}

