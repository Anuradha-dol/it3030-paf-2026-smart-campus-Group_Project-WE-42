package com.smartcampus.service;

import com.smartcampus.dto.CommentDTO;
import com.smartcampus.dto.TicketRequestDTO;
import com.smartcampus.dto.TicketResponseDTO;
import com.smartcampus.enums.NotificationTargetType;
import com.smartcampus.enums.NotificationType;
import com.smartcampus.enums.Role;
import com.smartcampus.enums.TicketStatus;
import com.smartcampus.exception.ResourceNotFoundException;
import com.smartcampus.model.Attachment;
import com.smartcampus.model.Comment;
import com.smartcampus.model.MaintenanceTicket;
import com.smartcampus.model.User;
import com.smartcampus.repository.AttachmentRepository;
import com.smartcampus.repository.CommentRepository;
import com.smartcampus.repository.MaintenanceTicketRepository;
import com.smartcampus.repository.UserRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MaintenanceTicketServiceImpl implements MaintenanceTicketService {

    private final MaintenanceTicketRepository ticketRepository;
    private final AttachmentRepository attachmentRepository;
    private final CommentRepository commentRepository;
    private final UserRepo userRepository;
    private final NotificationService notificationService;

    private final String uploadDir = "uploads/tickets/";
    
    @jakarta.annotation.PostConstruct
    public void init() {
        try {
            ticketRepository.fixResourceIdConstraint();
        } catch (Exception e) {
            // Ignore if it fails (might be already fixed or DB doesn't support it)
        }
    }

    @Override
    @Transactional
    public TicketResponseDTO createTicket(TicketRequestDTO request, List<MultipartFile> files, User user) {
        MaintenanceTicket ticket = MaintenanceTicket.builder()
                .title(request.getTitle())
                .description(request.getDescription())
                .category(request.getCategory())
                .priority(request.getPriority())
                .status(TicketStatus.OPEN)
                .location(request.getLocation())
                .contactNumber(request.getContactNumber())
                .reporter(user)
                .attachments(new ArrayList<>())
                .build();

        MaintenanceTicket savedTicket = ticketRepository.save(ticket);

        if (files != null && !files.isEmpty()) {
            for (MultipartFile file : files) {
                if (file.isEmpty()) continue;
                try {
                    String fileName = UUID.randomUUID().toString() + "_" + file.getOriginalFilename();
                    Path path = Paths.get(uploadDir);
                    if (!Files.exists(path)) {
                        Files.createDirectories(path);
                    }
                    Files.copy(file.getInputStream(), path.resolve(fileName));

                    Attachment attachment = Attachment.builder()
                            .fileName(file.getOriginalFilename())
                            .filePath(uploadDir + fileName)
                            .fileType(file.getContentType())
                            .ticket(savedTicket)
                            .build();
                    attachmentRepository.save(attachment);
                    savedTicket.getAttachments().add(attachment);
                } catch (IOException e) {
                    throw new RuntimeException("Could not store file. Error: " + e.getMessage());
                }
            }
        }

        notifyTicketCreated(savedTicket, user);
        return mapToResponseDTO(savedTicket);
    }

    @Override
    @Transactional(readOnly = true)
    public List<TicketResponseDTO> getAllTickets() {
        return ticketRepository.findAll().stream()
                .map(this::safeMapToResponseDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public TicketResponseDTO getTicketById(Long id) {
        MaintenanceTicket ticket = ticketRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ticket not found"));
        return safeMapToResponseDTO(ticket);
    }

    @Override
    @Transactional
    public TicketResponseDTO updateTicketStatus(Long id, TicketStatus status, String notes, User user) {
        MaintenanceTicket ticket = ticketRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ticket not found"));

        // Security: Only admin or assigned technician can update status
        boolean isAdmin = user.getRole() == Role.ADMIN;
        boolean isAssignedTech = ticket.getAssignedTechnician() != null && 
                                 ticket.getAssignedTechnician().getUserId().equals(user.getUserId());

        if (!isAdmin && !isAssignedTech) {
            throw new RuntimeException("Unauthorized to update ticket status");
        }

        TicketStatus previousStatus = ticket.getStatus();

        if (status == TicketStatus.REJECTED) {
            if (!isAdmin) throw new RuntimeException("Only admins can reject tickets");
            ticket.setRejectionReason(notes);
        } else {
            ticket.setResolutionNotes(notes);
        }

        ticket.setStatus(status);
        MaintenanceTicket updatedTicket = ticketRepository.save(ticket);
        notifyTicketStatusChanged(updatedTicket, previousStatus, user);

        return mapToResponseDTO(updatedTicket);
    }

    @Override
    @Transactional
    public TicketResponseDTO assignTechnician(Long id, Long technicianId, User admin) {
        if (admin.getRole() != Role.ADMIN) {
            throw new RuntimeException("Only admins can assign technicians");
        }

        MaintenanceTicket ticket = ticketRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ticket not found"));

        User technician = userRepository.findById(technicianId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + technicianId));

        // Enforce assignment to technician accounts only.
        if (technician.getRole() != Role.TECHNICIAN) {
            throw new RuntimeException("Only technician users can be assigned to a ticket");
        }

        TicketStatus previousStatus = ticket.getStatus();
        ticket.setAssignedTechnician(technician);
        ticket.setStatus(TicketStatus.IN_PROGRESS);
        MaintenanceTicket updatedTicket = ticketRepository.save(ticket);

        notifyTicketStatusChanged(updatedTicket, previousStatus, admin);

        return mapToResponseDTO(updatedTicket);
    }

    @Override
    @Transactional
    public TicketResponseDTO addComment(Long id, String message, User user) {
        MaintenanceTicket ticket = ticketRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ticket not found"));

        Comment comment = Comment.builder()
                .message(message)
                .user(user)
                .ticket(ticket)
                .build();

        commentRepository.save(comment);
        notifyTicketCommentAdded(ticket, user, message);
        return mapToResponseDTO(ticket);
    }

    @Override
    @Transactional
    public void deleteComment(Long ticketId, Long commentId, User user) {
        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found"));

        if (comment.getTicket() == null || !ticketId.equals(comment.getTicket().getId())) {
            throw new RuntimeException("Comment not found for this ticket");
        }
        
        if (!comment.getUser().getUserId().equals(user.getUserId()) && user.getRole() != Role.ADMIN) {
            throw new RuntimeException("Unauthorized to delete this comment");
        }
        
        commentRepository.delete(comment);
    }

    private TicketResponseDTO safeMapToResponseDTO(MaintenanceTicket ticket) {
        try {
            return mapToResponseDTO(ticket);
        } catch (RuntimeException ex) {
            return buildMinimalTicketResponse(ticket);
        }
    }

    private TicketResponseDTO mapToResponseDTO(MaintenanceTicket ticket) {
        User reporter = safeGet(ticket::getReporter, null);
        User assignedTechnician = safeGet(ticket::getAssignedTechnician, null);

        List<Attachment> attachments = safeGet(ticket::getAttachments, Collections.emptyList());
        List<Comment> comments = safeGet(ticket::getComments, Collections.emptyList());

        List<TicketResponseDTO.AttachmentDTO> attachmentDTOs = new ArrayList<>();
        if (attachments != null) {
            for (Attachment attachment : attachments) {
                if (attachment == null) continue;
                try {
                    attachmentDTOs.add(TicketResponseDTO.AttachmentDTO.builder()
                            .id(attachment.getId())
                            .fileName(attachment.getFileName())
                            .filePath(attachment.getFilePath())
                            .fileType(attachment.getFileType())
                            .build());
                } catch (RuntimeException ignored) {
                    // Skip malformed attachment row instead of failing whole ticket response.
                }
            }
        }

        List<CommentDTO> commentDTOs = new ArrayList<>();
        if (comments != null) {
            for (Comment comment : comments) {
                if (comment == null) continue;
                try {
                    User commentUser = safeGet(comment::getUser, null);
                    commentDTOs.add(CommentDTO.builder()
                            .id(comment.getId())
                            .message(comment.getMessage())
                            .userId(commentUser != null ? safeGet(commentUser::getUserId, null) : null)
                            .username(formatFullName(commentUser, "Unknown User"))
                            .createdAt(comment.getCreatedAt())
                            .updatedAt(comment.getUpdatedAt())
                            .build());
                } catch (RuntimeException ignored) {
                    // Skip malformed comment row instead of failing whole ticket response.
                }
            }
        }

        return TicketResponseDTO.builder()
                .id(safeGet(ticket::getId, null))
                .title(safeGet(ticket::getTitle, null))
                .description(safeGet(ticket::getDescription, null))
                .category(safeGet(ticket::getCategory, null))
                .priority(safeGet(ticket::getPriority, null))
                .status(safeGet(ticket::getStatus, null))
                .createdById(reporter != null ? safeGet(reporter::getUserId, null) : null)
                .createdBy(formatFullName(reporter, "Unknown User"))
                .assignedTechnicianId(assignedTechnician != null ? safeGet(assignedTechnician::getUserId, null) : null)
                .assignedTechnician(assignedTechnician != null
                        ? formatFullName(assignedTechnician, "Unassigned")
                        : "Unassigned")
                .resolutionNotes(safeGet(ticket::getResolutionNotes, null))
                .rejectionReason(safeGet(ticket::getRejectionReason, null))
                .location(safeGet(ticket::getLocation, null))
                .contactNumber(safeGet(ticket::getContactNumber, null))
                .createdAt(safeGet(ticket::getCreatedAt, null))
                .updatedAt(safeGet(ticket::getUpdatedAt, null))
                .attachments(attachmentDTOs)
                .comments(commentDTOs)
                .build();
    }

    private TicketResponseDTO buildMinimalTicketResponse(MaintenanceTicket ticket) {
        return TicketResponseDTO.builder()
                .id(safeGet(ticket::getId, null))
                .title(safeGet(ticket::getTitle, "Ticket"))
                .description(safeGet(ticket::getDescription, null))
                .category(safeGet(ticket::getCategory, null))
                .priority(safeGet(ticket::getPriority, null))
                .status(safeGet(ticket::getStatus, null))
                .createdBy("Unknown User")
                .assignedTechnician("Unassigned")
                .resolutionNotes(safeGet(ticket::getResolutionNotes, null))
                .rejectionReason(safeGet(ticket::getRejectionReason, null))
                .location(safeGet(ticket::getLocation, null))
                .contactNumber(safeGet(ticket::getContactNumber, null))
                .createdAt(safeGet(ticket::getCreatedAt, null))
                .updatedAt(safeGet(ticket::getUpdatedAt, null))
                .attachments(Collections.emptyList())
                .comments(Collections.emptyList())
                .build();
    }

    private String formatFullName(User user, String fallback) {
        if (user == null) return fallback;
        try {
            String firstName = user.getFirstname() != null ? user.getFirstname().trim() : "";
            String lastName = user.getLastName() != null ? user.getLastName().trim() : "";
            String fullName = (firstName + " " + lastName).trim();
            return fullName.isBlank() ? fallback : fullName;
        } catch (RuntimeException ex) {
            return fallback;
        }
    }

    private <T> T safeGet(Supplier<T> supplier, T fallback) {
        try {
            T value = supplier.get();
            return value != null ? value : fallback;
        } catch (RuntimeException ex) {
            return fallback;
        }
    }

    private void notifyTicketCreated(MaintenanceTicket ticket, User reporter) {
        notificationService.createNotification(
                reporter,
                NotificationType.TICKET_CREATED,
                NotificationTargetType.TICKET,
                ticket.getId(),
                "Your ticket #" + ticket.getId() + " (" + ticket.getTitle() + ") has been created."
        );

        String reporterName = formatFullName(reporter, "a user");
        notificationService.notifyAdmins(
                NotificationType.TICKET_CREATED,
                NotificationTargetType.TICKET,
                ticket.getId(),
                "New ticket #" + ticket.getId() + " created by " + reporterName + ": " + ticket.getTitle() + ".",
                reporter != null ? reporter.getUserId() : null
        );
    }

    private void notifyTicketStatusChanged(MaintenanceTicket ticket, TicketStatus previousStatus, User actor) {
        if (ticket == null || ticket.getStatus() == null) {
            return;
        }
        if (previousStatus == ticket.getStatus()) {
            return;
        }

        String actorName = formatNotificationActorLabel(actor);
        String statusLabel = ticket.getStatus().name().replace("_", " ");
        String message = "Ticket #" + ticket.getId() + " status changed to " + statusLabel + " by " + actorName + ".";

        Long actorUserId = actor != null ? actor.getUserId() : null;
        Long reporterId = ticket.getReporter() != null ? ticket.getReporter().getUserId() : null;
        Long assignedId = ticket.getAssignedTechnician() != null ? ticket.getAssignedTechnician().getUserId() : null;

        if (ticket.getReporter() != null
                && (actorUserId == null || !actorUserId.equals(reporterId))) {
            notificationService.createNotification(
                    ticket.getReporter(),
                    NotificationType.TICKET_STATUS_CHANGED,
                    NotificationTargetType.TICKET,
                    ticket.getId(),
                    message
            );
        }

        if (ticket.getAssignedTechnician() != null
                && (actorUserId == null || !actorUserId.equals(assignedId))
                && (reporterId == null || !reporterId.equals(assignedId))) {
            notificationService.createNotification(
                    ticket.getAssignedTechnician(),
                    NotificationType.TICKET_STATUS_CHANGED,
                    NotificationTargetType.TICKET,
                    ticket.getId(),
                    message
            );
        }
    }

    private void notifyTicketCommentAdded(MaintenanceTicket ticket, User commentAuthor, String commentMessage) {
        if (ticket == null || commentAuthor == null) {
            return;
        }

        String authorName = formatNotificationActorLabel(commentAuthor);
        String trimmed = commentMessage == null ? "" : commentMessage.trim();
        String preview = trimmed.length() > 80 ? trimmed.substring(0, 80) + "..." : trimmed;
        String message = "New comment on ticket #" + ticket.getId() + " by " + authorName
                + (preview.isBlank() ? "." : ": " + preview);

        Long authorId = commentAuthor.getUserId();
        Long reporterId = ticket.getReporter() != null ? ticket.getReporter().getUserId() : null;
        Long assignedId = ticket.getAssignedTechnician() != null ? ticket.getAssignedTechnician().getUserId() : null;

        if (ticket.getReporter() != null
                && (authorId == null || !authorId.equals(reporterId))) {
            notificationService.createNotification(
                    ticket.getReporter(),
                    NotificationType.TICKET_COMMENT_ADDED,
                    NotificationTargetType.TICKET,
                    ticket.getId(),
                    message
            );
        }

        if (ticket.getAssignedTechnician() != null
                && (authorId == null || !authorId.equals(assignedId))
                && (reporterId == null || !reporterId.equals(assignedId))) {
            notificationService.createNotification(
                    ticket.getAssignedTechnician(),
                    NotificationType.TICKET_COMMENT_ADDED,
                    NotificationTargetType.TICKET,
                    ticket.getId(),
                    message
            );
        }
    }

    private String formatNotificationActorLabel(User actor) {
        if (actor == null) {
            return "System";
        }
        if (actor.getRole() == Role.ADMIN) {
            return "Admin";
        }
        if (actor.getRole() == Role.TECHNICIAN) {
            return "Technician";
        }
        return formatFullName(actor, "User");
    }
}
