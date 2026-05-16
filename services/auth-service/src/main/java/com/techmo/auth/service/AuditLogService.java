package com.techmo.auth.service;

import com.techmo.auth.model.AuthAuditLog;
import com.techmo.auth.repository.AuthAuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuthAuditLogRepository auditLogRepository;

    @Async
    public void log(UUID userId, String action, String resource, String ipAddress, String userAgent, String metadata) {
        AuthAuditLog log = AuthAuditLog.builder()
            .userId(userId)
            .action(action)
            .resource(resource)
            .ipAddress(ipAddress)
            .userAgent(userAgent)
            .metadata(metadata)
            .build();
        auditLogRepository.save(log);
    }
}
