import React from 'react';
import { Link } from 'react-router-dom';

import { useNavigate } from "react-router-dom";



const resolveResourceImage = (resource) => {
    const rawImage = resource?.imageUrl || resource?.image || resource?.imageBase64 || resource?.resourceImage;
    if (!rawImage || typeof rawImage !== 'string') {
        return '';
    }

    if (rawImage.startsWith('data:image/')) {
        return rawImage;
    }

    // If backend returns plain base64, convert it to a data URL for rendering.
    return `data:image/jpeg;base64,${rawImage}`;
};

const ResourceTable = ({ resources, onDeleteClick, basePath = '/resources', canManage = true, showBook = false, onOpenModal }) => {
    if (!resources || resources.length === 0) {
        return (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', marginTop: '20px' }}>
                <h3>No resources found</h3>
                <p>Try adjusting your search criteria or add a new resource.</p>
            </div>
        );
    }

    const navigate = useNavigate();
    

    return (
        <div className="resource-grid">
            {resources.map((resource) => {
                const imageSource = resolveResourceImage(resource);
                return (
                    <div key={resource.id} className="resource-card glass-panel">
                        {/* Modern Image Header edge-to-edge */}
                        {imageSource && (
                            <div className="resource-image-header">
                                <img
                                    src={imageSource}
                                    alt={`${resource.name} preview`}
                                    className="resource-card-cover"
                                    loading="lazy"
                                />
                                <div className="glassy-overlay"></div>
                                <span className={`floating-status status-indicator status-${resource.status?.toLowerCase()}`}>
                                    {resource.status}
                                </span>
                            </div>
                        )}

                        <div className="card-content-padding">
                            <div className="card-header">
                                <div className="card-title-group">
                                    <h3>{resource.name}</h3>
                                    <span className="badge badge-type">{resource.type?.replace('_', ' ')}</span>
                                </div>
                                {!imageSource && (
                                    <span className={`status-indicator status-${resource.status?.toLowerCase()}`}>
                                        {resource.status}
                                    </span>
                                )}
                            </div>

                            <div className="card-body">
                                <div className="info-row">
                                    <i className="icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>
                                        </svg>
                                    </i>
                                    <div className="info-content">
                                        <span className="label">Location</span>
                                        <span className="value">{resource.location}</span>
                                    </div>
                                </div>

                                <div className="info-row">
                                    <i className="icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                            <circle cx="9" cy="7" r="4"></circle>
                                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                        </svg>
                                    </i>
                                    <div className="info-content">
                                        <span className="label">Capacity</span>
                                        <span className="value">{resource.capacity} {resource.type === 'EQUIPMENT' ? 'units' : 'people'}</span>
                                    </div>
                                </div>

                                <div className="info-row">
                                    <i className="icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>
                                        </svg>
                                    </i>
                                    <div className="info-content">
                                        <span className="label">Availability</span>
                                        <span className="value">
                                            {resource.availableFrom ? `${resource.availableFrom} - ${resource.availableTo}` : 'Anytime'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="card-footer">
                                <div className="action-buttons">
                                    <button onClick={() => onOpenModal('view', resource.id)} className="btn btn-view" style={{ border: 'none', cursor: 'pointer' }}>
                                        View
                                    </button>
                                    {canManage && (
                                        <>
                                            <button onClick={() => onOpenModal('edit', resource.id)} className="btn btn-edit" style={{ border: 'none', cursor: 'pointer' }}>
                                                Edit
                                            </button>
                                            <button onClick={() => onDeleteClick(resource)} className="btn btn-delete">
                                                Delete
                                            </button>
                                        </>
                                    )}
                                    {!canManage && showBook && (
                                         <button
                                           type="button"
                                           className="btn btn-primary"
                                           onClick={() =>
                                               navigate('/bookings', {
                                                  state: {
                                                     resourceId: resource.id,
                                                     facilityName: resource.name,
                                                     location: resource.location,
                                                     capacity: resource.capacity,
                                                     availableFrom: resource.availableFrom,
                                                     availableTo: resource.availableTo,
                                         },
                                     })
                            }
                        >
                             Book Now
                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default ResourceTable;
