import React, { useState } from 'react';

const ResourceForm = ({ initialData, onSubmit, isLoading }) => {
    const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
    const [formData, setFormData] = useState({
        name: '',
        type: 'LECTURE_HALL',
        capacity: '',
        location: '',
        availableFrom: '',
        availableTo: '',
        status: 'ACTIVE',
        description: '',
        imageUrl: '',
        image: '',
        ...initialData
    });
    const [validationError, setValidationError] = useState('');
    const [imageError, setImageError] = useState('');
    const previewImage = formData.imageUrl || formData.image;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setValidationError('');
        setFormData({ ...formData, [name]: value });
    };

    const handleImageChange = (e) => {
        const selectedFile = e.target.files?.[0];
        setImageError('');

        if (!selectedFile) {
            return;
        }

        if (!selectedFile.type.startsWith('image/')) {
            setImageError('Please select a valid image file.');
            e.target.value = '';
            return;
        }

        if (selectedFile.size > MAX_IMAGE_SIZE_BYTES) {
            setImageError('Image size must be 5MB or less.');
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setFormData((prev) => ({ ...prev, imageUrl: reader.result, image: reader.result }));
        };
        reader.onerror = () => {
            setImageError('Unable to read the selected image. Please try another file.');
        };
        reader.readAsDataURL(selectedFile);
    };

    const handleRemoveImage = () => {
        setImageError('');
        setFormData((prev) => ({ ...prev, imageUrl: '', image: '' }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (formData.availableFrom && formData.availableTo && formData.availableFrom >= formData.availableTo) {
            setValidationError('Available From must be earlier than Available To.');
            return;
        }

        if (imageError) {
            return;
        }

        // Convert capacity to integer before sending...
        setValidationError('');
        const normalizedImage = formData.imageUrl || formData.image || '';
        onSubmit({
            ...formData,
            imageUrl: normalizedImage,
            image: normalizedImage,
            capacity: parseInt(formData.capacity, 10)
        });
    };

    return (
        <form onSubmit={handleSubmit} className="resource-form">
            <div className="form-group">
                <label>Name:</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} required />
            </div>

            <div className="form-group">
                <label>Type:</label>
                <select name="type" value={formData.type} onChange={handleChange} required>
                    <option value="LECTURE_HALL">Lecture Hall</option>
                    <option value="LAB">Lab</option>
                    <option value="MEETING_ROOM">Meeting Room</option>
                    <option value="EQUIPMENT">Equipment</option>
                </select>
            </div>

            <div className="form-group">
                <label>Capacity:</label>
                <input type="number" name="capacity" value={formData.capacity} onChange={handleChange} required min="1" />
            </div>

            <div className="form-group">
                <label>Location:</label>
                <input type="text" name="location" value={formData.location} onChange={handleChange} required />
            </div>

            <div className="form-group">
                <label>Available From:</label>
                <input type="time" name="availableFrom" value={formData.availableFrom} onChange={handleChange} required />
            </div>

            <div className="form-group">
                <label>Available To:</label>
                <input type="time" name="availableTo" value={formData.availableTo} onChange={handleChange} required />
            </div>

            <div className="form-group">
                <label>Status:</label>
                <select name="status" value={formData.status} onChange={handleChange} required>
                    <option value="ACTIVE">Active</option>
                    <option value="OUT_OF_SERVICE">Out of Service</option>
                    <option value="MAINTENANCE">Maintenance</option>
                </select>
            </div>

            <div className="form-group">
                <label>Description:</label>
                <textarea name="description" value={formData.description} onChange={handleChange} rows="3" />
            </div>

            <div className="form-group">
                <label>Resource Image (Optional):</label>
                <input type="file" accept="image/*" onChange={handleImageChange} />
                {previewImage && (
                    <>
                        <img src={previewImage} alt="Resource preview" className="resource-form-image-preview" />
                        <button type="button" className="btn btn-clear" onClick={handleRemoveImage} style={{ marginTop: '10px' }}>
                            Remove Image
                        </button>
                    </>
                )}
            </div>

            {validationError && <div className="alert error">{validationError}</div>}
            {imageError && <div className="alert error">{imageError}</div>}

            <button type="submit" className="btn btn-primary" disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save Resource'}
            </button>
        </form>
    );
};

export default ResourceForm;