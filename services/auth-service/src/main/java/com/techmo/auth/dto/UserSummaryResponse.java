package com.techmo.auth.dto;

import lombok.*;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserSummaryResponse {
    private UUID id;
    private String username;
    private String email;
    private String fullName;
    private boolean active;
    private boolean locked;
    private Set<String> roles;
    private Instant lastLoginAt;
    private Instant createdAt;
}
