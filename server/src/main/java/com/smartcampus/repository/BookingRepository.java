package com.smartcampus.repository;

import com.smartcampus.entity.Booking;
import com.smartcampus.enums.BookingStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public interface BookingRepository extends JpaRepository<Booking, Long> {

    @Query("SELECT b FROM Booking b WHERE " +
           "b.facilityName = :facilityName " +
           "AND b.bookingDate = :bookingDate " +
           "AND b.status IN ('APPROVED', 'PENDING') " +
           "AND (b.startTime < :endTime AND b.endTime > :startTime)")
    List<Booking> findConflictingBookings(
            @Param("facilityName") String facilityName,
            @Param("bookingDate") LocalDate bookingDate,
            @Param("startTime") LocalTime startTime,
            @Param("endTime") LocalTime endTime
    );

    List<Booking> findByFacilityNameContainingIgnoreCase(String facilityName);

    List<Booking> findByBookingDate(LocalDate bookingDate);

    List<Booking> findByStatus(BookingStatus status);

    List<Booking> findByFacilityNameContainingIgnoreCaseAndBookingDateAndStatus(
            String facilityName,
            LocalDate bookingDate,
            BookingStatus status
    );

    List<Booking> findByFacilityNameContainingIgnoreCaseAndBookingDate(
            String facilityName,
            LocalDate bookingDate
    );

    List<Booking> findByFacilityNameContainingIgnoreCaseAndStatus(
            String facilityName,
            BookingStatus status
    );

    List<Booking> findByBookingDateAndStatus(
            LocalDate bookingDate,
            BookingStatus status
    );

    long countByStatus(BookingStatus status);

    @Query("SELECT b FROM Booking b WHERE " +
           "(:facility IS NULL OR LOWER(b.facilityName) LIKE LOWER(CONCAT('%', :facility, '%'))) " +
           "AND (:date IS NULL OR b.bookingDate = :date) " +
           "AND (:status IS NULL OR b.status = :status)")
    Page<Booking> advancedSearch(
            @Param("facility") String facility,
            @Param("date") LocalDate date,
            @Param("status") BookingStatus status,
            Pageable pageable
    );
}