package com.smartcampus.controller;

import com.smartcampus.dto.ApiResponse;
import com.smartcampus.dto.BookingRequestDTO;
import com.smartcampus.dto.BookingResponseDTO;
import com.smartcampus.dto.BookingStatusUpdateDTO;
import com.smartcampus.dto.DashboardStatsDTO;
import com.smartcampus.enums.BookingStatus;
import com.smartcampus.model.User;
import com.smartcampus.repository.UserRepo;
import com.smartcampus.service.BookingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/bookings")
@CrossOrigin
@RequiredArgsConstructor
public class BookingController {

    private final BookingService bookingService;
    private final UserRepo userRepo;

    @PostMapping
    public ResponseEntity<ApiResponse<BookingResponseDTO>> createBooking(
            @AuthenticationPrincipal User user,
            Authentication authentication,
            @Valid @RequestBody BookingRequestDTO bookingRequestDTO
    ) {
        User currentUser = resolveLoggedUser(user, authentication);
        BookingResponseDTO createdBooking = bookingService.createBooking(bookingRequestDTO, currentUser);

        return ResponseEntity.ok(new ApiResponse<>(true, createdBooking, null));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<BookingResponseDTO>>> getAllBookings() {
        List<BookingResponseDTO> bookings = bookingService.getAllBookings();
        return ResponseEntity.ok(new ApiResponse<>(true, bookings, null));
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<BookingResponseDTO>>> searchBookings(
            @RequestParam(required = false) String facility,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) BookingStatus status
    ) {
        List<BookingResponseDTO> results = bookingService.searchBookings(facility, date, status);
        return ResponseEntity.ok(new ApiResponse<>(true, results, null));
    }

    @GetMapping("/page")
    public ResponseEntity<ApiResponse<Page<BookingResponseDTO>>> getBookingsWithPagination(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "5") int size,
            @RequestParam(defaultValue = "id") String sortBy,
            @RequestParam(defaultValue = "asc") String direction
    ) {
        Page<BookingResponseDTO> result =
                bookingService.getBookingsWithPagination(page, size, sortBy, direction);
        return ResponseEntity.ok(new ApiResponse<>(true, result, null));
    }

    @GetMapping("/advanced-search")
    public ResponseEntity<ApiResponse<Page<BookingResponseDTO>>> advancedSearch(
            @RequestParam(required = false) String facility,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) BookingStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "5") int size,
            @RequestParam(defaultValue = "id") String sortBy,
            @RequestParam(defaultValue = "asc") String direction
    ) {
        Page<BookingResponseDTO> result = bookingService.advancedSearch(
                facility, date, status, page, size, sortBy, direction
        );
        return ResponseEntity.ok(new ApiResponse<>(true, result, null));
    }

    @GetMapping("/dashboard")
    public ResponseEntity<ApiResponse<DashboardStatsDTO>> getDashboardStats() {
        DashboardStatsDTO stats = bookingService.getDashboardStats();
        return ResponseEntity.ok(new ApiResponse<>(true, stats, null));
    }

    @GetMapping("/{id:\\d+}")
    public ResponseEntity<ApiResponse<BookingResponseDTO>> getBookingById(@PathVariable Long id) {
        BookingResponseDTO booking = bookingService.getBookingById(id);
        return ResponseEntity.ok(new ApiResponse<>(true, booking, null));
    }

    @PutMapping("/{id:\\d+}")
    public ResponseEntity<ApiResponse<BookingResponseDTO>> updateBooking(
            @PathVariable Long id,
            @Valid @RequestBody BookingRequestDTO dto
    ) {
        BookingResponseDTO updatedBooking = bookingService.updateBooking(id, dto);
        return ResponseEntity.ok(new ApiResponse<>(true, updatedBooking, null));
    }

    @PatchMapping("/{id:\\d+}/status")
    public ResponseEntity<ApiResponse<BookingResponseDTO>> updateStatus(
            @AuthenticationPrincipal User user,
            Authentication authentication,
            @PathVariable Long id,
            @Valid @RequestBody BookingStatusUpdateDTO dto
    ) {
        User currentUser = resolveLoggedUser(user, authentication);
        BookingResponseDTO updatedBooking = bookingService.updateStatus(id, dto.getStatus(), currentUser);
        return ResponseEntity.ok(new ApiResponse<>(true, updatedBooking, null));
    }

    @DeleteMapping("/{id:\\d+}")
    public ResponseEntity<ApiResponse<String>> deleteBooking(@PathVariable Long id) {
        bookingService.deleteBooking(id);
        return ResponseEntity.ok(new ApiResponse<>(true, "Booking deleted successfully", null));
    }

    private User resolveLoggedUser(User loggedUser, Authentication authentication) {
        if (loggedUser != null) {
            if (loggedUser.getEmail() != null && !loggedUser.getEmail().isBlank()) {
                return findUserByEmail(loggedUser.getEmail());
            }
            if (loggedUser.getUserId() != null) {
                return userRepo.findById(loggedUser.getUserId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
            }
        }

        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized");
        }

        Object principal = authentication.getPrincipal();

        if (principal instanceof User user) {
            if (user.getEmail() != null && !user.getEmail().isBlank()) {
                return findUserByEmail(user.getEmail());
            }
            if (user.getUserId() != null) {
                return userRepo.findById(user.getUserId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
            }
        }

        if (principal instanceof UserDetails userDetails) {
            return findUserByEmail(userDetails.getUsername());
        }

        if (principal instanceof OAuth2User oauth2User) {
            Object emailAttr = oauth2User.getAttribute("email");
            if (emailAttr != null) {
                return findUserByEmail(String.valueOf(emailAttr));
            }
        }

        if (principal instanceof String username
                && !username.isBlank()
                && !"anonymousUser".equalsIgnoreCase(username)) {
            return findUserByEmail(username);
        }

        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated user not found");
    }

    private User findUserByEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated user email missing");
        }

        return userRepo.findByEmailIgnoreCase(email.trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }
}
