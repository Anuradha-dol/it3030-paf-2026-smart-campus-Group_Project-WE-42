package com.smartcampus.controller;

import com.smartcampus.dto.TicketRequestDTO;
import com.smartcampus.dto.TicketResponseDTO;
import com.smartcampus.enums.Role;
import com.smartcampus.enums.TicketStatus;
import com.smartcampus.model.User;
import com.smartcampus.repository.UserRepo;
import com.smartcampus.service.MaintenanceTicketService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/tickets")
@RequiredArgsConstructor
public class MaintenanceTicketController {

    private final MaintenanceTicketService ticketService;
    private final UserRepo userRepo;

    /** Returns all users who can be assigned to a ticket (technicians only). */
    @GetMapping("/assignable-users")
    public ResponseEntity<List<Map<String, Object>>> getAssignableUsers() {
        List<Map<String, Object>> users = userRepo.findByRole(Role.TECHNICIAN).stream()
                .map(u -> {
                    Map<String, Object> dto = new java.util.HashMap<>();
                    dto.put("userId", u.getUserId());
                    dto.put("firstname", u.getFirstname());
                    dto.put("lastName", u.getLastName());
                    dto.put("email", u.getEmail());
                    dto.put("role", u.getRole().name());
                    return dto;
                })
                .collect(Collectors.toList());
        return ResponseEntity.ok(users);
    }

    /** Returns all tickets assigned to the currently logged-in user. */
    @GetMapping("/my-assigned")
    public ResponseEntity<List<TicketResponseDTO>> getMyAssignedTickets(
            @AuthenticationPrincipal User user,
            Authentication authentication) {
        User currentUser = resolveLoggedUser(user, authentication);
        List<TicketResponseDTO> myTickets = ticketService.getAllTickets().stream()
                .filter(t -> t.getAssignedTechnicianId() != null &&
                             t.getAssignedTechnicianId().equals(currentUser.getUserId()))
                .collect(Collectors.toList());
        return ResponseEntity.ok(myTickets);
    }

    @PostMapping(consumes = {"multipart/form-data"})
    public ResponseEntity<TicketResponseDTO> createTicket(
            @AuthenticationPrincipal User user,
            Authentication authentication,
            @RequestPart("ticket") @Valid TicketRequestDTO ticketRequestDTO,
            @RequestPart(value = "files", required = false) List<MultipartFile> files) {

        User currentUser = resolveLoggedUser(user, authentication);
        TicketResponseDTO response = ticketService.createTicket(ticketRequestDTO, files, currentUser);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<TicketResponseDTO>> getAllTickets() {
        return ResponseEntity.ok(ticketService.getAllTickets());
    }

    @GetMapping("/{id}")
    public ResponseEntity<TicketResponseDTO> getTicketById(@PathVariable("id") Long id) {
        return ResponseEntity.ok(ticketService.getTicketById(id));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<TicketResponseDTO> updateStatus(
            @AuthenticationPrincipal User user,
            Authentication authentication,
            @PathVariable("id") Long id,
            @RequestParam("status") TicketStatus status,
            @RequestParam(value = "notes", required = false) String notes) {

        User currentUser = resolveLoggedUser(user, authentication);
        return ResponseEntity.ok(ticketService.updateTicketStatus(id, status, notes, currentUser));
    }

    @PutMapping("/{id}/assign")
    public ResponseEntity<TicketResponseDTO> assignTechnician(
            @AuthenticationPrincipal User user,
            Authentication authentication,
            @PathVariable("id") Long id,
            @RequestParam("technicianId") Long technicianId) {

        User currentUser = resolveLoggedUser(user, authentication);
        return ResponseEntity.ok(ticketService.assignTechnician(id, technicianId, currentUser));
    }

    @PostMapping("/{id}/comments")
    public ResponseEntity<TicketResponseDTO> addComment(
            @AuthenticationPrincipal User user,
            Authentication authentication,
            @PathVariable("id") Long id,
            @RequestParam("message") String message) {

        User currentUser = resolveLoggedUser(user, authentication);
        return ResponseEntity.ok(ticketService.addComment(id, message, currentUser));
    }

    @DeleteMapping("/{ticketId}/comments/{commentId}")
    public ResponseEntity<Void> deleteComment(
            @AuthenticationPrincipal User user,
            Authentication authentication,
            @PathVariable("ticketId") Long ticketId,
            @PathVariable("commentId") Long commentId) {

        User currentUser = resolveLoggedUser(user, authentication);
        ticketService.deleteComment(ticketId, commentId, currentUser);
        return ResponseEntity.noContent().build();
    }

    private User resolveLoggedUser(User loggedUser, Authentication authentication) {
        if (loggedUser != null) return loggedUser;

        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized");
        }

        Object principal = authentication.getPrincipal();

        if (principal instanceof User user) return user;

        if (principal instanceof UserDetails userDetails) {
            return findUserByEmail(userDetails.getUsername());
        }

        if (principal instanceof OAuth2User oauth2User) {
            Object emailAttr = oauth2User.getAttribute("email");
            if (emailAttr != null) return findUserByEmail(String.valueOf(emailAttr));
        }

        if (principal instanceof String username && !username.isBlank() && !"anonymousUser".equalsIgnoreCase(username)) {
            return findUserByEmail(username);
        }

        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated user not found");
    }

    private User findUserByEmail(String email) {
        return userRepo.findByEmailIgnoreCase(email.trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }
}
