import { useAuth } from "@clerk/clerk-react";

// API base URL
const API_BASE = "/api";

export function useApiClient() {
  const { getToken } = useAuth();

  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const token = await getToken();
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
      ...(token && { Authorization: `Bearer ${token}` }),
    };

    const response = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || "Request failed");
    }

    return response.json();
  };

  return {
    get: (url: string) => fetchWithAuth(url),
    post: (url: string, data: any) =>
      fetchWithAuth(url, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    patch: (url: string, data: any) =>
      fetchWithAuth(url, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (url: string) =>
      fetchWithAuth(url, {
        method: "DELETE",
      }),
  };
}
