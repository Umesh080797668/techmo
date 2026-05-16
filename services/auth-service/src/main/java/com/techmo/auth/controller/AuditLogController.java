package com.techmo.auth.controller;

import com.techmo.auth.model.AuthAuditLog;
import com.techmo.auth.repository.AuthAuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import jakarta.persistence.criteria.Predicate;
import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/v1/audit-logs")
@RequiredArgsConstructor
public class AuditLogController {

    private final AuthAuditLogRepository auditLogRepository;

    private static int parseIntSafe(String s, int def) {
        if (s == null || s.isBlank()) return def;
        try { return Integer.parseInt(s.trim()); } catch (NumberFormatException e) { return def; }
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('MANAGER','SUPER_ADMIN')")
    public ResponseEntity<Map<String, Object>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(required = false) String size,
            @RequestParam(required = false) String limit,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String resource,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to
    ) {
        // Accept either 'size' or 'limit'; default 25; clamp to 200
        int pageSize = Math.min(200, parseIntSafe(size != null ? size : limit, 25));
        // Frontend sends 1-based pages
        int pageIndex = Math.max(0, page - 1);

        Specification<AuthAuditLog> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (action != null && !action.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("action")), "%" + action.toLowerCase() + "%"));
            }
            if (userId != null && !userId.isBlank()) {
                try { predicates.add(cb.equal(root.get("userId"), UUID.fromString(userId))); } catch (IllegalArgumentException ignored) {}
            }
            if (resource != null && !resource.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("resource")), "%" + resource.toLowerCase() + "%"));
            }
            if (from != null && !from.isBlank()) {
                try { predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), Instant.parse(from))); } catch (Exception ignored) {}
            }
            if (to != null && !to.isBlank()) {
                try { predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), Instant.parse(to))); } catch (Exception ignored) {}
            }
            return predicates.isEmpty() ? null : cb.and(predicates.toArray(new Predicate[0]));
        };

        PageRequest pageable = PageRequest.of(pageIndex, pageSize, Sort.by("createdAt").descending());
        Page<AuthAuditLog> result = auditLogRepository.findAll(spec, pageable);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("data", result.getContent());
        response.put("total", result.getTotalElements());
        response.put("page", result.getNumber());
        response.put("size", result.getSize());
        response.put("totalPages", result.getTotalPages());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('MANAGER','SUPER_ADMIN')")
    public ResponseEntity<AuthAuditLog> getById(@PathVariable UUID id) {
        return auditLogRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
