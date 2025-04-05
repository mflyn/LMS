# 配置文件

## 目录说明
本目录包含系统的配置文件，用于管理不同环境下的系统配置。

## 目录结构
```
config/
├── index.js           # 配置入口文件
├── database.js        # 数据库配置
├── server.js          # 服务器配置
├── security.js        # 安全配置
├── logger.js          # 日志配置
├── upload.js          # 文件上传配置
├── constants.js       # 常量配置
├── validation.js      # 配置验证
├── encryption.js      # 配置加密
├── templates/         # 配置模板
│   ├── development.js
│   ├── testing.js
│   └── production.js
└── docs/             # 配置文档
    ├── api.md        # API文档
    └── examples/     # 配置示例
```

## 配置文件说明

### 配置入口文件 (index.js)
```javascript
const config = {
  // 加载环境变量
  env: process.env.NODE_ENV || 'development',
  
  // 加载配置文件
  loadConfig() {
    const envConfig = require(`./templates/${this.env}`);
    return this.validateConfig(envConfig);
  },
  
  // 配置验证
  validateConfig(config) {
    const schema = Joi.object({
      database: Joi.object().required(),
      server: Joi.object().required(),
      security: Joi.object().required()
    });
    
    return schema.validate(config);
  },
  
  // 配置热更新
  async reloadConfig() {
    const newConfig = this.loadConfig();
    await this.validateConfig(newConfig);
    Object.assign(this, newConfig);
  }
};

module.exports = config;
```

### 数据库配置 (database.js)
```javascript
module.exports = {
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/education',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      poolSize: 10,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000
    },
    indexes: [
      {
        collection: 'users',
        index: { email: 1 },
        options: { unique: true }
      }
    ]
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    db: process.env.REDIS_DB || 0
  }
};
```

### 服务器配置 (server.js)
```javascript
module.exports = {
  port: process.env.PORT || 3000,
  host: process.env.HOST || '0.0.0.0',
  timeout: 30000,
  maxRequestBodySize: '10mb',
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 100
  }
};
```

### 安全配置 (security.js)
```javascript
module.exports = {
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: '24h',
    algorithm: 'HS256'
  },
  
  password: {
    minLength: 8,
    requireNumbers: true,
    requireUppercase: true,
    requireSpecialChars: true
  },
  
  session: {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000
    }
  },
  
  headers: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  }
};
```

### 日志配置 (logger.js)
```javascript
module.exports = {
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5
    })
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: 'logs/exceptions.log',
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
};
```

### 文件上传配置 (upload.js)
```javascript
module.exports = {
  dest: process.env.UPLOAD_DIR || 'uploads',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix);
  }
};
```

### 常量配置 (constants.js)
```javascript
module.exports = {
  // 系统常量
  SYSTEM: {
    NAME: '小学生学习追踪系统',
    VERSION: '1.0.0',
    ENV: process.env.NODE_ENV || 'development'
  },
  
  // 状态码
  STATUS: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    PENDING: 'pending',
    DELETED: 'deleted'
  },
  
  // 错误消息
  ERROR: {
    VALIDATION: '数据验证失败',
    NOT_FOUND: '资源不存在',
    UNAUTHORIZED: '未授权访问',
    FORBIDDEN: '禁止访问'
  },
  
  // 业务规则
  RULES: {
    MAX_CLASS_SIZE: 50,
    MIN_PASSWORD_LENGTH: 8,
    MAX_FILE_SIZE: 10 * 1024 * 1024,
    SESSION_TIMEOUT: 24 * 60 * 60 * 1000
  }
};
```

## 配置验证

