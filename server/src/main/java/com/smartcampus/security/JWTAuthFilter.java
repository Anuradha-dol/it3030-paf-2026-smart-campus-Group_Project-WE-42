package com.smartcampus.security;

import com.smartcampus.enums.Token;
import com.smartcampus.utils.JwtUtils;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@Slf4j
public class JWTAuthFilter extends OncePerRequestFilter {

    @Autowired
    private JwtUtils jwtUtils;

    @Autowired
    private UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        // Preserve existing authenticated context (e.g., session/OAuth2).
        Authentication existingAuthentication = SecurityContextHolder.getContext().getAuthentication();
        if (existingAuthentication != null && existingAuthentication.isAuthenticated()) {
            filterChain.doFilter(request, response);
            return;
        }

        // Read token from header or cookie.
        String token = resolveToken(request);

        // Continue without auth if token missing.
        if (token == null || token.isBlank()) {
            filterChain.doFilter(request, response);
            return;
        }

        // Try to authenticate request from token.
        authenticate(token, request);

        filterChain.doFilter(request, response);
    }

    private String resolveToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");

        // Prefer Bearer token when present.
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7);
        }

        // Fallback to ACCESS cookie token.
        String cookieToken = jwtUtils.getTokenFromCookie(request, Token.ACCESS);
        return (cookieToken != null && !cookieToken.isBlank()) ? cookieToken : null;
    }

    private void authenticate(String token, HttpServletRequest request) {

        try {
            // Extract username from token subject.
            String username = jwtUtils.extractUsername(token);
            if (username == null || username.isBlank()) {
                return;
            }

            // Load user and validate token integrity.
            UserDetails userDetails = userDetailsService.loadUserByUsername(username);

            if (!jwtUtils.validateToken(token, userDetails)) {
                return;
            }

            // Put authenticated user into security context.
            UsernamePasswordAuthenticationToken authToken =
                    new UsernamePasswordAuthenticationToken(
                            userDetails,
                            null,
                            userDetails.getAuthorities()
                    );

            authToken.setDetails(
                    new WebAuthenticationDetailsSource().buildDetails(request)
            );

            SecurityContextHolder.getContext().setAuthentication(authToken);

        } catch (Exception e) {
            // Ignore invalid token and leave context unchanged.
            log.warn("JWT error: {}", e.getMessage());
        }
    }
}
