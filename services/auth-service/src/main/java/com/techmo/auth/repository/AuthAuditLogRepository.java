package com.techmo.auth.repository;

import com.techmo.auth.model.AuthAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface AuthAuditLogRepository extends JpaRepository<AuthAuditLog, UUID>,
        JpaSpecificationExecutor<AuthAuditLog> {

    /** Most recent successful login for a user before a given instant. */
    @Query("""
        SELECT a FROM AuthAuditLog a
        WHERE a.userId = :userId
          AND a.action = 'LOGIN_SUCCESS'
          AND a.createdAt < :before
        ORDER BY a.createdAt DESC
        LIMIT 1
        """)
    Optional<AuthAuditLog> findLastLoginBefore(@Param("userId") UUID userId,
                                               @Param("before") Instant before);
}