### 验证机制
```javascript
const Joi = require('joi');

const configSchema = Joi.object({
  database: Joi.object({
    mongodb: Joi.object({
      uri: Joi.string().required(),
      options: Joi.object().required()
    }).required(),
    redis: Joi.object({
      host: Joi.string().required(),
      port: Joi.number().required()
    }).required()
  }).required(),
  
  server: Joi.object({
    port: Joi.number().required(),
    host: Joi.string().required()
  }).required()
});

const validateConfig = (config) => {
  const { error } = configSchema.validate(config);
  if (error) {
    throw new Error(`配置验证失败: ${error.message}`);
  }
  return config;
};
```

## 配置加密

### 加密机制
```javascript
const crypto = require('crypto');

const encryptConfig = (config) => {
  const cipher = crypto.createCipher('aes-256-cbc', process.env.ENCRYPTION_KEY);
  let encrypted = cipher.update(JSON.stringify(config), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
};

const decryptConfig = (encrypted) => {
  const decipher = crypto.createDecipher('aes-256-cbc', process.env.ENCRYPTION_KEY);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
};
```

## 配置热更新

### 热更新机制
```javascript
const fs = require('fs');
const chokidar = require('chokidar');

const watchConfig = () => {
  const watcher = chokidar.watch('config/**/*.js');
  
  watcher.on('change', async (path) => {
    console.log(`配置文件 ${path} 已更改`);
    try {
      await config.reloadConfig();
      console.log('配置已更新');
    } catch (error) {
      console.error('配置更新失败:', error);
    }
  });
};
```

## 配置监控

### 监控指标
```javascript
const metrics = {
  configChanges: new Counter(),
  validationErrors: new Counter(),
  reloadTime: new Histogram()
};

const monitorConfig = () => {
  // 记录配置变更
  metrics.configChanges.inc();
  
  // 记录验证错误
  metrics.validationErrors.inc();
  
  // 记录重载时间
  const start = Date.now();
  config.reloadConfig();
  metrics.reloadTime.observe(Date.now() - start);
};
```

## 配置备份和恢复

### 备份机制
```javascript
const backupConfig = async () => {
  const backupDir = 'config/backups';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = `${backupDir}/config-${timestamp}.json`;
  
  await fs.promises.mkdir(backupDir, { recursive: true });
  await fs.promises.writeFile(backupFile, JSON.stringify(config, null, 2));
  
  return backupFile;
};

const restoreConfig = async (backupFile) => {
  const backupData = await fs.promises.readFile(backupFile, 'utf8');
  const restoredConfig = JSON.parse(backupData);
  
  await validateConfig(restoredConfig);
  Object.assign(config, restoredConfig);
};
```

## 配置迁移

### 迁移脚本
```javascript
const migrateConfig = async (fromVersion, toVersion) => {
  const migrations = {
    '1.0.0': {
      '1.1.0': async (config) => {
        // 添加新配置项
        config.newFeature = {
          enabled: false,
          options: {}
        };
        return config;
      }
    }
  };
  
  const migration = migrations[fromVersion]?.[toVersion];
  if (!migration) {
    throw new Error(`没有找到从 ${fromVersion} 到 ${toVersion} 的迁移脚本`);
  }
  
  return await migration(config);
};
```

## 配置文档生成

### 文档生成
```javascript
const generateDocs = () => {
  const docs = {
    title: '配置文档',
    version: config.SYSTEM.VERSION,
    environment: config.SYSTEM.ENV,
    sections: [
      {
        title: '数据库配置',
        description: 'MongoDB 和 Redis 配置',
        fields: Object.keys(config.database)
      }
    ]
  };
  
  fs.writeFileSync('config/docs/api.md', JSON.stringify(docs, null, 2));
};
```

## 配置测试

### 测试用例
```javascript
describe('配置测试', () => {
  test('配置验证', () => {
    expect(() => validateConfig(config)).not.toThrow();
  });
  
  test('配置加密', () => {
    const encrypted = encryptConfig(config);
    const decrypted = decryptConfig(encrypted);
    expect(decrypted).toEqual(config);
  });
  
  test('配置热更新', async () => {
    const newConfig = { ...config, port: 3001 };
    await config.reloadConfig(newConfig);
    expect(config.port).toBe(3001);
  });
});
```

