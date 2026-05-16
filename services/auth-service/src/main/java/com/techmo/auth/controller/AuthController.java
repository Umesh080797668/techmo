package com.techmo.auth.controller;

import com.techmo.auth.dto.*;
import com.techmo.auth.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
        @Valid @RequestBody LoginRequest request,
        HttpServletRequest httpRequest
    ) {
        String ip = httpRequest.getRemoteAddr();
        String ua = httpRequest.getHeader("User-Agent");
        return ResponseEntity.ok(authService.login(request, ip, ua));
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(
        @RequestBody Map<String, String> body,
        HttpServletRequest httpRequest
    ) {
        String refreshToken = body.get("refreshToken");
        if (refreshToken == null) return ResponseEntity.badRequest().build();
        return ResponseEntity.ok(authService.refresh(refreshToken,
            httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
        @RequestHeader("X-User-Id") String userId,
        HttpServletRequest httpRequest
    ) {
        authService.logout(UUID.fromString(userId),
            httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent"));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/change-password")
    public ResponseEntity<Void> changePassword(
        @RequestHeader("X-User-Id") String userId,
        @Valid @RequestBody ChangePasswordRequest request,
        HttpServletRequest httpRequest
    ) {
        authService.changePassword(UUID.fromString(userId), request);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/validate")
    public ResponseEntity<Map<String, Object>> validateToken(
        @RequestHeader("Authorization") String authHeader
    ) {
        // This endpoint is called by the gateway to validate tokens
        return ResponseEntity.ok(Map.of("valid", true));
    }
}
