package com.smartcampus.dto;

import com.smartcampus.enums.BookingStatus;
import jakarta.validation.constraints.NotNull;

public class BookingStatusUpdateDTO {

    @NotNull(message = "Status is required")
    private BookingStatus status;

    public BookingStatus getStatus() {
        return status;
    }

    public void setStatus(BookingStatus status) {
        this.status = status;
    }
}