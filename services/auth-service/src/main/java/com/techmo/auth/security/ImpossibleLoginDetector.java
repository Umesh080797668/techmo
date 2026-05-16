package com.techmo.auth.security;

import com.techmo.auth.model.AuthAuditLog;
import com.techmo.auth.model.User;
import com.techmo.auth.repository.AuthAuditLogRepository;
import com.techmo.auth.repository.UserRepository;
import jakarta.mail.internet.MimeMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.security.authentication.event.AuthenticationSuccessEvent;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Detects "impossible travel" logins — a login from a location
 * that is physically unreachable given the time elapsed since the
 * previous login.
 *
 * <p>Algorithm:
 * <ol>
 *   <li>On every successful authentication, look up the previous
 *       {@code LOGIN_SUCCESS} audit-log entry for that user.</li>
 *   <li>Geolocate both the previous and current IP addresses using
 *       the free ip-api.com endpoint (no key required).</li>
 *   <li>Compute the great-circle distance between the two
 *       coordinates using the Haversine formula.</li>
 *   <li>If the distance exceeds {@code MAX_DISTANCE_KM} (default 500 km)
 *       and the elapsed time is under {@code MIN_TRAVEL_MINUTES}
 *       (default 60 min), treat the login as suspicious:
 *       <ul>
 *         <li>Lock the account via {@link UserRepository}.</li>
 *         <li>Send an alert e-mail to the user and the admin address.</li>
 *         <li>Record a {@code SUSPICIOUS_IMPOSSIBLE_LOGIN} audit log.</li>
 *       </ul>
 *   </li>
 *   <li>Always record the current login as a {@code LOGIN_SUCCESS}
 *       audit log entry (idempotent — the auth service may already do
 *       this; the detector simply ensures the entry exists).</li>
 * </ol>
 * </p>
 */
@Slf4j
@Component
public class ImpossibleLoginDetector {

    // ─── Configuration ────────────────────────────────────────────────────
    private static final double  MAX_DISTANCE_KM    = 500.0;
    private static final long    MIN_TRAVEL_MINUTES = 60L;
    private static final String  GEO_API            = "http://ip-api.com/json/%s?fields=status,lat,lon,country,city";

    @Value("${app.admin-email:admin@techmo.lk}")
    private String adminEmail;

    @Value("${spring.mail.username:noreply@techmo.lk}")
    private String fromEmail;

    // ─── Dependencies ─────────────────────────────────────────────────────
    @Autowired
    private AuthAuditLogRepository auditRepo;
    @Autowired
    private UserRepository         userRepo;
    @Autowired(required = false)
    private JavaMailSender         mailSender;

    // Lazily created — no bean conflict with existing RestTemplate beans
    private final RestTemplate rest = new RestTemplate();

    // ─── Event listener ───────────────────────────────────────────────────

    /**
     * Fired asynchronously after every successful Spring Security
     * authentication so it never adds latency to the login response.
     */
    @Async
    @EventListener
    public void onAuthSuccess(AuthenticationSuccessEvent event) {
        try {
            handle(event);
        } catch (Exception ex) {
            // Never let this component break authentication flows
            log.error("[ImpossibleLogin] Unhandled error during detection", ex);
        }
    }

    // ─── Core detection logic ─────────────────────────────────────────────

