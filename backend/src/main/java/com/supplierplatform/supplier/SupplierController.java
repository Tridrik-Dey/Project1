package com.supplierplatform.supplier;

import com.supplierplatform.common.ApiResponse;
import com.supplierplatform.supplier.dto.*;
import com.supplierplatform.user.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/supplier")
@PreAuthorize("hasRole('SUPPLIER')")
@RequiredArgsConstructor
public class SupplierController {

    private final SupplierProfileService supplierProfileService;

    @GetMapping("/profile")
    public ResponseEntity<ApiResponse<SupplierProfileResponse>> getProfile() {
        User currentUser = getCurrentUser();
        SupplierProfileResponse response = supplierProfileService.getProfileByUserId(currentUser.getId());
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @PutMapping("/profile")
    public ResponseEntity<ApiResponse<SupplierProfileResponse>> updateProfile(
            @Valid @RequestBody SupplierProfileRequest request) {
        User currentUser = getCurrentUser();
        SupplierProfileResponse existing = supplierProfileService.getProfileByUserId(currentUser.getId());
        SupplierProfileResponse response = supplierProfileService.updateProfile(existing.getId(), request, currentUser);
        return ResponseEntity.ok(ApiResponse.ok("Profile updated successfully", response));
    }

    @PostMapping("/profile/submit")
    public ResponseEntity<ApiResponse<SupplierProfileResponse>> submitProfile() {
        User currentUser = getCurrentUser();
        SupplierProfileResponse existing = supplierProfileService.getProfileByUserId(currentUser.getId());
        SupplierProfileResponse response = supplierProfileService.submitProfile(existing.getId(), currentUser);
        return ResponseEntity.ok(ApiResponse.ok("Profile submitted for review", response));
    }

    @PostMapping("/profile/categories")
    public ResponseEntity<ApiResponse<SupplierProfileResponse>> assignCategories(
            @Valid @RequestBody CategoryAssignRequest request) {
        User currentUser = getCurrentUser();
        SupplierProfileResponse existing = supplierProfileService.getProfileByUserId(currentUser.getId());
        SupplierProfileResponse response = supplierProfileService.assignCategories(existing.getId(), request.getCategoryIds(), currentUser);
        return ResponseEntity.ok(ApiResponse.ok("Categories assigned successfully", response));
    }

    @PostMapping("/profile/contacts")
    public ResponseEntity<ApiResponse<SupplierProfileResponse>> addContact(
            @Valid @RequestBody SupplierContactRequest request) {
        User currentUser = getCurrentUser();
        SupplierProfileResponse existing = supplierProfileService.getProfileByUserId(currentUser.getId());
        SupplierProfileResponse response = supplierProfileService.addContact(existing.getId(), request, currentUser);
        return ResponseEntity.ok(ApiResponse.ok("Contact added successfully", response));
    }

    @DeleteMapping("/profile/contacts/{contactId}")
    public ResponseEntity<ApiResponse<Void>> removeContact(@PathVariable UUID contactId) {
        User currentUser = getCurrentUser();
        supplierProfileService.removeContact(contactId, currentUser);
        return ResponseEntity.ok(ApiResponse.ok("Contact removed successfully", null));
    }

    private User getCurrentUser() {
        return (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }
}
