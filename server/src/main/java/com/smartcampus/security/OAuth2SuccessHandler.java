package com.smartcampus.security;

import com.smartcampus.enums.AuthProvider;
import com.smartcampus.enums.Role;
import com.smartcampus.enums.Token;
import com.smartcampus.model.User;
import com.smartcampus.repository.UserRepo;
import com.smartcampus.utils.JwtUtils;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.net.URI;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

@Component
@RequiredArgsConstructor
@Slf4j
public class OAuth2SuccessHandler implements AuthenticationSuccessHandler {

    private static final Pattern SLIIT_EMAIL_PATTERN =
            Pattern.compile("^IT\\d+@my\\.sliit\\.lk$", Pattern.CASE_INSENSITIVE);
    private static final String SLIIT_EMAIL_ONLY_MESSAGE =
            "Only SLIIT email is allowed (example: IT23687882@my.sliit.lk).";
    private static final int NAME_MAX_LENGTH = 100;
    private static final int PROVIDER_ID_MAX_LENGTH = 100;

    private final UserRepo userRepo;
    private final JwtUtils jwtUtils;
    private final PasswordEncoder passwordEncoder;
    private final HttpCookieOAuth2AuthorizationRequestRepository oAuth2AuthorizationRequestRepository;

    @Value("${app.frontend.base-url:http://localhost:5173}")
    private String frontendBaseUrl;

    @Value("${app.frontend.login-url:http://localhost:5173/login}")
    private String loginRedirectUrl;

    @Value("${app.frontend.oauth-success-path:/oauth-success}")
    private String oauthSuccessPath;

    @Override
    public void onAuthenticationSuccess(
            HttpServletRequest request,
            HttpServletResponse response,
            Authentication authentication
    ) throws IOException {
        try {
            // OAuth profile from provider.
            OAuth2User oauthUser = (OAuth2User) authentication.getPrincipal();

            // Normalize provider attributes.
            String email = normalizeEmail(oauthUser.getAttribute("email"));
            String name = oauthUser.getAttribute("name");
            String providerId = normalizeProviderId(oauthUser.getAttribute("sub"));

            if (!StringUtils.hasText(email)) {
                log.warn("Blocked OAuth2 login because provider email is missing");
                rejectOAuthLogin(request, response, SLIIT_EMAIL_ONLY_MESSAGE);
                return;
            }
            if (!isAllowedSliitEmail(email)) {
                log.warn("Blocked OAuth2 login for non-SLIIT email: {}", email);
                rejectOAuthLogin(request, response, SLIIT_EMAIL_ONLY_MESSAGE);
                return;
            }

            // Create new OAuth user or reuse existing account.
            User existingUser = userRepo.findByEmailIgnoreCase(email).orElse(null);
            boolean newUser = existingUser == null;
            User user = newUser ? createOAuthUser(email, name, providerId) : existingUser;
            normalizeUserForOAuthLogin(user, name, providerId);

            Map<String, Object> claims = new HashMap<>();
            claims.put("email", user.getEmail());
            claims.put("role", user.getRole().name());

            // Rotate auth cookies for this login.
            jwtUtils.removeToken(response, Token.ACCESS);
            jwtUtils.removeToken(response, Token.REFRESH);

            jwtUtils.generateToken(claims, user, response, Token.ACCESS);
            String refreshToken = jwtUtils.generateToken(claims, user, response, Token.REFRESH);

            user.setRefreshToken(refreshToken);
            userRepo.save(user);

            log.info("OAuth2 login success for {} (newUser={}, role={})", user.getEmail(), newUser, user.getRole());
            response.sendRedirect(resolveOAuthSuccessRedirectUrl(request));
        } catch (Exception ex) {
            log.error("OAuth2 login success handler failed", ex);
            // Clear cookies on OAuth2 failure.
            jwtUtils.removeToken(response, Token.ACCESS);
            jwtUtils.removeToken(response, Token.REFRESH);
            redirectToLoginWithError(request, response, "Google login failed. Please try again.");
        } finally {
            // Cleanup temporary OAuth flow cookies after callback handling.
            oAuth2AuthorizationRequestRepository.removeAuthorizationRequestCookies(response);
        }
    }

