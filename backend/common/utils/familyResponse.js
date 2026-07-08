const sendFamilyError = (res, status, code, message, details = []) => res.status(status).json({
  success: false,
  error: { code, message, details }
});

const parsePagination = (query = {}) => {
  const page = Number(query.page || 1);
  const pageSize = Number(query.pageSize || 20);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    const error = new Error('page must be at least 1 and pageSize must be between 1 and 100');
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  return { page, pageSize, skip: (page - 1) * pageSize };
};

module.exports = { parsePagination, sendFamilyError };
