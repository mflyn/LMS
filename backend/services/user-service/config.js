module.exports = {
  mongoURI: process.env.USER_SERVICE_MONGO_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/learning-tracker-users',
  port: process.env.USER_SERVICE_PORT || 3001,
};