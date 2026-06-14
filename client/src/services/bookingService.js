import api from "../api";

const API_BASE = "/api/bookings";

// Get dashboard stats
export const getDashboardStats = async () => {
  const response = await api.get(`${API_BASE}/dashboard`);
  return response;
};

// Get all bookings
export const getAllBookings = async () => {
  const response = await api.get(API_BASE);
  return response;
};

// Create booking
export const createBooking = async (bookingData) => {
  const response = await api.post(API_BASE, bookingData);
  return response;
};

// Update booking status
export const updateBookingStatus = async (id, status) => {
  const response = await api.patch(`${API_BASE}/${id}/status`, {
    status,
  });
  return response;
};

// Advanced search
export const advancedSearch = async (params) => {
  const response = await api.get(`${API_BASE}/advanced-search`, {
    params,
  });
  return response;
};

// Get one booking by ID
export const getBookingById = async (id) => {
  const response = await api.get(`${API_BASE}/${id}`);
  return response;
};

// Update booking
export const updateBooking = async (id, data) => {
  const response = await api.put(`${API_BASE}/${id}`, data);
  return response;
};

// Delete booking
export const deleteBooking = async (id) => {
  const response = await api.delete(`${API_BASE}/${id}`);
  return response;
};

// Pagination
export const getBookingsWithPagination = async (
  page = 0,
  size = 5,
  sortBy = "id",
  direction = "asc"
) => {
  const response = await api.get(`${API_BASE}/page`, {
    params: { page, size, sortBy, direction },
  });
  return response;
};