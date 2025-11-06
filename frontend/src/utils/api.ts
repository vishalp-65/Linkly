import { apiUrl } from '../config/env';

/**
 * Utility for making direct API calls outside of RTK Query
 */

export interface ApiRequestOptions extends RequestInit {
    token?: string;
    headers?: HeadersInit;
}

export class ApiError extends Error {
    public status: number;
    public data: any;

    constructor(message: string, status: number, data: any) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
        Object.setPrototypeOf(this, ApiError.prototype);
    }
}

export class ApiClient {
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    private getHeaders(options: ApiRequestOptions = {}): HeadersInit {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(options.headers instanceof Headers
                ? Object.fromEntries(options.headers.entries())
                : (options.headers as Record<string, string> || {})),
        };

        // Add authorization header if token is provided
        if (options.token) {
            headers['Authorization'] = `Bearer ${options.token}`;
        } else if (typeof localStorage !== 'undefined') {
            // Try to get token from localStorage if not provided
            const token = localStorage.getItem('accessToken');
            if (token) headers['Authorization'] = `Bearer ${token}`;
        }

        return headers;
    }

    async request<T = unknown>(
        endpoint: string,
        options: ApiRequestOptions = {}
    ): Promise<T> {
        const { token, ...fetchOptions } = options;
        const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

        const config: RequestInit = {
            ...fetchOptions,
            headers: this.getHeaders(options),
        };

        try {
            const response = await fetch(url, config);

            const contentType = response.headers.get('content-type');
            let data: any;

            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }

            if (!response.ok) {
                throw new ApiError(
                    (data && (data.message || data.error)) ?? `HTTP ${response.status}`,
                    response.status,
                    data
                );
            }

            return data as T;
        } catch (error: any) {
            if (error instanceof ApiError) throw error;

            throw new ApiError(
                error?.message ?? 'Network error',
                0,
                null
            );
        }
    }

    async get<T = unknown>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
        return this.request<T>(endpoint, { ...options, method: 'GET' });
    }

    async post<T = unknown>(
        endpoint: string,
        data?: any,
        options: ApiRequestOptions = {}
    ): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'POST',
            body: data ? JSON.stringify(data) : undefined,
        });
    }

    async put<T = unknown>(
        endpoint: string,
        data?: any,
        options: ApiRequestOptions = {}
    ): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'PUT',
            body: data ? JSON.stringify(data) : undefined,
        });
    }

    async patch<T = unknown>(
        endpoint: string,
        data?: any,
        options: ApiRequestOptions = {}
    ): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'PATCH',
            body: data ? JSON.stringify(data) : undefined,
        });
    }

    async delete<T = unknown>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
        return this.request<T>(endpoint, { ...options, method: 'DELETE' });
    }
}

// Create and export a default API client instance
export const apiClient = new ApiClient(apiUrl);

// Helper type guards & utilities
export const isApiError = (error: unknown): error is ApiError =>
    error instanceof ApiError;

export const getErrorMessage = (error: unknown): string => {
    if (isApiError(error)) return error.message;
    if (typeof error === 'object' && error !== null) {
        const e = error as any;
        return e?.data?.message || e?.data?.error || e?.message || 'An unexpected error occurred';
    }
    return 'An unexpected error occurred';
};
