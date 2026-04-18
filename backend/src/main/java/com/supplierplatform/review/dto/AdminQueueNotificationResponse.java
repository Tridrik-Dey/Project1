package com.supplierplatform.review.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminQueueNotificationResponse {
    private long newPendingCount;
    private LocalDateTime lastSeenAt;
    private LocalDateTime serverTime;
}
