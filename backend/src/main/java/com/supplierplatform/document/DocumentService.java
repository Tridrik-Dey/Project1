package com.supplierplatform.document;

import com.supplierplatform.common.EntityNotFoundException;
import com.supplierplatform.document.dto.DocumentResponse;
import com.supplierplatform.supplier.SupplierProfileRepository;
import com.supplierplatform.supplier.entity.SupplierProfile;
import com.supplierplatform.supplier.enums.SupplierStatus;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.util.StringUtils;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DocumentService {

    private final SupplierDocumentRepository documentRepository;
    private final SupplierProfileRepository supplierProfileRepository;

    @Value("${app.file.upload-dir}")
    private String uploadDir;

    @Transactional
    public DocumentResponse uploadDocument(
            UUID supplierId,
            MultipartFile file,
            DocumentType type,
            LocalDate expiryDate,
            String notes,
            User uploader) {

        SupplierProfile supplier = supplierProfileRepository.findById(supplierId)
                .orElseThrow(() -> new EntityNotFoundException("SupplierProfile", supplierId));

        boolean isSupplierOwner = uploader.getRole() == UserRole.SUPPLIER
                && supplier.getUser() != null
                && supplier.getUser().getId().equals(uploader.getId());
        if (isSupplierOwner && !isEditableForSupplier(supplier.getStatus())) {
            throw new IllegalStateException(
                    "Documents cannot be updated in status: " + supplier.getStatus()
                            + ". Allowed only in DRAFT or NEEDS_REVISION.");
        }

        // Mark previous documents of same type as not current
        List<SupplierDocument> existingDocs = documentRepository.findBySupplierIdAndDocumentType(supplierId, type);
        existingDocs.forEach(doc -> doc.setIsCurrent(false));
        documentRepository.saveAll(existingDocs);

        // Build storage path with a sanitized file name to avoid invalid path issues.
        String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "document";
        String cleanedName = StringUtils.cleanPath(originalFilename);
        String baseName = Paths.get(cleanedName).getFileName().toString().replaceAll("[\\\\/:*?\"<>|]", "_");
        String fileName = UUID.randomUUID() + "_" + baseName;
        String relativePath = supplierId + "/" + fileName;
        Path uploadRoot = resolveUploadRoot();
        Path targetDir = uploadRoot.resolve(supplierId.toString());

        try {
            Files.createDirectories(targetDir);
            Path targetPath = targetDir.resolve(fileName);
            file.transferTo(targetPath.toFile());
        } catch (IOException e) {
            throw new RuntimeException("Failed to store file: " + e.getMessage(), e);
        }

        SupplierDocument document = SupplierDocument.builder()
                .supplier(supplier)
                .documentType(type)
                .originalFilename(baseName)
                .storageKey(relativePath)
                .mimeType(file.getContentType())
                .fileSizeBytes(file.getSize())
                .uploadedBy(uploader)
                .isCurrent(true)
                .expiryDate(expiryDate)
                .notes(notes)
                .build();

        SupplierDocument saved = documentRepository.save(document);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<DocumentResponse> getDocuments(UUID supplierId) {
        return documentRepository.findBySupplierId(supplierId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteDocument(UUID documentId, User actor) {
        SupplierDocument document = documentRepository.findById(documentId)
                .orElseThrow(() -> new EntityNotFoundException("SupplierDocument", documentId));

        boolean isUploader = document.getUploadedBy() != null &&
                document.getUploadedBy().getId().equals(actor.getId());
        boolean isAdmin = actor.getRole() == UserRole.ADMIN;

        if (!isUploader && !isAdmin) {
            throw new AccessDeniedException("You do not have permission to delete this document");
        }

        // Delete physical file
        try {
            Path filePath = resolveUploadRoot().resolve(document.getStorageKey()).normalize();
            Files.deleteIfExists(filePath);
        } catch (IOException e) {
            // Log but do not block deletion of the record
        }

        documentRepository.delete(document);
    }

    @Transactional(readOnly = true)
    public DocumentDownload downloadDocument(UUID documentId) {
        SupplierDocument document = documentRepository.findById(documentId)
                .orElseThrow(() -> new EntityNotFoundException("SupplierDocument", documentId));

        try {
            Path filePath = resolveUploadRoot().resolve(document.getStorageKey()).normalize();
            Resource resource = new UrlResource(filePath.toUri());
            if (!resource.exists()) {
                throw new EntityNotFoundException("File not found for document", documentId);
            }
            String mimeType = (document.getMimeType() == null || document.getMimeType().isBlank())
                    ? "application/octet-stream"
                    : document.getMimeType();
            return new DocumentDownload(resource, document.getOriginalFilename(), mimeType);
        } catch (MalformedURLException e) {
            throw new RuntimeException("Could not resolve file path for document: " + documentId, e);
        }
    }

    private Path resolveUploadRoot() {
        return Paths.get(uploadDir).toAbsolutePath().normalize();
    }

    private boolean isEditableForSupplier(SupplierStatus status) {
        return status == SupplierStatus.DRAFT || status == SupplierStatus.NEEDS_REVISION;
    }

    public record DocumentDownload(Resource resource, String originalFilename, String mimeType) {}

    private DocumentResponse toResponse(SupplierDocument document) {
        String uploadedByName = document.getUploadedBy() != null ? document.getUploadedBy().getFullName() : null;

        return DocumentResponse.builder()
                .id(document.getId())
                .documentType(document.getDocumentType())
                .originalFilename(document.getOriginalFilename())
                .mimeType(document.getMimeType())
                .fileSizeBytes(document.getFileSizeBytes())
                .isCurrent(document.getIsCurrent())
                .expiryDate(document.getExpiryDate())
                .notes(document.getNotes())
                .uploadedAt(document.getUploadedAt())
                .uploadedByName(uploadedByName)
                .build();
    }
}
