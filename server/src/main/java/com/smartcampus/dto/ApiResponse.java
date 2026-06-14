package com.smartcampus.dto;

import java.util.Map;

public class ApiResponse<T> {

    private boolean success;
    private T data;
    private Map<String, String> errors;

    // Constructor
    public ApiResponse(boolean success, T data, Map<String, String> errors) {
        this.success = success;
        this.data = data;
        this.errors = errors;
    }

    // Getters
    public boolean isSuccess() {
        return success;
    }

    public T getData() {
        return data;
    }

    public Map<String, String> getErrors() {
        return errors;
    }
}