package com.supplierplatform.revamp.repository;

import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.model.RevampUserAdminRole;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RevampUserAdminRoleRepository extends JpaRepository<RevampUserAdminRole, UUID> {
    List<RevampUserAdminRole> findByUserId(UUID userId);
    List<RevampUserAdminRole> findByAdminRole(AdminRole adminRole);
    boolean existsByUserIdAndAdminRole(UUID userId, AdminRole adminRole);
    long deleteByUserIdAndAdminRole(UUID userId, AdminRole adminRole);
    long deleteByUserId(UUID userId);
}
