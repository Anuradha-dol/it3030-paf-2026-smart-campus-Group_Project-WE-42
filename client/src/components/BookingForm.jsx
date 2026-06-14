// src/components/BookingForm.js
import { useState, useCallback, useEffect } from "react";

function BookingForm({ onCreate, initialData = {} }) {
  const [formData, setFormData] = useState({
    facilityName: initialData.facilityName || "",
    bookingDate: initialData.bookingDate || "",
    startTime: initialData.startTime || "",
    endTime: initialData.endTime || "",
    attendees: initialData.attendees || 1,
    purpose: initialData.purpose || "",
    bookedBy: initialData.bookedBy || "",
  });

  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [backendError, setBackendError] = useState("");

  // Reset form when initialData changes (e.g., new resource selected)
  useEffect(() => {
    setFormData({
      facilityName: initialData.facilityName || "",
      bookingDate: initialData.bookingDate || "",
      startTime: initialData.startTime || "",
      endTime: initialData.endTime || "",
      attendees: initialData.attendees || 1,
      purpose: initialData.purpose || "",
      bookedBy: initialData.bookedBy || "",
    });
    setTouched({});
    setErrors({});
    setBackendError("");
  }, [
    initialData.facilityName,
    initialData.bookingDate,
    initialData.startTime,
    initialData.endTime,
    initialData.attendees,
    initialData.purpose,
    initialData.bookedBy,
  ]);

  // Validate a single field
  const validateField = useCallback((name, value, allData = formData) => {
    switch (name) {
      case "facilityName":
        return !value?.trim() ? "Facility name is required" : "";
      case "bookingDate":
        if (!value) return "Booking date is required";
        const selectedDate = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return selectedDate < today ? "Booking date cannot be in the past" : "";
      case "startTime":
        if (!value) return "Start time is required";
        if (allData.endTime && value >= allData.endTime)
          return "Start time must be before end time";
        return "";
      case "endTime":
        if (!value) return "End time is required";
        if (allData.startTime && value <= allData.startTime)
          return "End time must be after start time";
        return "";
      case "attendees":
        const num = Number(value);
        return !value || num < 1 ? "At least 1 attendee required" : "";
      case "bookedBy":
        return !value?.trim() ? "Your name is required" : "";
      case "purpose":
        return !value?.trim() ? "Purpose is required" : "";
      default:
        return "";
    }
  }, [formData]);

  // Validate all fields (for final submit)
  const validateForm = useCallback(() => {
    const newErrors = {};
    Object.keys(formData).forEach((key) => {
      const error = validateField(key, formData[key]);
      if (error) newErrors[key] = error;
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, validateField]);

  // Handle input change with real‑time validation
  const handleChange = (e) => {
    const { name, value } = e.target;
    const newValue = name === "attendees" ? (value === "" ? "" : Number(value)) : value;
    const updatedData = { ...formData, [name]: newValue };
    setFormData(updatedData);

    // Real‑time validation (only if field was already touched)
    if (touched[name]) {
      const error = validateField(name, newValue, updatedData);
      setErrors((prev) => ({ ...prev, [name]: error }));
    }
  };

  // Mark field as touched on blur and validate
  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    const error = validateField(name, formData[name]);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBackendError("");

    // Mark all fields as touched to show errors
    const allTouched = Object.keys(formData).reduce((acc, key) => ({ ...acc, [key]: true }), {});
    setTouched(allTouched);

    const isValid = validateForm();
    if (!isValid) return;

    setSubmitting(true);
    const result = await onCreate(formData);
    setSubmitting(false);

    if (result?.errors) {
      const backendFieldErrors = result.errors;
      setErrors((prev) => ({ ...prev, ...backendFieldErrors }));
      if (backendFieldErrors.booking) {
        setBackendError(backendFieldErrors.booking);
      }
    }
  };

  const handleReset = () => {
    setFormData({
      facilityName: initialData.facilityName || "",
      bookingDate: initialData.bookingDate || "",
      startTime: initialData.startTime || "",
      endTime: initialData.endTime || "",
      attendees: initialData.attendees || 1,
      purpose: "",
      bookedBy: initialData.bookedBy || "",
    });
    setTouched({});
    setErrors({});
    setBackendError("");
  };

  return (
    <form className="md-booking-form" onSubmit={handleSubmit} noValidate>
      <div className="md-booking-form-grid">
        {/* Facility Name */}
        <div className="md-booking-field">
          <label htmlFor="facilityName">
            Facility Name <span className="required-star">*</span>
          </label>
          <input
            id="facilityName"
            type="text"
            name="facilityName"
            value={formData.facilityName}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="e.g., Conference Hall A"
            required
            className={touched.facilityName && errors.facilityName ? "error" : ""}
          />
          {touched.facilityName && errors.facilityName && (
            <p className="md-field-error">{errors.facilityName}</p>
          )}
        </div>

        {/* Booking Date */}
        <div className="md-booking-field">
          <label htmlFor="bookingDate">
            Booking Date <span className="required-star">*</span>
          </label>
          <input
            id="bookingDate"
            type="date"
            name="bookingDate"
            value={formData.bookingDate}
            onChange={handleChange}
            onBlur={handleBlur}
            required
            className={touched.bookingDate && errors.bookingDate ? "error" : ""}
          />
          {touched.bookingDate && errors.bookingDate && (
            <p className="md-field-error">{errors.bookingDate}</p>
          )}
        </div>

        {/* Start Time */}
        <div className="md-booking-field">
          <label htmlFor="startTime">
            Start Time <span className="required-star">*</span>
          </label>
          <input
            id="startTime"
            type="time"
            name="startTime"
            value={formData.startTime}
            onChange={handleChange}
            onBlur={handleBlur}
            required
            className={touched.startTime && errors.startTime ? "error" : ""}
          />
          {touched.startTime && errors.startTime && (
            <p className="md-field-error">{errors.startTime}</p>
          )}
        </div>

        {/* End Time */}
        <div className="md-booking-field">
          <label htmlFor="endTime">
            End Time <span className="required-star">*</span>
          </label>
          <input
            id="endTime"
            type="time"
            name="endTime"
            value={formData.endTime}
            onChange={handleChange}
            onBlur={handleBlur}
            required
            className={touched.endTime && errors.endTime ? "error" : ""}
          />
          {touched.endTime && errors.endTime && (
            <p className="md-field-error">{errors.endTime}</p>
          )}
        </div>

        {/* Attendees */}
        <div className="md-booking-field">
          <label htmlFor="attendees">
            Number of Attendees <span className="required-star">*</span>
          </label>
          <input
            id="attendees"
            type="number"
            name="attendees"
            value={formData.attendees}
            onChange={handleChange}
            onBlur={handleBlur}
            min="1"
            required
            className={touched.attendees && errors.attendees ? "error" : ""}
          />
          {touched.attendees && errors.attendees && (
            <p className="md-field-error">{errors.attendees}</p>
          )}
        </div>

        {/* Booked By */}
        <div className="md-booking-field">
          <label htmlFor="bookedBy">
            Your Name <span className="required-star">*</span>
          </label>
          <input
            id="bookedBy"
            type="text"
            name="bookedBy"
            value={formData.bookedBy}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Enter your full name"
            required
            className={touched.bookedBy && errors.bookedBy ? "error" : ""}
          />
          {touched.bookedBy && errors.bookedBy && (
            <p className="md-field-error">{errors.bookedBy}</p>
          )}
        </div>

        {/* Purpose (full width) */}
        <div className="md-booking-field md-booking-field-full">
          <label htmlFor="purpose">
            Purpose of Booking <span className="required-star">*</span>
          </label>
          <textarea
            id="purpose"
            name="purpose"
            value={formData.purpose}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Describe why you need this resource (meeting, training, event, etc.)"
            rows="4"
            required
            className={touched.purpose && errors.purpose ? "error" : ""}
          />
          {touched.purpose && errors.purpose && (
            <p className="md-field-error">{errors.purpose}</p>
          )}
        </div>
      </div>

      {/* Backend global error */}
      {backendError && <div className="md-booking-inline-error">{backendError}</div>}

      {/* Form Actions */}
      <div className="md-booking-actions">
        <button
          type="submit"
          className="md-booking-submit"
          disabled={submitting}
        >
          {submitting ? (
            <>
              <span className="spinner-small"></span> Creating...
            </>
          ) : (
            "Create Booking"
          )}
        </button>
        <button
          type="button"
          className="md-booking-reset"
          onClick={handleReset}
        >
          Reset
        </button>
      </div>
    </form>
  );
}

export default BookingForm;
