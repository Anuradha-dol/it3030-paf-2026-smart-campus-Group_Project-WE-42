import React from 'react';

const DeleteConfirmModal = ({ resourceName, onConfirm, onCancel }) => {
    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>Confirm Deletion</h2>
                <p>Are you sure you want to delete the resource: <strong>{resourceName}</strong>?</p>
                <div className="modal-actions">
                    <button onClick={onCancel} className="btn btn-clear">Cancel</button>
                    <button onClick={onConfirm} className="btn btn-delete">Yes, Delete</button>
                </div>
            </div>
        </div>
    );
};

export default DeleteConfirmModal;