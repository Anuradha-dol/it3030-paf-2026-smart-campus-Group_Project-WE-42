package com.smartcampus.websocket;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.security.Principal;

@Component
@RequiredArgsConstructor
@Slf4j
public class NotificationWebSocketHandler extends TextWebSocketHandler {

    private final NotificationRealtimeGateway realtimeGateway;

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        // Websocket user comes from Spring Security principal.
        Principal principal = session.getPrincipal();
        if (principal == null || principal.getName() == null || principal.getName().isBlank()) {
            log.warn("Closing websocket {} because principal is missing", session.getId());
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Unauthorized"));
            return;
        }

        // Register session for targeted notification pushes.
        realtimeGateway.registerSession(principal.getName(), session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        // Remove closed session from gateway map.
        Principal principal = session.getPrincipal();
        if (principal != null) {
            realtimeGateway.unregisterSession(principal.getName(), session);
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        // Remove failed session and keep gateway clean.
        Principal principal = session.getPrincipal();
        if (principal != null) {
            realtimeGateway.unregisterSession(principal.getName(), session);
        }
        log.warn("Notification websocket transport error on session {}: {}", session.getId(), exception.getMessage());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        // Server-push channel; clients do not send messages.
    }
}
