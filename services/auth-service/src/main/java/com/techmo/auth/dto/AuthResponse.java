package com.techmo.auth.dto;

import lombok.*;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponse {
    private String accessToken;
    private String refreshToken;
    private String tokenType;
    private UUID userId;
    private String username;
    private String fullName;
    /** All granted authorities (e.g. ["ROLE_SUPER_ADMIN", "PRODUCT_READ", ...]). */
    private List<String> authorities;
    /** True if the user must change their password on first login. */
    private boolean mustChangePassword;
}
