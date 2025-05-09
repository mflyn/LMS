/**
 * 进度服务配置文件
 */

module.exports = {
  // 数据库配置
  db: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/learning-management-system',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },
  
  // 服务器配置
  server: {
    port: process.env.PROGRESS_SERVICE_PORT || 3005
  },
  
  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET || 'your_jwt_secret_key',
    expiresIn: '1d'
  },
  
  // 消息队列配置
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost',
    queues: {
      progressUpdates: 'progress_updates',
      reportGeneration: 'report_generation'
    },
    exchanges: {
      progress: 'progress_exchange'
    }
  },
  
  // 日志配置
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: 'logs/progress-service.log'
  }
};
