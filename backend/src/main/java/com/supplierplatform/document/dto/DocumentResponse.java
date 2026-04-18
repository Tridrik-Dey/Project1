package com.supplierplatform.document.dto;

import com.supplierplatform.document.DocumentType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentResponse {

    private UUID id;
    private DocumentType documentType;
    private String originalFilename;
    private String mimeType;
    private Long fileSizeBytes;
    private Boolean isCurrent;
    private LocalDate expiryDate;
    private String notes;
    private LocalDateTime uploadedAt;
    private String uploadedByName;
}
