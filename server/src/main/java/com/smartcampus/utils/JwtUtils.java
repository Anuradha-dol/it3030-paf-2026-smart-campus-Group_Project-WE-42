package com.smartcampus.utils;

import com.smartcampus.enums.Token;
import io.jsonwebtoken.*;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import java.security.Key;
import java.util.*;
import java.util.stream.Collectors;

@Component
@Slf4j
public class JwtUtils {

    @Value("${spring.jwt.secret:Y2hhbGxlbmdlVG9Xcml0ZUZ1bGxQcmVkaWN0YWJsZVNlY3JldEtleQ==}")
    private String secretKey;

    @Value("${spring.cookie.secure:false}")
    private boolean cookieSecure;

    @Value("${spring.cookie.same-site:Lax}")
    private String cookieSameSite;

    // Access token lifetime.
    private static final long ACCESS_EXPIRATION_MS = 60 * 60 * 1000;
    // Refresh token lifetime.
    private static final long REFRESH_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000L;
    // Temporary verify token lifetime.
    private static final long VERIFY_EXPIRATION_MS = 30 * 60 * 1000;

    public String generateToken(
            Map<String, Object> extraClaims,
            UserDetails userDetails,
            HttpServletResponse response,
            Token tokenType
    ) {

        // Copy caller claims and append roles.
        Map<String, Object> claims = new HashMap<>(extraClaims);

        claims.put("roles",
                userDetails.getAuthorities()
                        .stream()
                        .map(GrantedAuthority::getAuthority)
                        .collect(Collectors.toList())
        );

        // Pick expiry by token type.
        long expiration;
        if (tokenType == Token.ACCESS) {
            expiration = ACCESS_EXPIRATION_MS;
        } else if (tokenType == Token.REFRESH) {
            expiration = REFRESH_EXPIRATION_MS;
        } else {
            expiration = VERIFY_EXPIRATION_MS;
        }

        // Build signed JWT.
        String token = Jwts.builder()
                .setClaims(claims)
                .setSubject(userDetails.getUsername())
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + expiration))
                .signWith(getSignInKey(), SignatureAlgorithm.HS256)
                .compact();

        // Always write token into HttpOnly cookie.
        addCookie(response, tokenType, token, expiration);

        return token;
    }

    private void addCookie(HttpServletResponse response, Token type, String token, long expiryMs) {
        // Token cookie name matches enum name.
        response.addHeader(
                HttpHeaders.SET_COOKIE,
                buildCookie(type.name(), token, expiryMs / 1000).toString()
        );
    }

    public String getTokenFromCookie(HttpServletRequest request, Token type) {
        // No cookies means no token.
        if (request.getCookies() == null) {
            return null;
        }

        String latestToken = null;
        // Pick latest non-empty cookie value.
        for (Cookie cookie : request.getCookies()) {
            if (type.name().equals(cookie.getName())
                    && cookie.getValue() != null
                    && !cookie.getValue().isBlank()) {
                latestToken = cookie.getValue();
            }
        }

        return latestToken;
    }
    public void removeToken(HttpServletResponse response, Token tokenType) {
        // Remove cookie by setting maxAge to 0.
        response.addHeader(
                HttpHeaders.SET_COOKIE,
                buildCookie(tokenType.name(), "", 0).toString()
        );
    }

    public boolean validateToken(String token, UserDetails userDetails) {
        try {
            // Token is valid only for same user and unexpired.
            return extractUsername(token).equals(userDetails.getUsername())
                    && !isTokenExpired(token);
        } catch (JwtException e) {
            log.warn("JWT validation error: {}", e.getMessage());
            return false;
        }
    }

    public String extractUsername(String token) {
        return extractAllClaims(token).getSubject();
    }

    private boolean isTokenExpired(String token) {
        return extractAllClaims(token).getExpiration().before(new Date());
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getSignInKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    private Key getSignInKey() {
        byte[] keyBytes = Decoders.BASE64.decode(secretKey);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    private ResponseCookie buildCookie(String name, String value, long maxAgeSeconds) {
        // Keep cookies HttpOnly to block JS access.
        return ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(cookieSecure)
                .path("/")
                .maxAge(maxAgeSeconds)
                .sameSite(resolveSameSite())
                .build();
    }

    private String resolveSameSite() {
        if (cookieSameSite == null || cookieSameSite.isBlank()) {
            return "Lax";
        }

        String normalized = cookieSameSite.trim().toLowerCase();

        // Browser blocks SameSite=None on insecure cookies.
        if (!cookieSecure && "none".equals(normalized)) {
            return "Lax";
        }

        return switch (normalized) {
            case "strict" -> "Strict";
            case "none" -> "None";
            default -> "Lax";
        };
    }
}
