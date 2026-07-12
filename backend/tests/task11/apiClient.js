const axios = require('axios');

const cleanTransportError = (method, path) => (
  new Error(`Task 11 HTTP request failed: ${method} ${path}`)
);

const safeCall = async (method, path, operation) => {
  try {
    return await operation();
  } catch (error) {
    throw cleanTransportError(method, path);
  }
};

const withToken = (token, options = {}) => ({
  ...options,
  headers: {
    ...options.headers,
    Authorization: `Bearer ${token}`
  }
});

const createScopedClient = (httpClient, token) => ({
  get: (path, options) => safeCall('GET', path, () => httpClient.get(path, withToken(token, options))),
  post: (path, data, options) => safeCall(
    'POST', path, () => httpClient.post(path, data, withToken(token, options))
  ),
  patch: (path, data, options) => safeCall(
    'PATCH', path, () => httpClient.patch(path, data, withToken(token, options))
  ),
  delete: (path, options) => safeCall(
    'DELETE', path, () => httpClient.delete(path, withToken(token, options))
  )
});

const createTask11ApiClient = ({ baseURL = '', httpClient } = {}) => {
  const client = httpClient || axios.create({
    baseURL,
    timeout: 10000,
    validateStatus: () => true
  });

  return {
    registerParent: (payload) => safeCall(
      'POST', '/api/auth/register', () => client.post('/api/auth/register', payload)
    ),
    loginParent: (payload) => safeCall(
      'POST', '/api/auth/login', () => client.post('/api/auth/login', payload)
    ),
    loginChild: (payload) => safeCall(
      'POST', '/api/auth/child-pin-login', () => client.post('/api/auth/child-pin-login', payload)
    ),
    asParent: (token) => createScopedClient(client, token),
    asChild: (token) => createScopedClient(client, token)
  };
};

module.exports = { createTask11ApiClient };
