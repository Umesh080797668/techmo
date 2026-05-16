package com.techmo.auth.service;

import com.techmo.auth.dto.*;
import com.techmo.auth.model.*;
import com.techmo.auth.repository.*;
import com.techmo.auth.security.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.*;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final RoleRepository roleRepository;
    private final AuthenticationManager authenticationManager;
    private final UserDetailsService userDetailsService;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogService auditLogService;

    @Transactional
    public AuthResponse login(LoginRequest request, String ip, String userAgent) {
        try {
            authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getUsernameOrEmail(), request.getPassword())
            );
        } catch (BadCredentialsException e) {
            userRepository.findByUsernameOrEmail(request.getUsernameOrEmail())
                .ifPresent(user -> {
                    userRepository.incrementFailedAttempts(user.getId());
                    if (user.getFailedLoginAttempts() + 1 >= 5) {
                        // Lock account after 5 failed attempts
                        user.setLocked(true);
                        userRepository.save(user);
                    }
                });
            auditLogService.log(null, "FAILED_LOGIN", "Authentication", ip, userAgent, request.getUsernameOrEmail());
            throw new BadCredentialsException("Invalid credentials");
        } catch (LockedException e) {
            auditLogService.log(null, "LOCKED_ACCOUNT_LOGIN", "User Account", ip, userAgent, request.getUsernameOrEmail());
            throw new LockedException("Account is locked. Please contact your administrator.");
        }

        User user = userRepository.findByUsernameOrEmail(request.getUsernameOrEmail())
            .orElseThrow(() -> new RuntimeException("User not found"));

        userRepository.resetFailedAttempts(user.getId());
        user.setLastLoginAt(Instant.now());
        userRepository.save(user);

        UserDetails userDetails = userDetailsService.loadUserByUsername(user.getUsername());
        String accessToken = jwtService.generateAccessToken(userDetails, user.getId());
        String rawRefreshToken = UUID.randomUUID().toString();
        String tokenHash = hashToken(rawRefreshToken);

        RefreshToken refreshToken = RefreshToken.builder()
            .user(user)
            .tokenHash(tokenHash)
            .expiresAt(Instant.now().plusMillis(604800000L))
            .build();
        refreshTokenRepository.save(refreshToken);

        auditLogService.log(user.getId(), "LOGIN", "Authentication", ip, userAgent, null);

        List<String> authorities = userDetails.getAuthorities().stream()
            .map(a -> a.getAuthority())
            .collect(Collectors.toList());

        return AuthResponse.builder()
            .accessToken(accessToken)
            .refreshToken(rawRefreshToken)
            .tokenType("Bearer")
            .userId(user.getId())
            .username(user.getUsername())
            .fullName(user.getFullName())
            .authorities(authorities)
            .mustChangePassword(user.isMustChangePassword())
            .build();
    }

    @Transactional
    public AuthResponse refresh(String rawRefreshToken, String ip, String userAgent) {
        String tokenHash = hashToken(rawRefreshToken);
        RefreshToken stored = refreshTokenRepository.findByTokenHash(tokenHash)
            .orElseThrow(() -> new RuntimeException("Invalid refresh token"));

        if (stored.isRevoked() || stored.getExpiresAt().isBefore(Instant.now())) {
            throw new RuntimeException("Refresh token is expired or revoked");
        }

        User user = stored.getUser();
        stored.setRevoked(true);
        refreshTokenRepository.save(stored);

        UserDetails userDetails = userDetailsService.loadUserByUsername(user.getUsername());
        String newAccessToken = jwtService.generateAccessToken(userDetails, user.getId());
        String newRawRefresh = UUID.randomUUID().toString();

        RefreshToken newRefreshToken = RefreshToken.builder()
            .user(user)
            .tokenHash(hashToken(newRawRefresh))
            .expiresAt(Instant.now().plusMillis(604800000L))
            .build();
        refreshTokenRepository.save(newRefreshToken);

        auditLogService.log(user.getId(), "TOKEN_REFRESH", "Token", ip, userAgent, null);

        List<String> authorities = userDetails.getAuthorities().stream()
            .map(a -> a.getAuthority())
            .collect(Collectors.toList());

        return AuthResponse.builder()
            .accessToken(newAccessToken)
            .refreshToken(newRawRefresh)
            .tokenType("Bearer")
            .userId(user.getId())
            .username(user.getUsername())
            .fullName(user.getFullName())
            .authorities(authorities)
            .mustChangePassword(user.isMustChangePassword())
            .build();
    }

    @Transactional
    public void logout(UUID userId, String ip, String userAgent) {
        refreshTokenRepository.revokeAllUserTokens(userId);
        auditLogService.log(userId, "LOGOUT", "Session", ip, userAgent, null);
    }

    @Transactional
    public void changePassword(UUID userId, ChangePasswordRequest request) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found"));

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new BadCredentialsException("Current password is incorrect");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setPasswordChangedAt(Instant.now());
        user.setMustChangePassword(false);
        userRepository.save(user);
        refreshTokenRepository.revokeAllUserTokens(userId);
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hash);
        } catch (Exception e) {
            throw new RuntimeException("Failed to hash token", e);
        }
    }
}
