const axios = require('axios');

const validateClientConfig = ({ progressServiceUrl, internalServiceToken }) => {
  if (typeof progressServiceUrl !== 'string' || !progressServiceUrl.trim()) {
    throw new Error('PROGRESS_SERVICE_URL is required');
  }
  if (typeof internalServiceToken !== 'string' || internalServiceToken.length < 32) {
    throw new Error('INTERNAL_SERVICE_TOKEN must contain at least 32 characters');
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
  validateClientConfig({ progressServiceUrl, internalServiceToken });
  const baseUrl = progressServiceUrl.replace(/\/+$/, '');

  return {
    async awardTaskStar(payload) {
      try {
        const response = await axiosInstance.post(
          `${baseUrl}/api/internal/stars/award`,
          payload,
          { headers: { 'x-service-token': internalServiceToken }, timeout }
        );
        if (!response || !response.data || response.data.success !== true || !response.data.data) {
          throw new Error('Invalid star award response');
        }
        return response.data.data;
      } catch (error) {
        throw pendingError(error);
      }
    }
  };
};

const awardTaskStar = (payload) => createStarAwardClient({
  progressServiceUrl: process.env.PROGRESS_SERVICE_URL || 'http://progress-service:3003',
  internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN
}).awardTaskStar(payload);

module.exports = { awardTaskStar, createStarAwardClient, validateClientConfig };
