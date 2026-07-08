const axios = require('axios');

const validateClientConfig = ({ progressServiceUrl, internalServiceToken, timeout = 3000 }) => {
  if (typeof progressServiceUrl !== 'string' || !progressServiceUrl.trim()) {
    throw new Error('PROGRESS_SERVICE_URL is required');
  }
  if (typeof internalServiceToken !== 'string' || internalServiceToken.length < 32) {
    throw new Error('INTERNAL_SERVICE_TOKEN must contain at least 32 characters');
  }
  if (!Number.isInteger(timeout) || timeout < 1) {
    throw new Error('STAR_AWARD_TIMEOUT_MS must be a positive integer');
  }
};

const pendingError = (cause) => {
  const error = new Error('Star award is pending');
  error.code = 'STAR_AWARD_PENDING';
  error.status = 503;
  error.cause = cause;
  return error;
};

const createStarAwardClient = ({
  axiosInstance = axios,
  progressServiceUrl,
  internalServiceToken,
  timeout = 3000
}) => {
  validateClientConfig({ progressServiceUrl, internalServiceToken, timeout });
  const baseUrl = progressServiceUrl.replace(/\/+$/, '');

  return {
    async awardTaskStar(payload) {
      try {
        const response = await axiosInstance.post(
          `${baseUrl}/api/internal/stars/award`,
          payload,
          { headers: { 'x-service-token': internalServiceToken }, timeout }
        );
        const data = response && response.data && response.data.data;
        if (!response || response.data.success !== true || !data
          || typeof data.awarded !== 'boolean'
          || typeof data.ledgerEntryId !== 'string' || !data.ledgerEntryId
          || !Number.isInteger(data.starBalance) || data.starBalance < 0) {
          throw new Error('Invalid star award response');
        }
        return data;
      } catch (error) {
        throw pendingError(error);
      }
    }
  };
};

const awardTaskStar = (payload) => createStarAwardClient({
  progressServiceUrl: process.env.PROGRESS_SERVICE_URL || 'http://progress-service:3002',
  internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN,
  timeout: Number(process.env.STAR_AWARD_TIMEOUT_MS || 3000)
}).awardTaskStar(payload);

module.exports = { awardTaskStar, createStarAwardClient, validateClientConfig };