    private User createOAuthUser(String email, String name, String providerId) {
        User user = new User();
        user.setEmail(email);
        user.setFirstname(safeName(name, "GoogleUser"));
        user.setLastName("");
        user.setRole(Role.USER);
        user.setIsVerified(true);
        user.setPassword(passwordEncoder.encode(UUID.randomUUID().toString()));
        user.setProvider(AuthProvider.GOOGLE);
        user.setProviderId(normalizeProviderId(providerId));
        return userRepo.save(user);
    }

    private void normalizeUserForOAuthLogin(User user, String name, String providerId) {
        if (!StringUtils.hasText(user.getFirstname())) {
            user.setFirstname(safeName(name, "GoogleUser"));
        } else {
            user.setFirstname(safeName(user.getFirstname(), "GoogleUser"));
        }

        if (user.getLastName() == null) {
            user.setLastName("");
        } else if (user.getLastName().length() > NAME_MAX_LENGTH) {
            user.setLastName(user.getLastName().substring(0, NAME_MAX_LENGTH));
        }

        if (!StringUtils.hasText(user.getPassword())) {
            user.setPassword(passwordEncoder.encode(UUID.randomUUID().toString()));
        }

        if (user.getRole() == null) {
            user.setRole(Role.USER);
        }

        if (user.getProvider() == null) {
            user.setProvider(AuthProvider.GOOGLE);
            user.setProviderId(normalizeProviderId(providerId));
        }

        if (user.getProvider() == AuthProvider.GOOGLE
                && !StringUtils.hasText(user.getProviderId())
                && StringUtils.hasText(providerId)) {
            user.setProviderId(normalizeProviderId(providerId));
        }

        if (user.getIsVerified() == null || !user.getIsVerified()) {
            user.setIsVerified(true);
        }
    }

    private boolean isAllowedSliitEmail(String email) {
        return StringUtils.hasText(email)
                && SLIIT_EMAIL_PATTERN.matcher(email).matches();
    }

    private void rejectOAuthLogin(HttpServletRequest request, HttpServletResponse response, String message) throws IOException {
        // Clear auth cookies to prevent partial login state.
        jwtUtils.removeToken(response, Token.ACCESS);
        jwtUtils.removeToken(response, Token.REFRESH);
        redirectToLoginWithError(request, response, message);
    }

    private String normalizeEmail(Object emailAttribute) {
        if (emailAttribute == null) {
            return null;
        }

        String value = String.valueOf(emailAttribute).trim();
        if (value.isEmpty()) {
            return null;
        }

        return value.toLowerCase(Locale.ROOT);
    }

    private String normalizeProviderId(Object providerIdAttr) {
        if (providerIdAttr == null) {
            return null;
        }
        String value = String.valueOf(providerIdAttr).trim();
        if (value.isEmpty()) {
            return null;
        }
        return value.length() <= PROVIDER_ID_MAX_LENGTH
                ? value
                : value.substring(0, PROVIDER_ID_MAX_LENGTH);
    }

    private String safeName(String value, String fallback) {
        String candidate = StringUtils.hasText(value) ? value.trim() : fallback;
        if (!StringUtils.hasText(candidate)) {
            candidate = fallback;
        }
        return candidate.length() <= NAME_MAX_LENGTH
                ? candidate
                : candidate.substring(0, NAME_MAX_LENGTH);
    }

    private String resolveOAuthSuccessRedirectUrl(HttpServletRequest request) {
        String baseUrl = resolveFrontendBaseUrl(request);
        String callbackPath = normalizePath(oauthSuccessPath, "/oauth-success");
        return baseUrl + callbackPath;
    }

