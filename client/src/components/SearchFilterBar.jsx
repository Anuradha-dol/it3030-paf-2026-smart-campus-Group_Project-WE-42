import React, { useEffect, useState } from 'react';

const SearchFilterBar = ({ onSearch }) => {
    const [location, setLocation] = useState('');
    const [type, setType] = useState('');
    const [minCapacity, setMinCapacity] = useState('');
    const [maxCapacity, setMaxCapacity] = useState('');
    const [status, setStatus] = useState('');

    useEffect(() => {
        // Debounce typing so results update live without excessive rerenders.
        const timer = setTimeout(() => {
            onSearch({ location, type, minCapacity, maxCapacity, status });
        }, 180);

        return () => clearTimeout(timer);
    }, [location, type, minCapacity, maxCapacity, status, onSearch]);

    const handleSearch = () => {
        onSearch({ location, type, minCapacity, maxCapacity, status });
    };

    const handleClear = () => {
        setLocation('');
        setType('');
        setMinCapacity('');
        setMaxCapacity('');
        setStatus('');
        onSearch({ location: '', type: '', minCapacity: '', maxCapacity: '', status: '' });
    };

    return (
        <div className="search-filter-bar">
            <input 
                type="text" 
                placeholder="Search by resource name or location..." 
                value={location}
                onChange={(e) => setLocation(e.target.value)}
            />
            
            <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">All Types</option>
                <option value="LECTURE_HALL">Lecture Hall</option>
                <option value="LAB">Lab</option>
                <option value="MEETING_ROOM">Meeting Room</option>
                <option value="EQUIPMENT">Equipment</option>
            </select>

            <input
                type="number"
                min="0"
                placeholder="Min Capacity"
                value={minCapacity}
                onChange={(e) => setMinCapacity(e.target.value)}
            />

            <input
                type="number"
                min="0"
                placeholder="Max Capacity"
                value={maxCapacity}
                onChange={(e) => setMaxCapacity(e.target.value)}
            />

            <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="OUT_OF_SERVICE">Out of Service</option>
                <option value="MAINTENANCE">Maintenance</option>
            </select>

            <button onClick={handleSearch} className="btn btn-search">Search</button>
            <button onClick={handleClear} className="btn btn-clear">Clear</button>
        </div>
    );
};

export default SearchFilterBar;