    private void handle(AuthenticationSuccessEvent event) {
        Object principal = event.getAuthentication().getPrincipal();
        if (!(principal instanceof UserDetails ud)) return;

        Optional<User> userOpt = userRepo.findByUsername(ud.getUsername());
        if (userOpt.isEmpty()) return;
        User user = userOpt.get();

        // Extract IP from authentication details (set by JwtAuthenticationFilter)
        String currentIp = extractIp(event);
        if (currentIp == null || isPrivateIp(currentIp)) return;

        Instant now = Instant.now();

        // Look up the previous successful login
        Optional<AuthAuditLog> prevLog = auditRepo.findLastLoginBefore(user.getId(), now);
        if (prevLog.isEmpty()) return; // first-ever login — nothing to compare

        AuthAuditLog prev = prevLog.get();
        String prevIp = prev.getIpAddress();
        if (prevIp == null || isPrivateIp(prevIp) || prevIp.equals(currentIp)) return;

        // ── Geolocation ──────────────────────────────────────────────────
        GeoLocation prevGeo = geolocate(prevIp);
        GeoLocation currGeo = geolocate(currentIp);
        if (prevGeo == null || currGeo == null) return;

        double distanceKm = haversineKm(prevGeo.lat, prevGeo.lon, currGeo.lat, currGeo.lon);
        long   elapsedMin = Duration.between(prev.getCreatedAt(), now).toMinutes();

        log.info("[ImpossibleLogin] user={} prevIp={}({} {}) currIp={}({} {}) dist={}km elapsed={}min",
                user.getUsername(),
                prevIp, prevGeo.city, prevGeo.country,
                currentIp, currGeo.city, currGeo.country,
                (int) distanceKm, elapsedMin);

        if (distanceKm > MAX_DISTANCE_KM && elapsedMin < MIN_TRAVEL_MINUTES) {
            log.warn("[ImpossibleLogin] *** SUSPICIOUS LOGIN DETECTED for user={} ***", user.getUsername());

            // 1. Lock the account
            user.setLocked(true);
            userRepo.save(user);

            // 2. Audit log
            auditRepo.save(AuthAuditLog.builder()
                    .userId(user.getId())
                    .action("SUSPICIOUS_IMPOSSIBLE_LOGIN")
                    .ipAddress(currentIp)
                    .metadata(String.format(
                            "{\"prevIp\":\"%s\",\"prevCity\":\"%s\",\"currCity\":\"%s\",\"distanceKm\":%d,\"elapsedMin\":%d}",
                            prevIp, prevGeo.city, currGeo.city, (int) distanceKm, elapsedMin))
                    .build());

            // 3. Alert e-mails
            sendAlert(user, prevGeo, currGeo, distanceKm, elapsedMin, currentIp);
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────────

    private String extractIp(AuthenticationSuccessEvent event) {
        Object details = event.getAuthentication().getDetails();
        if (details instanceof org.springframework.security.web.authentication.WebAuthenticationDetails wad) {
            return wad.getRemoteAddress();
        }
        // Fallback: check metadata on the principal if custom WebAuthenticationDetails are used
        return null;
    }

    private boolean isPrivateIp(String ip) {
        return ip.startsWith("10.")
                || ip.startsWith("192.168.")
                || ip.startsWith("172.")
                || ip.equals("127.0.0.1")
                || ip.equals("0:0:0:0:0:0:0:1")
                || ip.equals("::1");
    }

    @SuppressWarnings("unchecked")
    private GeoLocation geolocate(String ip) {
        try {
            Map<String, Object> resp = rest.getForObject(String.format(GEO_API, ip), Map.class);
            if (resp == null || !"success".equals(resp.get("status"))) return null;
            double lat = ((Number) resp.get("lat")).doubleValue();
            double lon = ((Number) resp.get("lon")).doubleValue();
            String city    = (String) resp.getOrDefault("city", "Unknown");
            String country = (String) resp.getOrDefault("country", "");
            return new GeoLocation(lat, lon, city, country);
        } catch (Exception ex) {
            log.debug("[ImpossibleLogin] Geolocation failed for ip={}: {}", ip, ex.getMessage());
            return null;
        }
    }

    /**
     * Haversine great-circle distance formula.
     *
     * @return distance in kilometres
     */
    private double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        final double R = 6371.0; // Earth radius km
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private void sendAlert(User user, GeoLocation prev, GeoLocation curr,
                           double distanceKm, long elapsedMin, String currentIp) {
        try {
            String subject = "[TechMo Security] Suspicious login detected — account locked";
            String html = """
                    <html><body style="font-family:sans-serif;color:#1e293b">
                    <h2 style="color:#dc2626">⚠ Suspicious Login Detected</h2>
                    <p>An impossible-travel login was detected for account
                       <strong>%s</strong> and the account has been <strong>locked</strong>.</p>
                    <table style="border-collapse:collapse;width:100%%">
                      <tr><th style="text-align:left;padding:6px 12px;background:#f1f5f9">Previous Login</th>
                          <td style="padding:6px 12px">%s, %s</td></tr>
                      <tr><th style="text-align:left;padding:6px 12px;background:#f1f5f9">Current Login IP</th>
                          <td style="padding:6px 12px">%s — %s, %s</td></tr>
                      <tr><th style="text-align:left;padding:6px 12px;background:#f1f5f9">Distance</th>
                          <td style="padding:6px 12px">%.0f km</td></tr>
                      <tr><th style="text-align:left;padding:6px 12px;background:#f1f5f9">Elapsed Time</th>
                          <td style="padding:6px 12px">%d minutes</td></tr>
                    </table>
                    <p>If this was you, please contact a TechMo administrator to unlock your account.</p>
                    </body></html>
                    """.formatted(
                    user.getUsername(),
                    prev.city, prev.country,
                    currentIp, curr.city, curr.country,
                    distanceKm, elapsedMin);

            // Alert the user (if they have an email)
            if (user.getEmail() != null && !user.getEmail().isBlank()) {
                sendHtmlEmail(user.getEmail(), subject, html);
            }

            // Always alert the admin
            sendHtmlEmail(adminEmail, subject, html);

        } catch (Exception ex) {
            log.error("[ImpossibleLogin] Failed to send alert email: {}", ex.getMessage());
        }
    }

    private void sendHtmlEmail(String to, String subject, String html) throws Exception {
        if (mailSender == null) {
            log.warn("[ImpossibleLogin] Mail sender not configured — skipping alert email to {}", to);
            return;
        }
        MimeMessage msg = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(msg, false, "UTF-8");
        helper.setFrom(fromEmail);
        helper.setTo(to);
        helper.setSubject(subject);
        helper.setText(html, true);
        mailSender.send(msg);
    }

    // ─── Inner types ──────────────────────────────────────────────────────

    private record GeoLocation(double lat, double lon, String city, String country) {}
}
