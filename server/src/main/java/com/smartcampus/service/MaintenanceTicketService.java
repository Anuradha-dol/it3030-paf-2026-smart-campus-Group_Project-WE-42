package com.smartcampus.service;

import com.smartcampus.dto.CommentDTO;
import com.smartcampus.dto.TicketRequestDTO;
import com.smartcampus.dto.TicketResponseDTO;
import com.smartcampus.enums.TicketStatus;
import com.smartcampus.model.User;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface MaintenanceTicketService {
    TicketResponseDTO createTicket(TicketRequestDTO request, List<MultipartFile> attachments, User user);
    List<TicketResponseDTO> getAllTickets();
    TicketResponseDTO getTicketById(Long id);
    TicketResponseDTO updateTicketStatus(Long id, TicketStatus status, String notes, User user);
    TicketResponseDTO assignTechnician(Long id, Long technicianId, User admin);
    TicketResponseDTO addComment(Long id, String message, User user);
    void deleteComment(Long ticketId, Long commentId, User user);
}
