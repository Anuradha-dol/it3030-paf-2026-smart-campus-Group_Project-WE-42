import React, { useCallback, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllResources, deleteResource } from '../services/resourceService';
import ResourceTable from '../components/ResourceTable';
import SearchFilterBar from '../components/SearchFilterBar';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import ResourceModal from '../components/ResourceModal';
import './ResourceTheme.css';

const ResourceListPage = ({ embedded = false, basePath = '/resources', canManage = true, showBook = false }) => {
    const [resources, setResources] = useState([]);
    const [filteredResources, setFilteredResources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState('');

    // Modal state
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [resourceToDelete, setResourceToDelete] = useState(null);

    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState(''); // 'add', 'edit', 'view'
    const [modalResourceId, setModalResourceId] = useState(null);

    useEffect(() => {
        fetchResources();
    }, []);

    const fetchResources = async () => {
        try {
            setLoading(true);
            const data = await getAllResources();
            setResources(data);
            setFilteredResources(data);
            setError(null);
        } catch (err) {
            setError('Failed to fetch resources. Is the backend running?');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = useCallback(({ location, type, minCapacity, maxCapacity, status }) => {
        let filtered = resources;
        const normalizedText = (location || '').trim().toLowerCase();
        const minCapacityValue = minCapacity === '' ? null : Number(minCapacity);
        const maxCapacityValue = maxCapacity === '' ? null : Number(maxCapacity);
        
        if (normalizedText) {
            filtered = filtered.filter(item => 
                (item.location || '').toLowerCase().includes(normalizedText) ||
                (item.name || '').toLowerCase().includes(normalizedText)
            );
        }
        if (type) {
            filtered = filtered.filter(item => item.type === type);
        }
        if (minCapacityValue !== null && !Number.isNaN(minCapacityValue)) {
            filtered = filtered.filter(item => Number(item.capacity) >= minCapacityValue);
        }
        if (maxCapacityValue !== null && !Number.isNaN(maxCapacityValue)) {
            filtered = filtered.filter(item => Number(item.capacity) <= maxCapacityValue);
        }
        if (status) {
            filtered = filtered.filter(item => item.status === status);
        }

        setFilteredResources(filtered);
    }, [resources]);

    const confirmDelete = (resource) => {
        setResourceToDelete(resource);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = async () => {
        try {
            await deleteResource(resourceToDelete.id);
            setSuccessMsg('Resource deleted successfully!');
            setIsDeleteModalOpen(false);
            setResourceToDelete(null);
            fetchResources(); // Refresh table
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            setError('Failed to delete resource.');
            console.error(err);
        }
    };

    const openModal = (mode, id = null) => {
        setModalMode(mode);
        setModalResourceId(id);
        setModalOpen(true);
    };

    const handleModalSaved = () => {
        setModalOpen(false);
        setSuccessMsg(modalMode === 'add' ? 'Resource created successfully!' : 'Resource updated successfully!');
        fetchResources();
        setTimeout(() => setSuccessMsg(''), 3000);
    };

    return (
        <div className={`resource-list-container ${!embedded ? 'resource-theme-root' : ''}`} style={!embedded ? { padding: '40px 20px' } : {}}>
            {!embedded && <h1>Facilities & Assets Catalogue</h1>}

            {error && <div className="alert error">{error}</div>}
            {successMsg && <div className="alert success">{successMsg}</div>}

            <div className="top-bar">
                <SearchFilterBar onSearch={handleSearch} />
                {canManage && (
                    <button onClick={() => openModal('add')} className="btn btn-primary" style={{ padding: '12px 24px', fontSize: '0.95rem' }}>
                        + Add New Resource
                    </button>
                )}
            </div>

            {loading ? (
                <p>Loading basic info...</p>
            ) : (
                <ResourceTable 
                    resources={filteredResources} 
                    basePath={basePath}
                    canManage={canManage}
                    showBook={showBook}
                    onDeleteClick={confirmDelete} 
                    onOpenModal={openModal}
                />
            )}

            {isDeleteModalOpen && (
                <DeleteConfirmModal 
                    resourceName={resourceToDelete?.name}
                    onConfirm={handleDelete}
                    onCancel={() => setIsDeleteModalOpen(false)}
                />
            )}

            <ResourceModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                mode={modalMode}
                resourceId={modalResourceId}
                onSaved={handleModalSaved}
                isAdmin={canManage}
            />
        </div>
    );
};

export default ResourceListPage;
