// 环境配置文件
const config = {
  // API配置
  API_BASE_URL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000',
  
  // 应用配置
  APP_NAME: process.env.REACT_APP_NAME || '小学生学习追踪系统',
  APP_VERSION: process.env.REACT_APP_VERSION || '1.0.0',
  
  // 开发配置
  DEBUG: process.env.REACT_APP_DEBUG === 'true' || process.env.NODE_ENV === 'development',
  
  // WebSocket配置
  WS_URL: process.env.REACT_APP_WS_URL || 'ws://localhost:8000',
  
  // 文件上传配置
  MAX_FILE_SIZE: parseInt(process.env.REACT_APP_MAX_FILE_SIZE) || 10485760, // 10MB
  ALLOWED_FILE_TYPES: process.env.REACT_APP_ALLOWED_FILE_TYPES?.split(',') || ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'],
  
  // 分页配置
  DEFAULT_PAGE_SIZE: parseInt(process.env.REACT_APP_DEFAULT_PAGE_SIZE) || 10,
  MAX_PAGE_SIZE: parseInt(process.env.REACT_APP_MAX_PAGE_SIZE) || 100,
};

export default config; 