    private void redirectToLoginWithError(HttpServletRequest request, HttpServletResponse response, String message) throws IOException {
        String targetLoginUrl = resolveLoginRedirectUrl(request);
        String redirectUrl = UriComponentsBuilder.fromUriString(targetLoginUrl)
                .queryParam("oauthError", message)
                .build()
                .encode()
                .toUriString();
        response.sendRedirect(redirectUrl);
    }

    private String resolveFrontendBaseUrl(HttpServletRequest request) {
        String requestedRedirectUri = oAuth2AuthorizationRequestRepository.loadRedirectUri(request);
        String requestedBaseUrl = extractAndValidateFrontendBaseUrl(requestedRedirectUri);
        if (requestedBaseUrl != null) {
            return requestedBaseUrl;
        }

        String configuredBaseUrl = extractAndValidateFrontendBaseUrl(frontendBaseUrl);
        if (configuredBaseUrl != null) {
            return configuredBaseUrl;
        }

        return "http://localhost:5173";
    }

    private String resolveLoginRedirectUrl(HttpServletRequest request) {
        String requestedLoginUrl = normalizeAndValidateAbsoluteFrontendUrl(
                oAuth2AuthorizationRequestRepository.loadLoginUri(request)
        );
        if (requestedLoginUrl != null) {
            return requestedLoginUrl;
        }

        String configuredLoginUrl = normalizeAndValidateAbsoluteFrontendUrl(loginRedirectUrl);
        if (configuredLoginUrl != null) {
            return configuredLoginUrl;
        }

        return resolveFrontendBaseUrl(request) + "/login";
    }

    private String extractAndValidateFrontendBaseUrl(String candidate) {
        if (!StringUtils.hasText(candidate)) {
            return null;
        }

        try {
            URI uri = URI.create(candidate.trim());
            String scheme = uri.getScheme();
            String host = uri.getHost();
            String authority = uri.getAuthority();
            if (!isHttpScheme(scheme) || !StringUtils.hasText(host) || !StringUtils.hasText(authority)) {
                return null;
            }
            if (!isAllowedFrontendHost(host)) {
                return null;
            }

            return scheme.toLowerCase(Locale.ROOT) + "://" + authority;
        } catch (Exception ex) {
            return null;
        }
    }

    private String normalizeAndValidateAbsoluteFrontendUrl(String candidate) {
        if (!StringUtils.hasText(candidate)) {
            return null;
        }

        try {
            URI uri = URI.create(candidate.trim());
            String scheme = uri.getScheme();
            String host = uri.getHost();
            if (!isHttpScheme(scheme) || !StringUtils.hasText(host)) {
                return null;
            }
            if (!isAllowedFrontendHost(host)) {
                return null;
            }

            return uri.toString();
        } catch (Exception ex) {
            return null;
        }
    }

    private boolean isHttpScheme(String scheme) {
        if (!StringUtils.hasText(scheme)) {
            return false;
        }
        String normalized = scheme.toLowerCase(Locale.ROOT);
        return "http".equals(normalized) || "https".equals(normalized);
    }

    private boolean isAllowedFrontendHost(String host) {
        if (!StringUtils.hasText(host)) {
            return false;
        }

        String normalizedHost = host.toLowerCase(Locale.ROOT);
        if (Set.of("localhost", "127.0.0.1", "::1").contains(normalizedHost)) {
            return true;
        }

        String configuredHost = extractHost(frontendBaseUrl);
        return StringUtils.hasText(configuredHost) && normalizedHost.equals(configuredHost.toLowerCase(Locale.ROOT));
    }

    private String extractHost(String url) {
        if (!StringUtils.hasText(url)) {
            return null;
        }
        try {
            return URI.create(url.trim()).getHost();
        } catch (Exception ex) {
            return null;
        }
    }

    private String normalizePath(String candidate, String fallback) {
        String path = StringUtils.hasText(candidate) ? candidate.trim() : fallback;
        if (!StringUtils.hasText(path)) {
            path = fallback;
        }
        return path.startsWith("/") ? path : "/" + path;
    }
}

