package com.supplierplatform.review.dto;

import com.supplierplatform.review.ReviewAction;
import com.supplierplatform.supplier.enums.SupplierStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReviewResponse {

    private UUID id;
    private ReviewAction action;
    private String comment;
    private SupplierStatus previousStatus;
    private SupplierStatus newStatus;
    private String reviewerName;
    private LocalDateTime createdAt;
}
