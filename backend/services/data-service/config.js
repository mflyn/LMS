module.exports = {
  mongoURI: 'mongodb://localhost:27017/student-tracking-system',
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-here' // 优先使用环境变量，提供默认值作为后备
};