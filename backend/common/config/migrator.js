/**
 * 配置迁移工具
 * 帮助从旧的配置格式迁移到新的统一配置管理系统
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const access = promisify(fs.access);

class ConfigMigrator {
  constructor(projectRoot) {
    this.projectRoot = projectRoot || process.cwd();
    this.backupDir = path.join(this.projectRoot, 'config-backup');
  }
  
  /**
   * 扫描项目中的配置文件
   */
  async scanConfigFiles() {
    const configFiles = [];
    const searchPaths = [
      'backend',
      'backend/gateway',
      'backend/services/user-service',
      'backend/services/data-service',
      'backend/services/analytics-service',
      'backend/services/homework-service',
      'backend/services/progress-service',
      'backend/services/interaction-service',
      'backend/services/notification-service',
      'backend/services/resource-service'
    ];
    
    for (const searchPath of searchPaths) {
      const fullPath = path.join(this.projectRoot, searchPath);
      
      try {
        await access(fullPath);
        
        // 查找 .env 文件
        const envPath = path.join(fullPath, '.env');
        try {
          await access(envPath);
          configFiles.push({
            type: 'env',
            path: envPath,
            relativePath: path.relative(this.projectRoot, envPath),
            service: this.extractServiceName(searchPath)
          });
        } catch (e) {
          // .env 文件不存在
        }
        
        // 查找 config.js 文件
        const configPath = path.join(fullPath, 'config.js');
        try {
          await access(configPath);
          configFiles.push({
            type: 'js',
            path: configPath,
            relativePath: path.relative(this.projectRoot, configPath),
            service: this.extractServiceName(searchPath)
          });
        } catch (e) {
          // config.js 文件不存在
        }
        
      } catch (e) {
        // 路径不存在
      }
    }
    
    return configFiles;
  }
  
  /**
   * 从路径中提取服务名称
   */
  extractServiceName(searchPath) {
    if (searchPath.includes('gateway')) return 'gateway';
    if (searchPath.includes('user-service')) return 'user';
    if (searchPath.includes('data-service')) return 'data';
    if (searchPath.includes('analytics-service')) return 'analytics';
    if (searchPath.includes('homework-service')) return 'homework';
    if (searchPath.includes('progress-service')) return 'progress';
    if (searchPath.includes('interaction-service')) return 'interaction';
    if (searchPath.includes('notification-service')) return 'notification';
    if (searchPath.includes('resource-service')) return 'resource';
    return 'common';
  }
  
  /**
   * 解析 .env 文件
   */
  async parseEnvFile(filePath) {
    const content = await readFile(filePath, 'utf8');
    const config = {};
    
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          config[key.trim()] = value;
        }
      }
    }
    
    return config;
  }
  
  /**
   * 解析 config.js 文件
   */
  async parseConfigFile(filePath) {
    try {
      // 读取文件内容
      const content = await readFile(filePath, 'utf8');
      
      // 简单的配置提取（这里可以根据实际情况改进）
      const config = {};
      
      // 提取环境变量引用
      const envMatches = content.match(/process\.env\.([A-Z_]+)/g);
      if (envMatches) {
        for (const match of envMatches) {
          const envVar = match.replace('process.env.', '');
          config[envVar] = process.env[envVar] || '';
        }
      }
      
      return config;
    } catch (error) {
      console.warn(`解析配置文件失败: ${filePath}`, error.message);
      return {};
    }
  }
  
  /**
   * 创建备份
   */
  async createBackup(configFiles) {
    // 创建备份目录
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `config-backup-${timestamp}`);
    fs.mkdirSync(backupPath, { recursive: true });
    
    for (const configFile of configFiles) {
      const content = await readFile(configFile.path, 'utf8');
      const backupFilePath = path.join(backupPath, configFile.relativePath);
      
      // 创建目录结构
      const backupDir = path.dirname(backupFilePath);
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      await writeFile(backupFilePath, content);
    }
    
    console.log(`✅ 配置文件已备份到: ${backupPath}`);
    return backupPath;
  }
  
  /**
   * 合并配置
   */
  mergeConfigs(configs) {
    const merged = {};
    
    // 按优先级合并配置
    const priorities = ['common', 'gateway', 'user', 'data', 'analytics', 'homework', 'progress', 'interaction', 'notification', 'resource'];
    
    for (const priority of priorities) {
      const config = configs[priority];
      if (config) {
        Object.assign(merged, config);
      }
    }
    
    return merged;
  }
  
  /**
   * 生成新的 .env 文件
   */
  generateNewEnvFile(mergedConfig) {
    const lines = [];
    
    lines.push('# 统一配置管理 - 自动生成');
    lines.push(`# 生成时间: ${new Date().toISOString()}`);
    lines.push('');
    
    // 基础配置
    lines.push('# 基础配置');
    lines.push(`NODE_ENV=${mergedConfig.NODE_ENV || 'development'}`);
    lines.push(`LOG_LEVEL=${mergedConfig.LOG_LEVEL || 'info'}`);
    lines.push('');
    
    // JWT配置
    lines.push('# JWT配置');
    lines.push(`JWT_SECRET=${mergedConfig.JWT_SECRET || 'your-super-secret-jwt-key-here-change-in-production'}`);
    lines.push(`JWT_EXPIRATION=${mergedConfig.JWT_EXPIRATION || '24h'}`);
    lines.push(`JWT_REFRESH_EXPIRATION=${mergedConfig.JWT_REFRESH_EXPIRATION || '7d'}`);
    lines.push('');
    
    // 数据库配置
    lines.push('# 数据库配置');
    lines.push(`MONGO_URI=${mergedConfig.MONGO_URI || 'mongodb://localhost:27017/student_tracking'}`);
    if (mergedConfig.USER_SERVICE_MONGO_URI) {
      lines.push(`USER_SERVICE_MONGO_URI=${mergedConfig.USER_SERVICE_MONGO_URI}`);
    }
    if (mergedConfig.DATA_SERVICE_MONGO_URI) {
      lines.push(`DATA_SERVICE_MONGO_URI=${mergedConfig.DATA_SERVICE_MONGO_URI}`);
    }
    lines.push('');
    
    // 服务端口配置
    lines.push('# 服务端口配置');
    lines.push(`GATEWAY_PORT=${mergedConfig.GATEWAY_PORT || '3000'}`);
    lines.push(`USER_SERVICE_PORT=${mergedConfig.USER_SERVICE_PORT || '3001'}`);
    lines.push(`DATA_SERVICE_PORT=${mergedConfig.DATA_SERVICE_PORT || '3002'}`);
    lines.push(`ANALYTICS_SERVICE_PORT=${mergedConfig.ANALYTICS_SERVICE_PORT || '3003'}`);
    lines.push(`HOMEWORK_SERVICE_PORT=${mergedConfig.HOMEWORK_SERVICE_PORT || '3004'}`);
    lines.push(`PROGRESS_SERVICE_PORT=${mergedConfig.PROGRESS_SERVICE_PORT || '3005'}`);
    lines.push(`INTERACTION_SERVICE_PORT=${mergedConfig.INTERACTION_SERVICE_PORT || '3006'}`);
    lines.push(`NOTIFICATION_SERVICE_PORT=${mergedConfig.NOTIFICATION_SERVICE_PORT || '3007'}`);
    lines.push(`RESOURCE_SERVICE_PORT=${mergedConfig.RESOURCE_SERVICE_PORT || '3008'}`);
    lines.push('');
    
    // 服务URL配置
    lines.push('# 服务URL配置');
    const baseHost = mergedConfig.SERVICE_HOST || 'localhost';
    lines.push(`SERVICE_HOST=${baseHost}`);
    lines.push(`USER_SERVICE_URL=${mergedConfig.USER_SERVICE_URL || `http://${baseHost}:3001`}`);
    lines.push(`DATA_SERVICE_URL=${mergedConfig.DATA_SERVICE_URL || `http://${baseHost}:3002`}`);
    lines.push(`ANALYTICS_SERVICE_URL=${mergedConfig.ANALYTICS_SERVICE_URL || `http://${baseHost}:3003`}`);
    lines.push(`HOMEWORK_SERVICE_URL=${mergedConfig.HOMEWORK_SERVICE_URL || `http://${baseHost}:3004`}`);
    lines.push(`PROGRESS_SERVICE_URL=${mergedConfig.PROGRESS_SERVICE_URL || `http://${baseHost}:3005`}`);
    lines.push(`INTERACTION_SERVICE_URL=${mergedConfig.INTERACTION_SERVICE_URL || `http://${baseHost}:3006`}`);
    lines.push(`NOTIFICATION_SERVICE_URL=${mergedConfig.NOTIFICATION_SERVICE_URL || `http://${baseHost}:3007`}`);
    lines.push(`RESOURCE_SERVICE_URL=${mergedConfig.RESOURCE_SERVICE_URL || `http://${baseHost}:3008`}`);
    lines.push('');
    
    // Redis配置
    lines.push('# Redis配置');
    lines.push(`REDIS_HOST=${mergedConfig.REDIS_HOST || 'localhost'}`);
    lines.push(`REDIS_PORT=${mergedConfig.REDIS_PORT || '6379'}`);
    if (mergedConfig.REDIS_PASSWORD) {
      lines.push(`REDIS_PASSWORD=${mergedConfig.REDIS_PASSWORD}`);
    }
    lines.push('');
    
    // CORS配置
    lines.push('# CORS配置');
    lines.push(`CORS_ORIGIN=${mergedConfig.CORS_ORIGIN || '*'}`);
    lines.push('');
    
    // 限流配置
    lines.push('# 限流配置');
    lines.push(`RATE_LIMIT_WINDOW_MS=${mergedConfig.RATE_LIMIT_WINDOW_MS || '900000'}`);
    lines.push(`RATE_LIMIT_MAX_REQUESTS=${mergedConfig.RATE_LIMIT_MAX_REQUESTS || '100'}`);
    lines.push('');
    
    // 监控配置
    lines.push('# 监控配置');
    lines.push(`ENABLE_METRICS=${mergedConfig.ENABLE_METRICS || 'false'}`);
    lines.push(`METRICS_PORT=${mergedConfig.METRICS_PORT || '9090'}`);
    lines.push('');
    
    // 其他配置
    const otherKeys = Object.keys(mergedConfig).filter(key => 
      ![
        'NODE_ENV', 'LOG_LEVEL', 'JWT_SECRET', 'JWT_EXPIRATION', 'JWT_REFRESH_EXPIRATION',
        'MONGO_URI', 'USER_SERVICE_MONGO_URI', 'DATA_SERVICE_MONGO_URI',
        'GATEWAY_PORT', 'USER_SERVICE_PORT', 'DATA_SERVICE_PORT', 'ANALYTICS_SERVICE_PORT',
        'HOMEWORK_SERVICE_PORT', 'PROGRESS_SERVICE_PORT', 'INTERACTION_SERVICE_PORT',
        'NOTIFICATION_SERVICE_PORT', 'RESOURCE_SERVICE_PORT',
        'SERVICE_HOST', 'USER_SERVICE_URL', 'DATA_SERVICE_URL', 'ANALYTICS_SERVICE_URL',
        'HOMEWORK_SERVICE_URL', 'PROGRESS_SERVICE_URL', 'INTERACTION_SERVICE_URL',
        'NOTIFICATION_SERVICE_URL', 'RESOURCE_SERVICE_URL',
        'REDIS_HOST', 'REDIS_PORT', 'REDIS_PASSWORD',
        'CORS_ORIGIN', 'RATE_LIMIT_WINDOW_MS', 'RATE_LIMIT_MAX_REQUESTS',
        'ENABLE_METRICS', 'METRICS_PORT'
      ].includes(key)
    );
    
    if (otherKeys.length > 0) {
      lines.push('# 其他配置');
      for (const key of otherKeys) {
        lines.push(`${key}=${mergedConfig[key]}`);
      }
    }
    
    return lines.join('\n');
  }
  
  /**
   * 执行迁移
   */
  async migrate() {
    console.log('🚀 开始配置迁移...');
    
    try {
      // 1. 扫描配置文件
      console.log('📁 扫描配置文件...');
      const configFiles = await this.scanConfigFiles();
      console.log(`找到 ${configFiles.length} 个配置文件`);
      
      if (configFiles.length === 0) {
        console.log('没有找到需要迁移的配置文件');
        return;
      }
      
      // 2. 创建备份
      console.log('💾 创建配置备份...');
      await this.createBackup(configFiles);
      
      // 3. 解析配置文件
      console.log('🔍 解析配置文件...');
      const configs = {};
      
      for (const configFile of configFiles) {
        console.log(`解析: ${configFile.relativePath}`);
        
        let config = {};
        if (configFile.type === 'env') {
          config = await this.parseEnvFile(configFile.path);
        } else if (configFile.type === 'js') {
          config = await this.parseConfigFile(configFile.path);
        }
        
        configs[configFile.service] = config;
      }
      
      // 4. 合并配置
      console.log('🔄 合并配置...');
      const mergedConfig = this.mergeConfigs(configs);
      
      // 5. 生成新的配置文件
      console.log('📝 生成统一配置文件...');
      const newEnvContent = this.generateNewEnvFile(mergedConfig);
      
      const newEnvPath = path.join(this.projectRoot, 'backend', '.env');
      await writeFile(newEnvPath, newEnvContent);
      
      console.log(`✅ 新的配置文件已生成: ${newEnvPath}`);
      
      // 6. 生成迁移报告
      const report = {
        timestamp: new Date().toISOString(),
        migratedFiles: configFiles.map(f => f.relativePath),
        mergedConfig: Object.keys(mergedConfig),
        newConfigPath: path.relative(this.projectRoot, newEnvPath)
      };
      
      const reportPath = path.join(this.backupDir, 'migration-report.json');
      await writeFile(reportPath, JSON.stringify(report, null, 2));
      
      console.log('🎉 配置迁移完成！');
      console.log('\n📋 迁移摘要:');
      console.log(`- 迁移文件数: ${configFiles.length}`);
      console.log(`- 配置项数: ${Object.keys(mergedConfig).length}`);
      console.log(`- 新配置文件: ${newEnvPath}`);
      console.log(`- 迁移报告: ${reportPath}`);
      
      return report;
      
    } catch (error) {
      console.error('❌ 配置迁移失败:', error.message);
      throw error;
    }
  }
  
  /**
   * 验证迁移结果
   */
  async validateMigration() {
    console.log('🔍 验证迁移结果...');
    
    const newEnvPath = path.join(this.projectRoot, 'backend', '.env');
    
    try {
      await access(newEnvPath);
      const content = await readFile(newEnvPath, 'utf8');
      
      // 检查必需的配置项
      const requiredKeys = [
        'NODE_ENV', 'JWT_SECRET', 'MONGO_URI',
        'GATEWAY_PORT', 'USER_SERVICE_PORT', 'DATA_SERVICE_PORT'
      ];
      
      const missingKeys = [];
      for (const key of requiredKeys) {
        if (!content.includes(`${key}=`)) {
          missingKeys.push(key);
        }
      }
      
      if (missingKeys.length > 0) {
        console.warn(`⚠️  缺少必需的配置项: ${missingKeys.join(', ')}`);
        return false;
      }
      
      console.log('✅ 迁移验证通过');
      return true;
      
    } catch (error) {
      console.error('❌ 迁移验证失败:', error.message);
      return false;
    }
  }
}

module.exports = ConfigMigrator;