package com.smartcampus.security;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.util.StringUtils;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsUtils;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
@Slf4j
public class SecurityConfig {

    private final JWTAuthFilter jwtAuthFilter;
    private final AuthenticationProvider authenticationProvider;
    private final OAuth2SuccessHandler oAuth2SuccessHandler;
    private final OAuth2UserService oAuth2UserService;
    private final HttpCookieOAuth2AuthorizationRequestRepository oAuth2AuthorizationRequestRepository;

    @Value("${app.frontend.login-url:http://localhost:5173/login}")
    private String loginRedirectUrl;

    @Value("${app.frontend.base-url:http://localhost:5173}")
    private String frontendBaseUrl;

    @Bean
    public SecurityFilterChain filterChain(
            HttpSecurity http,
            OAuth2AuthorizationRequestResolver oauth2AuthorizationRequestResolver
    ) throws Exception {

        http
                // Allow local frontend origins and credentials.
                .cors(cors -> cors.configurationSource(request -> {
                    CorsConfiguration crf = new CorsConfiguration();
                    crf.setAllowedOriginPatterns(List.of("http://localhost:*"));
                    crf.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
                    crf.setAllowedHeaders(List.of("*"));
                    crf.setAllowCredentials(true);
                    return crf;
                }))
                .csrf(AbstractHttpConfigurer::disable)

                .authorizeHttpRequests(auth -> auth
                        // Allow browser preflight requests.
                        .requestMatchers(request -> CorsUtils.isPreFlightRequest(request)).permitAll()

                        // Protect authenticated session endpoints.
                        .requestMatchers("/auth/me", "/auth/logout").authenticated()
                        // Keep auth and oauth entry points public.
                        .requestMatchers(
                                "/auth/**",
                                "/forgotpass/**",
                                "/oauth2/**",
                                "/login/**"
                        ).permitAll()

                        .anyRequest().authenticated()
                )

                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
                )

                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, authException) -> {
                            response.setStatus(401);
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            response.getWriter().write("{\"message\":\"Unauthorized\"}");
                        })
                        .accessDeniedHandler((request, response, accessDeniedException) -> {
                            response.setStatus(403);
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            response.getWriter().write("{\"message\":\"Forbidden\"}");
                        })
                )

                .authenticationProvider(authenticationProvider)

                // Resolve JWT before username/password auth.
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)

                // Configure OAuth2 login and redirects.
                .oauth2Login(oauth -> oauth
                        .authorizationEndpoint(authorization -> authorization
                                .authorizationRequestResolver(oauth2AuthorizationRequestResolver)
                                .authorizationRequestRepository(oAuth2AuthorizationRequestRepository)
                        )
                        .userInfoEndpoint(userInfo -> userInfo
                                .userService(oAuth2UserService)
                        )
                        .failureHandler((request, response, exception) -> {
                            // Convert OAuth2 errors to frontend query param.
                            log.error("OAuth2 login failed", exception);

                            String message = "Google login failed. Please try again.";
                            if (exception instanceof OAuth2AuthenticationException oauth2Ex
                                    && oauth2Ex.getError() != null
                                    && "authorization_request_not_found".equals(oauth2Ex.getError().getErrorCode())) {
                                message = "Google login session expired. Please click Login with Google again.";
                            }

                            String redirectUrl = buildLoginErrorRedirectUrl(request, message);
                            // Cleanup temporary OAuth flow cookies after callback handling.
                            oAuth2AuthorizationRequestRepository.removeAuthorizationRequestCookies(response);
                            response.sendRedirect(redirectUrl);
                        })
                        .successHandler(oAuth2SuccessHandler)
                );

        return http.build();
    }

    @Bean
    public OAuth2AuthorizationRequestResolver oauth2AuthorizationRequestResolver(
            ClientRegistrationRepository clientRegistrationRepository
    ) {
        // Resolve /oauth2/authorization/{provider} calls.
        DefaultOAuth2AuthorizationRequestResolver resolver =
                new DefaultOAuth2AuthorizationRequestResolver(
                        clientRegistrationRepository,
                        "/oauth2/authorization"
                );

        // Ask provider to show account chooser every time.
        resolver.setAuthorizationRequestCustomizer(customizer ->
                customizer.additionalParameters(params ->
                        params.put("prompt", "select_account")
                )
        );

        return resolver;
    }

    private String buildLoginErrorRedirectUrl(HttpServletRequest request, String message) {
        String targetLoginUrl = resolveLoginRedirectUrl(request);
        return UriComponentsBuilder.fromUriString(targetLoginUrl)
                .queryParam("oauthError", message)
                .build()
                .encode()
                .toUriString();
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
}
