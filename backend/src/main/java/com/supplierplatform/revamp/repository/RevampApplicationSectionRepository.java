package com.supplierplatform.revamp.repository;

import com.supplierplatform.revamp.model.RevampApplicationSection;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RevampApplicationSectionRepository extends JpaRepository<RevampApplicationSection, UUID> {
    List<RevampApplicationSection> findByApplicationIdAndIsLatestTrue(UUID applicationId);
    Optional<RevampApplicationSection> findByApplicationIdAndSectionKeyAndIsLatestTrue(UUID applicationId, String sectionKey);
    Optional<RevampApplicationSection> findTopByApplicationIdAndSectionKeyOrderBySectionVersionDesc(UUID applicationId, String sectionKey);
}
