package com.supplierplatform.revamp.repository;

import com.supplierplatform.revamp.enums.ApplicationStatus;
import com.supplierplatform.revamp.model.RevampApplication;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RevampApplicationRepository extends JpaRepository<RevampApplication, UUID> {
    List<RevampApplication> findByApplicantUserId(UUID applicantUserId);
    Optional<RevampApplication> findFirstByApplicantUserIdOrderByUpdatedAtDesc(UUID applicantUserId);
    List<RevampApplication> findByStatus(ApplicationStatus status);
    Optional<RevampApplication> findByProtocolCode(String protocolCode);
    Optional<RevampApplication> findFirstByInviteIdOrderByUpdatedAtDesc(UUID inviteId);
}
