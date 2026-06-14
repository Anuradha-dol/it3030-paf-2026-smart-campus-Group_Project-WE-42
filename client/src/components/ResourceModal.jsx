import React, { useState, useEffect } from 'react';
import ResourceForm from './ResourceForm';
import { createResource, updateResource, getResourceById } from '../services/resourceService';
import './ResourceModal.css';

const resolveResourceImage = (resource) => {
    const rawImage = resource?.imageUrl || resource?.image || resource?.imageBase64 || resource?.resourceImage;
    if (!rawImage || typeof rawImage !== 'string') return '';
    if (rawImage.startsWith('data:image/')) return rawImage;
    return `data:image/jpeg;base64,${rawImage}`;
};

const ResourceModal = ({ isOpen, onClose, mode, resourceId, onSaved, isAdmin }) => {
    const [resource, setResource] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && (mode === 'edit' || mode === 'view') && resourceId) {
            fetchResource();
        } else {
            setResource(null);
            setError('');
        }
    }, [isOpen, mode, resourceId]);

    const fetchResource = async () => {
        try {
            setIsLoading(true);
            const data = await getResourceById(resourceId);
            if (mode === 'edit') {
                if (data.availableFrom) data.availableFrom = data.availableFrom.substring(0, 5);
                if (data.availableTo) data.availableTo = data.availableTo.substring(0, 5);
            }
            setResource(data);
        } catch (err) {
            setError('Failed to load resource data.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (resourceData) => {
        try {
            setIsLoading(true);
            setError('');
            if (mode === 'add') {
                await createResource(resourceData);
            } else if (mode === 'edit') {
                await updateResource(resourceId, resourceData);
            }
            onSaved();
        } catch (err) {
            const backendMessage = err?.response?.data?.message || err?.response?.data;
            setError(backendMessage || `Failed to ${mode} resource. Please try again.`);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="rm-overlay" onClick={onClose}>
            <div className="rm-modal" onClick={e => e.stopPropagation()}>
                <button className="rm-close-btn" onClick={onClose}>&times;</button>
                <div className="rm-header">
                    <h2>{mode === 'add' ? 'Add New Resource' : mode === 'edit' ? 'Edit Resource' : 'Resource Details'}</h2>
                    <p>{mode === 'view' ? 'View complete resource information' : 'Fill in the resource details below.'}</p>
                </div>
                
                {error && <div className="rm-alert rm-error">{error}</div>}

                <div className="rm-content">
                    {mode === 'add' ? (
                        <ResourceForm onSubmit={handleSave} isLoading={isLoading} />
                    ) : (mode === 'edit' || mode === 'view') && !resource && isLoading ? (
                        <div className="rm-loading">Loading...</div>
                    ) : mode === 'edit' && resource ? (
                        <ResourceForm initialData={resource} onSubmit={handleSave} isLoading={isLoading} />
                    ) : mode === 'view' && resource ? (
                        <div className="rm-details">
                            <div className="rm-details-header">
                                <h3>{resource.name}</h3>
                                <span className={`rm-status status-${String(resource?.status || '').toLowerCase()}`}>
                                    {resource.status}
                                </span>
                            </div>
                            
                            {resolveResourceImage(resource) && (
                                <div className="rm-image-wrapper">
                                    <img src={resolveResourceImage(resource)} alt={`${resource.name} preview`} />
                                </div>
                            )}

                            <div className="rm-info-grid">
                                <div className="rm-info-item">
                                    <span className="rm-label">Type</span>
                                    <span className="rm-value">{resource.type}</span>
                                </div>
                                <div className="rm-info-item">
                                    <span className="rm-label">Capacity</span>
                                    <span className="rm-value">{resource.capacity}</span>
                                </div>
                                <div className="rm-info-item">
                                    <span className="rm-label">Location</span>
                                    <span className="rm-value">{resource.location}</span>
                                </div>
                                <div className="rm-info-item">
                                    <span className="rm-label">Available From</span>
                                    <span className="rm-value">{resource.availableFrom || 'N/A'}</span>
                                </div>
                                <div className="rm-info-item">
                                    <span className="rm-label">Available To</span>
                                    <span className="rm-value">{resource.availableTo || 'N/A'}</span>
                                </div>
                            </div>

                            <div className="rm-info-item rm-desc">
                                <span className="rm-label">Description</span>
                                <span className="rm-value">{resource.description || 'No description provided.'}</span>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default ResourceModal;
