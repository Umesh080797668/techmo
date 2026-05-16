package com.techmo.auth.controller;

import com.techmo.auth.dto.CreateUserRequest;
import com.techmo.auth.dto.UserSummaryResponse;
import com.techmo.auth.model.Role;
import com.techmo.auth.model.User;
import com.techmo.auth.repository.RoleRepository;
import com.techmo.auth.repository.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * AdminUserController — SUPER_ADMIN-only user management endpoints.
 * All routes are protected by @PreAuthorize("hasRole('SUPER_ADMIN')").
 */
@RestController
@RequestMapping("/api/v1/admin/users")
@RequiredArgsConstructor
public class AdminUserController {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    // ─── List all users ──────────────────────────────────────────────────────
    @GetMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<List<UserSummaryResponse>> listUsers() {
        List<UserSummaryResponse> users = userRepository.findAll().stream()
            .map(this::toSummary)
            .collect(Collectors.toList());
        return ResponseEntity.ok(users);
    }

    // ─── Get single user ─────────────────────────────────────────────────────
    @GetMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<UserSummaryResponse> getUser(@PathVariable UUID id) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        return ResponseEntity.ok(toSummary(user));
    }

    // ─── Create user ─────────────────────────────────────────────────────────
    @PostMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'MANAGER', 'HR_ADMIN')")
    public ResponseEntity<UserSummaryResponse> createUser(
            @Valid @RequestBody CreateUserRequest req,
            Authentication authentication) {

        // Non-SUPER_ADMIN callers cannot create SUPER_ADMIN accounts
        boolean callerIsSuperAdmin = authentication.getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().equals("ROLE_SUPER_ADMIN"));
        if (!callerIsSuperAdmin && "SUPER_ADMIN".equals(req.getRoleName())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "Only SUPER_ADMIN can create SUPER_ADMIN accounts");
        }

        if (userRepository.existsByUsername(req.getUsername())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username already taken");
        }
        if (userRepository.existsByEmail(req.getEmail())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }

        Role role = roleRepository.findByName(req.getRoleName())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Role not found: " + req.getRoleName()));

        User user = User.builder()
            .username(req.getUsername())
            .email(req.getEmail())
            .passwordHash(passwordEncoder.encode(req.getPassword()))
            .fullName(req.getFullName())
            .isActive(true)
            .roles(Set.of(role))
            .mustChangePassword(true)
            .build();

        User saved = userRepository.save(user);
        return ResponseEntity.status(HttpStatus.CREATED).body(toSummary(saved));
    }

    // ─── Assign / replace role ────────────────────────────────────────────────
    @PutMapping("/{id}/role")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<UserSummaryResponse> assignRole(
            @PathVariable UUID id,
            @RequestBody java.util.Map<String, String> body) {

        String roleName = body.get("roleName");
        if (roleName == null || roleName.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "roleName is required");
        }

        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        // Prevent changing the SUPER_ADMIN's own role via this endpoint
        boolean isSuperAdmin = user.getRoles().stream()
            .anyMatch(r -> "SUPER_ADMIN".equals(r.getName()));
        if (isSuperAdmin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "Cannot change the role of the SUPER_ADMIN account");
        }

        Role role = roleRepository.findByName(roleName)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Role not found: " + roleName));

        user.setRoles(Set.of(role));
        return ResponseEntity.ok(toSummary(userRepository.save(user)));
    }

    // ─── Activate / deactivate ────────────────────────────────────────────────
    @PatchMapping("/{id}/deactivate")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<UserSummaryResponse> deactivate(@PathVariable UUID id) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        boolean isSuperAdmin = user.getRoles().stream()
            .anyMatch(r -> "SUPER_ADMIN".equals(r.getName()));
        if (isSuperAdmin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "Cannot deactivate the SUPER_ADMIN account");
        }

        user.setActive(false);
        return ResponseEntity.ok(toSummary(userRepository.save(user)));
    }

    @PatchMapping("/{id}/activate")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<UserSummaryResponse> activate(@PathVariable UUID id) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        user.setActive(true);
        user.setLocked(false);
        return ResponseEntity.ok(toSummary(userRepository.save(user)));
    }

    // ─── Reset password ───────────────────────────────────────────────────────
    @PatchMapping("/{id}/reset-password")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Void> resetPassword(
            @PathVariable UUID id,
            @RequestBody java.util.Map<String, String> body) {

        String newPassword = body.get("newPassword");
        if (newPassword == null || newPassword.length() < 8) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "newPassword must be at least 8 characters");
        }

        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setMustChangePassword(true);
        userRepository.save(user);
        return ResponseEntity.noContent().build();
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private UserSummaryResponse toSummary(User u) {
        Set<String> roleNames = u.getRoles().stream()
            .map(Role::getName)
            .collect(Collectors.toSet());
        return UserSummaryResponse.builder()
            .id(u.getId())
            .username(u.getUsername())
            .email(u.getEmail())
            .fullName(u.getFullName())
            .active(u.isActive())
            .locked(u.isLocked())
            .roles(roleNames)
            .lastLoginAt(u.getLastLoginAt())
            .createdAt(u.getCreatedAt())
            .build();
    }
}
