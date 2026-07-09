const axios = require('axios');

const validatePositiveInteger = (value, name) => {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
};

const validateNonNegativeInteger = (value, name) => {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
};

const validateClientConfig = ({
  progressServiceUrl,
  internalServiceToken,
  timeout = 3000,
  retryAttempts = 0,
  retryBackoffMs = 100,
  maxRetryBackoffMs = 1000
}) => {
  if (typeof progressServiceUrl !== 'string' || !progressServiceUrl.trim()) {
    throw new Error('PROGRESS_SERVICE_URL is required');
  }
  if (typeof internalServiceToken !== 'string' || internalServiceToken.length < 32) {
    throw new Error('INTERNAL_SERVICE_TOKEN must contain at least 32 characters');
  }
  validatePositiveInteger(timeout, 'STAR_AWARD_TIMEOUT_MS');
  validateNonNegativeInteger(retryAttempts, 'STAR_AWARD_RETRY_ATTEMPTS');
  validatePositiveInteger(retryBackoffMs, 'STAR_AWARD_RETRY_BACKOFF_MS');
  validatePositiveInteger(maxRetryBackoffMs, 'STAR_AWARD_MAX_RETRY_BACKOFF_MS');
};

const pendingError = (cause) => {
  const error = new Error('Star award is pending');
  error.code = 'STAR_AWARD_PENDING';
  error.status = 503;
  error.cause = cause;
  return error;
};

const sleepMs = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const isRetryableStarAwardError = (error) => {
  if (!error) return false;
  if (error.code && ['ECONNABORTED', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'].includes(error.code)) {
    return true;
  }
  if (!error.response) return true;
  return error.response.status >= 500;
};

const validateAwardResponse = (response) => {
  const data = response && response.data && response.data.data;
  if (!response || response.data.success !== true || !data
    || typeof data.awarded !== 'boolean'
    || typeof data.ledgerEntryId !== 'string' || !data.ledgerEntryId
    || !Number.isInteger(data.starBalance) || data.starBalance < 0) {
    const error = new Error('Invalid star award response');
    error.retryable = false;
    throw error;
  }
  return data;
};

const createStarAwardClient = ({
  axiosInstance = axios,
  progressServiceUrl,
  internalServiceToken,
  timeout = 3000,
  retryAttempts = 0,
  retryBackoffMs = 100,
  maxRetryBackoffMs = 1000,
  sleep = sleepMs
}) => {
  validateClientConfig({
    progressServiceUrl,
    internalServiceToken,
    timeout,
    retryAttempts,
    retryBackoffMs,
    maxRetryBackoffMs
  });
  const baseUrl = progressServiceUrl.replace(/\/+$/, '');

  return {
    async awardTaskStar(payload) {
      let lastError;
      const maxAttempts = retryAttempts + 1;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const response = await axiosInstance.post(
            `${baseUrl}/api/internal/stars/award`,
            payload,
            { headers: { 'x-service-token': internalServiceToken }, timeout }
          );
          return validateAwardResponse(response);
        } catch (error) {
          lastError = error;
          const retryable = error.retryable !== false && isRetryableStarAwardError(error);
          if (!retryable || attempt === maxAttempts) {
            throw pendingError(lastError);
          }
          const backoff = Math.min(retryBackoffMs * (2 ** (attempt - 1)), maxRetryBackoffMs);
          await sleep(backoff);
        }
      }

      throw pendingError(lastError);
    }
  };
};

const awardTaskStar = (payload) => createStarAwardClient({
  progressServiceUrl: process.env.PROGRESS_SERVICE_URL || 'http://progress-service:3002',
  internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN,
  timeout: Number(process.env.STAR_AWARD_TIMEOUT_MS || 3000),
  retryAttempts: Number(process.env.STAR_AWARD_RETRY_ATTEMPTS || 1),
  retryBackoffMs: Number(process.env.STAR_AWARD_RETRY_BACKOFF_MS || 100),
  maxRetryBackoffMs: Number(process.env.STAR_AWARD_MAX_RETRY_BACKOFF_MS || 1000)
}).awardTaskStar(payload);

module.exports = {
  awardTaskStar,
  createStarAwardClient,
  isRetryableStarAwardError,
  validateClientConfig
};
