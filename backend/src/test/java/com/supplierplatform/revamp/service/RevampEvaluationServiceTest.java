package com.supplierplatform.revamp.service;

import com.supplierplatform.revamp.dto.RevampEvaluationSummaryDto;
import com.supplierplatform.revamp.mapper.RevampEvaluationMapper;
import com.supplierplatform.revamp.model.RevampEvaluation;
import com.supplierplatform.revamp.model.RevampEvaluationDimension;
import com.supplierplatform.revamp.model.RevampSupplierRegistryProfile;
import com.supplierplatform.revamp.repository.RevampEvaluationDimensionRepository;
import com.supplierplatform.revamp.repository.RevampEvaluationRepository;
import com.supplierplatform.revamp.repository.RevampSupplierRegistryProfileRepository;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RevampEvaluationServiceTest {

    @Mock
    private RevampEvaluationRepository evaluationRepository;
    @Mock
    private RevampEvaluationDimensionRepository evaluationDimensionRepository;
    @Mock
    private RevampSupplierRegistryProfileRepository supplierRegistryProfileRepository;
    @Mock
    private UserRepository userRepository;
    @Spy
    private RevampEvaluationMapper evaluationMapper = new RevampEvaluationMapper();

    @InjectMocks
    private RevampEvaluationService evaluationService;

    @Test
    void submitEvaluationStoresEvaluationAndDimensions() {
        UUID profileId = UUID.randomUUID();
        UUID evaluatorId = UUID.randomUUID();

        RevampSupplierRegistryProfile profile = new RevampSupplierRegistryProfile();
        profile.setId(profileId);
        User evaluator = new User();
        evaluator.setId(evaluatorId);

        when(evaluationRepository.findBySupplierRegistryProfileIdAndEvaluatorUserIdAndCollaborationPeriod(
                profileId, evaluatorId, "2026-03"
        )).thenReturn(Optional.empty());
        when(supplierRegistryProfileRepository.findById(profileId)).thenReturn(Optional.of(profile));
        when(userRepository.findById(evaluatorId)).thenReturn(Optional.of(evaluator));
        when(evaluationRepository.save(any(RevampEvaluation.class))).thenAnswer(invocation -> {
            RevampEvaluation e = invocation.getArgument(0);
            e.setId(UUID.randomUUID());
            return e;
        });
        when(evaluationDimensionRepository.save(any(RevampEvaluationDimension.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RevampEvaluationSummaryDto dto = evaluationService.submitEvaluation(
                profileId,
                evaluatorId,
                "CONSULTING",
                "2026-03",
                "REF-001",
                (short) 4,
                "Good",
                Map.of("quality", (short) 5, "timeliness", (short) 4)
        );

        assertEquals(profileId, dto.supplierRegistryProfileId());
        assertEquals(evaluatorId, dto.evaluatorUserId());
        assertEquals(4, dto.overallScore());

        ArgumentCaptor<RevampEvaluationDimension> dimCaptor = ArgumentCaptor.forClass(RevampEvaluationDimension.class);
        verify(evaluationDimensionRepository, org.mockito.Mockito.times(2)).save(dimCaptor.capture());
    }

    @Test
    void submitEvaluationRejectsDuplicateSupplierEvaluatorPeriod() {
        UUID profileId = UUID.randomUUID();
        UUID evaluatorId = UUID.randomUUID();

        when(evaluationRepository.findBySupplierRegistryProfileIdAndEvaluatorUserIdAndCollaborationPeriod(
                profileId, evaluatorId, "2026-03"
        )).thenReturn(Optional.of(new RevampEvaluation()));

        assertThrows(IllegalStateException.class, () -> evaluationService.submitEvaluation(
                profileId,
                evaluatorId,
                "CONSULTING",
                "2026-03",
                null,
                (short) 3,
                null,
                Map.of()
        ));
    }
}


