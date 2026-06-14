import api from '../api';

const API_URL = '/api/resources';

export const getAllResources = async () => {
    const response = await api.get(API_URL);
    return response.data;
};

export const getResourceById = async (id) => {
    const response = await api.get(`${API_URL}/${id}`);
    return response.data;
};

export const createResource = async (resourceData) => {
    const response = await api.post(API_URL, resourceData);
    return response.data;
};

export const updateResource = async (id, resourceData) => {
    const response = await api.put(`${API_URL}/${id}`, resourceData);
    return response.data;
};

export const deleteResource = async (id) => {
    const response = await api.delete(`${API_URL}/${id}`);
    return response.data;
};
