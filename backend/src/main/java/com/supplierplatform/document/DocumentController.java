package com.supplierplatform.document;

import com.supplierplatform.common.ApiResponse;
import com.supplierplatform.document.dto.DocumentResponse;
import com.supplierplatform.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/documents")
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentService documentService;

    @PostMapping("/upload/{supplierId}")
    public ResponseEntity<ApiResponse<DocumentResponse>> uploadDocument(
            @PathVariable UUID supplierId,
            @RequestParam("file") MultipartFile file,
            @RequestParam DocumentType type,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate expiryDate,
            @RequestParam(required = false) String notes) {

        User currentUser = getCurrentUser();
        DocumentResponse response = documentService.uploadDocument(supplierId, file, type, expiryDate, notes, currentUser);
        return ResponseEntity.ok(ApiResponse.ok("Document uploaded successfully", response));
    }

    @GetMapping("/{supplierId}")
    public ResponseEntity<ApiResponse<List<DocumentResponse>>> getDocuments(@PathVariable UUID supplierId) {
        List<DocumentResponse> documents = documentService.getDocuments(supplierId);
        return ResponseEntity.ok(ApiResponse.ok(documents));
    }

    @DeleteMapping("/{documentId}")
    public ResponseEntity<ApiResponse<Void>> deleteDocument(@PathVariable UUID documentId) {
        User currentUser = getCurrentUser();
        documentService.deleteDocument(documentId, currentUser);
        return ResponseEntity.ok(ApiResponse.ok("Document deleted successfully", null));
    }

    @GetMapping("/download/{documentId}")
    public ResponseEntity<Resource> downloadDocument(@PathVariable UUID documentId) {
        DocumentService.DocumentDownload download = documentService.downloadDocument(documentId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(download.mimeType()))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment()
                                .filename(download.originalFilename(), StandardCharsets.UTF_8)
                                .build()
                                .toString())
                .body(download.resource());
    }

    private User getCurrentUser() {
        return (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }
}
