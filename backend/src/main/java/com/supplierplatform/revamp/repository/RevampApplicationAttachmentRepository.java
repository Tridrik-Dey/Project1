package com.supplierplatform.revamp.repository;

import com.supplierplatform.revamp.model.RevampApplicationAttachment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RevampApplicationAttachmentRepository extends JpaRepository<RevampApplicationAttachment, UUID> {
    List<RevampApplicationAttachment> findByApplicationId(UUID applicationId);
    List<RevampApplicationAttachment> findByApplicationIdAndSectionKey(UUID applicationId, String sectionKey);
    void deleteByApplicationIdAndSectionKey(UUID applicationId, String sectionKey);
}
