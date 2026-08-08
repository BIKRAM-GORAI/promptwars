/**
 * API Fetch wrapper to communicate with ResolveAI Express backend.
 * Implements cache prevention by adding headers and dynamic timestamps.
 */
class ApiClient {
  constructor() {
    this.baseUrl = window.location.origin;
  }

  async fetch(url, options = {}) {
    // Append timestamp query parameter to prevent caching on GET requests
    let finalUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
    
    const method = options.method || 'GET';
    if (method === 'GET') {
      const separator = finalUrl.includes('?') ? '&' : '?';
      finalUrl = `${finalUrl}${separator}_t=${Date.now()}`;
    }

    // Set default headers
    const headers = {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      ...options.headers
    };

    // Inject Admin or Customer auth token if stored in localStorage
    const adminToken = localStorage.getItem('adminToken');
    const customerToken = localStorage.getItem('customerToken');
    if (adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
    } else if (customerToken) {
      headers['Authorization'] = `Bearer ${customerToken}`;
    }

    // Let fetch automatically handle multipart/form-data content headers
    if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(finalUrl, {
      ...options,
      headers,
      cache: 'no-store' // Cache-control at fetch level
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || `API error: ${response.status} ${response.statusText}`;
      const err = new Error(errorMessage);
      err.status = response.status;
      err.errors = errorData.errors;
      throw err;
    }

    // Returns parsing response safely
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }
    return response.text();
  }

  async get(url, headers = {}) {
    return this.fetch(url, { method: 'GET', headers });
  }

  async post(url, body, headers = {}) {
    const isFormData = body instanceof FormData;
    return this.fetch(url, {
      method: 'POST',
      headers,
      body: isFormData ? body : JSON.stringify(body)
    });
  }

  async put(url, body, headers = {}) {
    const isFormData = body instanceof FormData;
    return this.fetch(url, {
      method: 'PUT',
      headers,
      body: isFormData ? body : JSON.stringify(body)
    });
  }

  async delete(url, headers = {}) {
    return this.fetch(url, { method: 'DELETE', headers });
  }
}

export const api = new ApiClient();
export default api;