## 配置性能优化

### 优化策略
```javascript
const optimizeConfig = () => {
  // 缓存配置
  const configCache = new Map();
  
  // 懒加载配置
  const getConfig = (key) => {
    if (!configCache.has(key)) {
      configCache.set(key, config[key]);
    }
    return configCache.get(key);
  };
  
  // 定期清理缓存
  setInterval(() => {
    configCache.clear();
  }, 3600000);
};
```

## 配置安全审计

### 审计机制
```javascript
const auditConfig = () => {
  const auditLog = {
    timestamp: new Date().toISOString(),
    user: process.env.USER,
    changes: [],
    security: {
      sensitiveFields: ['password', 'secret', 'key'],
      accessLog: []
    }
  };
  
  // 记录配置变更
  const logChange = (field, oldValue, newValue) => {
    auditLog.changes.push({
      field,
      oldValue,
      newValue,
      timestamp: new Date().toISOString()
    });
  };
  
  // 检查敏感配置
  const checkSensitive = (config) => {
    auditLog.security.sensitiveFields.forEach(field => {
      if (config[field]) {
        auditLog.security.accessLog.push({
          field,
          timestamp: new Date().toISOString(),
          accessedBy: process.env.USER
        });
      }
    });
  };
};
```

## 配置变更管理

### 变更流程
1. 创建变更请求
2. 代码审查
3. 测试验证
4. 审批流程
5. 部署实施
6. 监控反馈
7. 回滚预案

## 配置回滚机制

### 回滚脚本
```javascript
const rollbackConfig = async (version) => {
  const backupFile = `config/backups/config-${version}.json`;
  if (!fs.existsSync(backupFile)) {
    throw new Error(`找不到版本 ${version} 的备份文件`);
  }
  
  await restoreConfig(backupFile);
  console.log(`已回滚到版本 ${version}`);
};
```

## 配置依赖管理

### 依赖检查
```javascript
const checkDependencies = () => {
  const dependencies = {
    mongodb: '^4.0.0',
    redis: '^4.0.0',
    joi: '^17.0.0'
  };
  
  Object.entries(dependencies).forEach(([name, version]) => {
    const installed = require(`${name}/package.json`).version;
    if (!semver.satisfies(installed, version)) {
      console.warn(`依赖 ${name} 版本不匹配: 需要 ${version}, 当前 ${installed}`);
    }
  });
};
```

## 配置模板

### 环境模板
```javascript
// development.js
module.exports = {
  database: {
    mongodb: {
      uri: 'mongodb://localhost:27017/education_dev'
    }
  },
  server: {
    port: 3000
  }
};

// production.js
module.exports = {
  database: {
    mongodb: {
      uri: process.env.MONGODB_URI
    }
  },
  server: {
    port: process.env.PORT
  }
};
```

## 配置版本控制

### 版本管理
```javascript
const versionConfig = {
  current: '1.0.0',
  history: [
    {
      version: '1.0.0',
      date: '2024-01-01',
      changes: ['初始版本']
    }
  ],
  
  getNextVersion: (type = 'patch') => {
    const [major, minor, patch] = this.current.split('.').map(Number);
    switch (type) {
      case 'major': return `${major + 1}.0.0`;
      case 'minor': return `${major}.${minor + 1}.0`;
      case 'patch': return `${major}.${minor}.${patch + 1}`;
    }
  }
};
```

## 配置环境隔离

### 环境管理
```javascript
const envConfig = {
  development: {
    database: 'education_dev',
    logLevel: 'debug'
  },
  testing: {
    database: 'education_test',
    logLevel: 'info'
  },
  production: {
    database: 'education',
    logLevel: 'warn'
  },
  
  getCurrentEnv: () => process.env.NODE_ENV || 'development',
  
  isProduction: () => this.getCurrentEnv() === 'production'
};
```

