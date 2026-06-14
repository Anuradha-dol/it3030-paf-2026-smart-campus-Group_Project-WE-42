package com.smartcampus.service;

import com.smartcampus.dto.BookingRequestDTO;
import com.smartcampus.dto.BookingResponseDTO;
import com.smartcampus.dto.DashboardStatsDTO;
import com.smartcampus.entity.Booking;
import com.smartcampus.enums.BookingStatus;
import com.smartcampus.enums.NotificationTargetType;
import com.smartcampus.enums.NotificationType;
import com.smartcampus.enums.Role;
import com.smartcampus.model.User;
import com.smartcampus.repository.BookingRepository;
import com.smartcampus.repository.UserRepo;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class BookingService {

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private UserRepo userRepo;

    public BookingResponseDTO createBooking(BookingRequestDTO dto, User createdByUser) {

        validateTimeRange(dto);
        validateConflict(dto, null);

        Booking booking = new Booking();
        booking.setFacilityName(dto.getFacilityName());
        booking.setBookingDate(dto.getBookingDate());
        booking.setStartTime(dto.getStartTime());
        booking.setEndTime(dto.getEndTime());
        booking.setAttendees(dto.getAttendees());
        booking.setPurpose(dto.getPurpose());
        booking.setBookedBy(formatBookedByValue(createdByUser, dto.getBookedBy()));

        // Set default status
        booking.setStatus(BookingStatus.PENDING);

        Booking savedBooking = bookingRepository.save(booking);

        if (createdByUser != null) {
            notificationService.createNotification(
                    createdByUser,
                    NotificationType.BOOKING_CREATED,
                    NotificationTargetType.BOOKING,
                    savedBooking.getId(),
                    "Your booking request for " + savedBooking.getFacilityName()
                            + " on " + savedBooking.getBookingDate()
                            + " is created and pending approval."
            );
        }

        notificationService.notifyAdmins(
                NotificationType.BOOKING_CREATED,
                NotificationTargetType.BOOKING,
                savedBooking.getId(),
                "New booking request from " + savedBooking.getBookedBy()
                        + " for " + savedBooking.getFacilityName()
                        + " on " + savedBooking.getBookingDate() + ".",
                createdByUser != null ? createdByUser.getUserId() : null
        );

        return mapToDTO(savedBooking);
    }

    public BookingResponseDTO updateBooking(Long id, BookingRequestDTO dto) {
        Booking existingBooking = bookingRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        validateTimeRange(dto);
        validateConflict(dto, id);

        existingBooking.setFacilityName(dto.getFacilityName());
        existingBooking.setBookingDate(dto.getBookingDate());
        existingBooking.setStartTime(dto.getStartTime());
        existingBooking.setEndTime(dto.getEndTime());
        existingBooking.setAttendees(dto.getAttendees());
        existingBooking.setPurpose(dto.getPurpose());
        if (dto.getBookedBy() != null && !dto.getBookedBy().isBlank()) {
            existingBooking.setBookedBy(mergeBookedByPreservingEmail(existingBooking.getBookedBy(), dto.getBookedBy()));
        }

        Booking updatedBooking = bookingRepository.save(existingBooking);
        return mapToDTO(updatedBooking);
    }

    public List<BookingResponseDTO> getAllBookings() {
        return bookingRepository.findAll()
                .stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    public BookingResponseDTO getBookingById(Long id) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Booking not found"));
        return mapToDTO(booking);
    }

    public void deleteBooking(Long id) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Booking not found"));
        bookingRepository.delete(booking);
    }

    public BookingResponseDTO updateStatus(Long id, BookingStatus status, User actor) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        if (booking.getStatus() == status) {
            return mapToDTO(booking);
        }

        booking.setStatus(status);
        Booking updatedBooking = bookingRepository.save(booking);

        if (status == BookingStatus.APPROVED || status == BookingStatus.REJECTED) {
            NotificationType notificationType = status == BookingStatus.APPROVED
                    ? NotificationType.BOOKING_APPROVED
                    : NotificationType.BOOKING_REJECTED;

            notificationService.createNotification(
                    resolveBookingOwnerUserId(updatedBooking),
                    notificationType,
                    NotificationTargetType.BOOKING,
                    updatedBooking.getId(),
                    buildBookingStatusMessage(updatedBooking, status, actor)
            );
        }

        return mapToDTO(updatedBooking);
    }

    public List<BookingResponseDTO> searchBookings(String facility, LocalDate date, BookingStatus status) {
        List<Booking> bookings;

        if (facility != null && !facility.isBlank() && date != null && status != null) {
            bookings = bookingRepository.findByFacilityNameContainingIgnoreCaseAndBookingDateAndStatus(facility, date, status);
        } else if (facility != null && !facility.isBlank() && date != null) {
            bookings = bookingRepository.findByFacilityNameContainingIgnoreCaseAndBookingDate(facility, date);
        } else if (facility != null && !facility.isBlank() && status != null) {
            bookings = bookingRepository.findByFacilityNameContainingIgnoreCaseAndStatus(facility, status);
        } else if (date != null && status != null) {
            bookings = bookingRepository.findByBookingDateAndStatus(date, status);
        } else if (facility != null && !facility.isBlank()) {
            bookings = bookingRepository.findByFacilityNameContainingIgnoreCase(facility);
        } else if (date != null) {
            bookings = bookingRepository.findByBookingDate(date);
        } else if (status != null) {
            bookings = bookingRepository.findByStatus(status);
        } else {
            bookings = bookingRepository.findAll();
        }

        return bookings.stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    public Page<BookingResponseDTO> getBookingsWithPagination(int page, int size, String sortBy, String direction) {
        Sort sort = direction.equalsIgnoreCase("desc")
                ? Sort.by(sortBy).descending()
                : Sort.by(sortBy).ascending();

        Pageable pageable = PageRequest.of(page, size, sort);

        return bookingRepository.findAll(pageable).map(this::mapToDTO);
    }

    public Page<BookingResponseDTO> advancedSearch(
            String facility,
            LocalDate date,
            BookingStatus status,
            int page,
            int size,
            String sortBy,
            String direction
    ) {
        Sort sort = direction.equalsIgnoreCase("desc")
                ? Sort.by(sortBy).descending()
                : Sort.by(sortBy).ascending();

        Pageable pageable = PageRequest.of(page, size, sort);

        return bookingRepository.advancedSearch(facility, date, status, pageable)
                .map(this::mapToDTO);
    }

    public DashboardStatsDTO getDashboardStats() {
        DashboardStatsDTO stats = new DashboardStatsDTO();

        stats.setTotalBookings(bookingRepository.count());
        stats.setPendingBookings(bookingRepository.countByStatus(BookingStatus.PENDING));
        stats.setApprovedBookings(bookingRepository.countByStatus(BookingStatus.APPROVED));
        stats.setRejectedBookings(bookingRepository.countByStatus(BookingStatus.REJECTED));

        return stats;
    }

    private void validateTimeRange(BookingRequestDTO dto) {
        if (dto.getStartTime() == null || dto.getEndTime() == null) {
            throw new RuntimeException("Start time and end time are required");
        }

        if (!dto.getStartTime().isBefore(dto.getEndTime())) {
            throw new RuntimeException("Start time must be before end time");
        }
    }

    private void validateConflict(BookingRequestDTO dto, Long bookingIdToExclude) {
        List<Booking> conflicts = bookingRepository.findConflictingBookings(
                dto.getFacilityName(),
                dto.getBookingDate(),
                dto.getStartTime(),
                dto.getEndTime()
        );

        if (bookingIdToExclude != null) {
            conflicts = conflicts.stream()
                    .filter(booking -> !booking.getId().equals(bookingIdToExclude))
                    .collect(Collectors.toList());
        }

        if (!conflicts.isEmpty()) {
            throw new RuntimeException("This facility is already booked for the selected date and time");
        }
    }

    private BookingResponseDTO mapToDTO(Booking booking) {
        BookingResponseDTO dto = new BookingResponseDTO();
        dto.setId(booking.getId());
        dto.setFacilityName(booking.getFacilityName());
        dto.setBookingDate(booking.getBookingDate());
        dto.setStartTime(booking.getStartTime());
        dto.setEndTime(booking.getEndTime());
        dto.setAttendees(booking.getAttendees());
        dto.setPurpose(booking.getPurpose());
        dto.setBookedBy(booking.getBookedBy());
        dto.setStatus(booking.getStatus());
        return dto;
    }

    private String formatUserDisplayName(User user, String fallback) {
        String safeFallback = fallback != null ? fallback.trim() : "";
        if (user == null) {
            return safeFallback.isBlank() ? "User" : safeFallback;
        }

        String firstName = user.getFirstname() != null ? user.getFirstname().trim() : "";
        String lastName = user.getLastName() != null ? user.getLastName().trim() : "";
        String fullName = (firstName + " " + lastName).trim();

        if (!fullName.isBlank()) {
            return fullName;
        }
        if (user.getEmail() != null && !user.getEmail().isBlank()) {
            return user.getEmail();
        }
        return safeFallback.isBlank() ? "User" : safeFallback;
    }

    private String formatBookedByValue(User user, String fallback) {
        if (user == null) {
            return formatUserDisplayName(null, fallback);
        }

        String displayName = formatUserDisplayName(user, fallback);
        String email = user.getEmail() != null ? user.getEmail().trim() : "";
        if (!email.isBlank()) {
            return displayName + " <" + email + ">";
        }
        return displayName;
    }

    private Long resolveBookingOwnerUserId(Booking booking) {
        if (booking == null || booking.getBookedBy() == null || booking.getBookedBy().isBlank()) {
            return notificationService.findBookingOwnerFromCreateNotification(
                    booking != null ? booking.getId() : null
            );
        }

        String email = extractEmailFromBookedBy(booking.getBookedBy());
        if (email != null && !email.isBlank()) {
            Long userIdByEmail = userRepo.findByEmailIgnoreCase(email.trim())
                    .map(User::getUserId)
                    .orElse(null);
            if (userIdByEmail != null) {
                return userIdByEmail;
            }
        }

        Long userIdByName = resolveByDisplayName(booking.getBookedBy());
        if (userIdByName != null) {
            return userIdByName;
        }

        return notificationService.findBookingOwnerFromCreateNotification(booking.getId());
    }

    private String extractEmailFromBookedBy(String bookedBy) {
        if (bookedBy == null) {
            return null;
        }

        String value = bookedBy.trim();
        if (value.isBlank()) {
            return null;
        }

        Pattern bracketEmailPattern = Pattern.compile("<([^>]+@[^>]+)>");
        Matcher matcher = bracketEmailPattern.matcher(value);
        if (matcher.find()) {
            return matcher.group(1).trim();
        }

        if (value.contains("@") && !value.contains(" ")) {
            return value;
        }

        return null;
    }

    private Long resolveByDisplayName(String bookedBy) {
        if (bookedBy == null || bookedBy.isBlank()) {
            return null;
        }

        String normalized = bookedBy.replaceAll("<[^>]+>", "").trim();
        if (normalized.isBlank()) {
            return null;
        }

        String[] parts = normalized.split("\\s+");
        if (parts.length < 2) {
            return null;
        }

        String firstName = parts[0];
        String lastName = parts[parts.length - 1];

        return userRepo.findFirstByFirstnameIgnoreCaseAndLastNameIgnoreCase(firstName, lastName)
                .map(User::getUserId)
                .orElse(null);
    }

    private String mergeBookedByPreservingEmail(String existingValue, String incomingValue) {
        String incoming = incomingValue == null ? "" : incomingValue.trim();
        if (incoming.isBlank()) {
            return existingValue;
        }

        String incomingEmail = extractEmailFromBookedBy(incoming);
        if (incomingEmail != null) {
            return incoming;
        }

        String existingEmail = extractEmailFromBookedBy(existingValue);
        if (existingEmail == null || existingEmail.isBlank()) {
            return incoming;
        }

        return incoming + " <" + existingEmail + ">";
    }

    private String buildBookingStatusMessage(Booking booking, BookingStatus status, User actor) {
        String actorName = formatActionActorLabel(actor);
        if (status == BookingStatus.APPROVED) {
            return "Your booking for " + booking.getFacilityName() + " on " + booking.getBookingDate()
                    + " has been approved by " + actorName + ".";
        }
        return "Your booking for " + booking.getFacilityName() + " on " + booking.getBookingDate()
                + " has been rejected by " + actorName + ".";
    }

    private String formatActionActorLabel(User actor) {
        if (actor == null) {
            return "System";
        }
        if (actor.getRole() == Role.ADMIN) {
            return "Admin";
        }
        return formatUserDisplayName(actor, "User");
    }
}
