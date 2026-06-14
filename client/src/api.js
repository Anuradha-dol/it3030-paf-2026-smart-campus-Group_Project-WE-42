import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8081",
    // Send HttpOnly auth cookies on every request.
    withCredentials: true,
});

// Avoid parallel refresh storms.
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    // Resolve/reject requests waiting for refresh.
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        const requestUrl = originalRequest?.url || "";
        const isRefreshRequest = requestUrl.includes("/auth/refresh");

        // Do not retry refresh endpoint itself.
        if (isRefreshRequest) {
            return Promise.reject(error);
        }

        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                // Queue requests while refresh is in progress.
                return new Promise(function(resolve, reject) {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    return api(originalRequest);
                }).catch(err => {
                    return Promise.reject(err);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                // Ask backend to rotate JWT cookies.
                await api.post('/auth/refresh');

                isRefreshing = false;
                processQueue(null, 'refreshed');

                // Retry original request after refresh.
                return api(originalRequest);
            } catch (err) {
                isRefreshing = false;
                processQueue(err, null);

                // Caller handles logout/redirect decisions.
                return Promise.reject(err);
            }
        }

        return Promise.reject(error);
    }
);

export default api;