## 配置权限管理

### 权限控制
```javascript
const configPermissions = {
  admin: ['read', 'write', 'delete'],
  developer: ['read', 'write'],
  viewer: ['read'],
  
  checkPermission: (user, action) => {
    const userPermissions = this[user.role];
    return userPermissions?.includes(action);
  }
};
```

## 配置日志记录

### 日志管理
```javascript
const configLogger = {
  logChange: (change) => {
    logger.info('配置变更', {
      timestamp: new Date().toISOString(),
      user: process.env.USER,
      change
    });
  },
  
  logError: (error) => {
    logger.error('配置错误', {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    });
  }
};
```

## 配置错误处理

### 错误管理
```javascript
const configError = {
  handleError: (error) => {
    switch (error.code) {
      case 'VALIDATION_ERROR':
        return { status: 400, message: '配置验证失败' };
      case 'NOT_FOUND':
        return { status: 404, message: '配置不存在' };
      default:
        return { status: 500, message: '配置错误' };
    }
  }
};
```

## 配置性能监控

### 性能指标
```javascript
const configMetrics = {
  responseTime: new Histogram(),
  memoryUsage: new Gauge(),
  errorRate: new Counter(),
  
  collectMetrics: () => {
    this.responseTime.observe(process.hrtime()[0]);
    this.memoryUsage.set(process.memoryUsage().heapUsed);
  }
};
```

## 配置告警机制

### 告警规则
```javascript
const configAlerts = {
  rules: [
    {
      condition: 'errorRate > 0.1',
      severity: 'critical',
      message: '配置错误率过高'
    },
    {
      condition: 'responseTime > 1000',
      severity: 'warning',
      message: '配置响应时间过长'
    }
  ],
  
  checkAlerts: () => {
    this.rules.forEach(rule => {
      if (eval(rule.condition)) {
        this.sendAlert(rule);
      }
    });
  }
};
```

## 配置文档自动化

### 文档生成
```javascript
const generateConfigDocs = () => {
  const docs = {
    title: '配置文档',
    version: config.version,
    lastUpdated: new Date().toISOString(),
    sections: Object.entries(config).map(([key, value]) => ({
      title: key,
      description: value.description,
      fields: Object.keys(value)
    }))
  };
  
  fs.writeFileSync('config/docs/config.md', JSON.stringify(docs, null, 2));
};
```

## 配置最佳实践

### 实践指南
1. 使用环境变量覆盖默认配置
2. 保持配置的简洁性和可读性
3. 实现配置验证和类型检查
4. 使用配置模板管理不同环境
5. 实现配置的热更新机制
6. 定期备份重要配置
7. 实施配置变更管理流程
8. 监控配置性能和错误

## 配置故障处理

### 故障恢复
1. 配置错误
   - 检查日志定位问题
   - 回滚到稳定版本
   - 修复配置问题
   - 验证修复结果

2. 性能问题
   - 分析性能瓶颈
   - 优化配置加载
   - 实现配置缓存
   - 监控性能指标

3. 安全问题
   - 检查敏感配置
   - 更新安全策略
   - 加强访问控制
   - 审计配置变更

## 配置优化建议

### 优化策略
1. 使用配置缓存减少IO操作
2. 实现配置懒加载提高性能
3. 优化配置验证逻辑
4. 使用配置模板减少重复
5. 实现配置压缩减少内存占用
6. 优化配置热更新机制
7. 实现配置预加载
8. 使用配置池管理资源

## 配置更新日志

### 版本历史
#### v1.1.0 (2024-03-15)
- 新增配置验证机制
- 添加配置加密功能
- 实现配置热更新
- 优化配置性能
- 增强安全配置

#### v1.0.0 (2024-01-01)
- 初始版本发布
- 基础配置实现
- 环境配置支持
- 文档完善 