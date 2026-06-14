package com.smartcampus.dto;

import com.smartcampus.enums.Priority;
import com.smartcampus.enums.TicketStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TicketResponseDTO {
    private Long id;
    private String title;
    private String description;
    private String category;
    private Priority priority;
    private TicketStatus status;
    private String createdBy;
    private Long createdById;
    private String assignedTechnician;
    private Long assignedTechnicianId;
    private String resolutionNotes;
    private String rejectionReason;
    private String location;
    private String contactNumber;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<AttachmentDTO> attachments;
    private List<CommentDTO> comments;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AttachmentDTO {
        private Long id;
        private String fileName;
        private String filePath;
        private String fileType;
    }
}
