package com.supplierplatform.review.dto;

import com.supplierplatform.review.ReviewAction;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ReviewRequest {

    @NotNull(message = "Review action is required")
    private ReviewAction action;

    private String comment;

    private String internalNote;
}
