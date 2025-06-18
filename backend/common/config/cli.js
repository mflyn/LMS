#!/usr/bin/env node

/**
 * 配置管理CLI工具
 * 提供命令行接口来管理配置
 */

const { program } = require('commander');
const path = require('path');
const fs = require('fs');
const { configManager } = require('./index');
const ConfigValidator = require('./validator');
const ConfigMigrator = require('./migrator');

// 设置CLI程序信息
program
  .name('config-manager')
  .description('学生学习追踪系统配置管理工具')
  .version('1.0.0');

// 验证配置命令
program
  .command('validate')
  .description('验证配置的完整性和正确性')
  .option('-s, --service <service>', '指定要验证的服务')
  .option('-e, --env <environment>', '指定环境', 'development')
  .option('--report', '生成配置报告')
  .action(async (options) => {
    try {
      console.log('🔍 开始配置验证...');
      
      // 设置环境
      process.env.NODE_ENV = options.env;
      
      // 执行验证
      ConfigValidator.validateAll(options.service);
      
      // 生成报告
      if (options.report) {
        const report = ConfigValidator.generateConfigReport();
        const reportPath = path.join(process.cwd(), 'config-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`📋 配置报告已生成: ${reportPath}`);
      }
      
    } catch (error) {
      console.error('❌ 配置验证失败:', error.message);
      process.exit(1);
    }
  });

// 迁移配置命令
program
  .command('migrate')
  .description('迁移现有配置到统一配置管理系统')
  .option('-p, --project-root <path>', '项目根目录', process.cwd())
  .option('--dry-run', '预览迁移结果，不实际执行')
  .action(async (options) => {
    try {
      const migrator = new ConfigMigrator(options.projectRoot);
      
      if (options.dryRun) {
        console.log('🔍 预览迁移结果...');
        const configFiles = await migrator.scanConfigFiles();
        console.log('\n📁 发现的配置文件:');
        configFiles.forEach(file => {
          console.log(`  - ${file.relativePath} (${file.type}, ${file.service})`);
        });
        console.log('\n💡 使用 --no-dry-run 执行实际迁移');
      } else {
        await migrator.migrate();
        await migrator.validateMigration();
      }
      
    } catch (error) {
      console.error('❌ 配置迁移失败:', error.message);
      process.exit(1);
    }
  });

// 查看配置命令
program
  .command('show')
  .description('显示当前配置')
  .option('-k, --key <key>', '显示特定配置项')
  .option('-s, --service <service>', '显示服务特定配置')
  .option('--env', '只显示环境变量')
  .option('--secrets', '显示敏感信息（谨慎使用）')
  .action((options) => {
    try {
      let config;
      
      if (options.service) {
        config = configManager.getServiceConfig(options.service);
        console.log(`📋 服务 ${options.service} 的配置:`);
      } else if (options.key) {
        const value = configManager.get(options.key);
        console.log(`📋 配置项 ${options.key}:`);
        config = { [options.key]: value };
      } else {
        config = configManager.getAll();
        console.log('📋 所有配置:');
      }
      
      // 过滤敏感信息
      if (!options.secrets) {
        const sensitiveKeys = ['JWT_SECRET', 'REDIS_PASSWORD', 'MONGO_URI'];
        const filtered = {};
        
        for (const [key, value] of Object.entries(config)) {
          if (sensitiveKeys.some(sensitive => key.includes(sensitive))) {
            filtered[key] = '***隐藏***';
          } else {
            filtered[key] = value;
          }
        }
        config = filtered;
      }
      
      // 只显示环境变量
      if (options.env) {
        const envConfig = {};
        for (const [key, value] of Object.entries(config)) {
          if (process.env[key] !== undefined) {
            envConfig[key] = value;
          }
        }
        config = envConfig;
      }
      
      console.log(JSON.stringify(config, null, 2));
      
    } catch (error) {
      console.error('❌ 获取配置失败:', error.message);
      process.exit(1);
    }
  });

// 设置配置命令
program
  .command('set <key> <value>')
  .description('设置配置项（仅限开发环境）')
  .option('-f, --force', '强制设置（跳过验证）')
  .action((key, value, options) => {
    try {
      const env = process.env.NODE_ENV || 'development';
      
      if (env === 'production' && !options.force) {
        console.error('❌ 生产环境不允许动态设置配置，请修改 .env 文件');
        process.exit(1);
      }
      
      // 设置环境变量
      process.env[key] = value;
      
      // 重新加载配置
      configManager.reload();
      
      console.log(`✅ 配置项 ${key} 已设置为: ${value}`);
      
      // 验证新配置
      if (!options.force) {
        try {
          ConfigValidator.validateAll();
          console.log('✅ 配置验证通过');
        } catch (error) {
          console.warn('⚠️  配置验证警告:', error.message);
        }
      }
      
    } catch (error) {
      console.error('❌ 设置配置失败:', error.message);
      process.exit(1);
    }
  });

// 生成配置模板命令
program
  .command('template')
  .description('生成配置文件模板')
  .option('-e, --env <environment>', '目标环境', 'development')
  .option('-s, --service <service>', '特定服务')
  .option('-o, --output <file>', '输出文件路径')
  .action((options) => {
    try {
      const templates = {
        development: {
          NODE_ENV: 'development',
          LOG_LEVEL: 'debug',
          JWT_SECRET: 'your-development-jwt-secret-change-me',
          JWT_EXPIRATION: '24h',
          JWT_REFRESH_EXPIRATION: '7d',
          MONGO_URI: 'mongodb://localhost:27017/student_tracking_dev',
          GATEWAY_PORT: '3000',
          USER_SERVICE_PORT: '3001',
          DATA_SERVICE_PORT: '3002',
          REDIS_HOST: 'localhost',
          REDIS_PORT: '6379',
          CORS_ORIGIN: '*',
          RATE_LIMIT_MAX_REQUESTS: '1000',
          ENABLE_METRICS: 'false'
        },
        test: {
          NODE_ENV: 'test',
          LOG_LEVEL: 'error',
          JWT_SECRET: 'test-jwt-secret',
          JWT_EXPIRATION: '1h',
          MONGO_URI: 'mongodb://localhost:27017/student_tracking_test',
          GATEWAY_PORT: '3100',
          USER_SERVICE_PORT: '3101',
          DATA_SERVICE_PORT: '3102',
          ENABLE_METRICS: 'false'
        },
        production: {
          NODE_ENV: 'production',
          LOG_LEVEL: 'info',
          JWT_SECRET: 'CHANGE-ME-TO-STRONG-SECRET-IN-PRODUCTION',
          JWT_EXPIRATION: '24h',
          JWT_REFRESH_EXPIRATION: '7d',
          MONGO_URI: 'mongodb://your-production-mongo-uri',
          GATEWAY_PORT: '3000',
          USER_SERVICE_PORT: '3001',
          DATA_SERVICE_PORT: '3002',
          REDIS_HOST: 'your-redis-host',
          REDIS_PORT: '6379',
          REDIS_PASSWORD: 'your-redis-password',
          CORS_ORIGIN: 'https://your-domain.com',
          RATE_LIMIT_MAX_REQUESTS: '100',
          ENABLE_METRICS: 'true',
          METRICS_PORT: '9090'
        }
      };
      
      const template = templates[options.env];
      if (!template) {
        console.error(`❌ 不支持的环境: ${options.env}`);
        process.exit(1);
      }
      
      // 生成 .env 格式的内容
      const lines = [];
      lines.push(`# ${options.env.toUpperCase()} 环境配置模板`);
      lines.push(`# 生成时间: ${new Date().toISOString()}`);
      lines.push('');
      
      for (const [key, value] of Object.entries(template)) {
        lines.push(`${key}=${value}`);
      }
      
      const content = lines.join('\n');
      
      if (options.output) {
        fs.writeFileSync(options.output, content);
        console.log(`✅ 配置模板已生成: ${options.output}`);
      } else {
        console.log('📋 配置模板:');
        console.log(content);
      }
      
    } catch (error) {
      console.error('❌ 生成配置模板失败:', error.message);
      process.exit(1);
    }
  });

// 检查配置健康状态命令
program
  .command('health')
  .description('检查配置健康状态')
  .option('-s, --service <service>', '检查特定服务')
  .action((options) => {
    try {
      console.log('🏥 检查配置健康状态...');
      
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: configManager.get('NODE_ENV'),
        checks: []
      };
      
      // 基础配置检查
      const basicChecks = [
        { name: 'JWT_SECRET', required: true },
        { name: 'MONGO_URI', required: true },
        { name: 'GATEWAY_PORT', required: true },
        { name: 'LOG_LEVEL', required: false }
      ];
      
      for (const check of basicChecks) {
        const value = configManager.get(check.name);
        const status = value ? 'pass' : (check.required ? 'fail' : 'warn');
        
        health.checks.push({
          name: check.name,
          status,
          message: value ? '配置正常' : '配置缺失'
        });
        
        if (status === 'fail') {
          health.status = 'unhealthy';
        } else if (status === 'warn' && health.status === 'healthy') {
          health.status = 'warning';
        }
      }
      
      // 服务特定检查
      if (options.service) {
        const serviceConfig = configManager.getServiceConfig(options.service);
        const servicePort = serviceConfig[`${options.service.toUpperCase()}_SERVICE_PORT`];
        
        health.checks.push({
          name: `${options.service}_service_port`,
          status: servicePort ? 'pass' : 'fail',
          message: servicePort ? `端口 ${servicePort} 配置正常` : '服务端口未配置'
        });
      }
      
      // 输出结果
      const statusEmoji = {
        healthy: '✅',
        warning: '⚠️',
        unhealthy: '❌'
      };
      
      console.log(`\n${statusEmoji[health.status]} 总体状态: ${health.status.toUpperCase()}`);
      console.log(`🌍 环境: ${health.environment}`);
      console.log('\n📋 检查详情:');
      
      for (const check of health.checks) {
        const emoji = check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️' : '❌';
        console.log(`  ${emoji} ${check.name}: ${check.message}`);
      }
      
      if (health.status === 'unhealthy') {
        process.exit(1);
      }
      
    } catch (error) {
      console.error('❌ 健康检查失败:', error.message);
      process.exit(1);
    }
  });

// 监控配置变化命令
program
  .command('watch')
  .description('监控配置文件变化')
  .option('-f, --file <file>', '监控的配置文件', '.env')
  .action((options) => {
    try {
      const configFile = path.resolve(options.file);
      
      if (!fs.existsSync(configFile)) {
        console.error(`❌ 配置文件不存在: ${configFile}`);
        process.exit(1);
      }
      
      console.log(`👀 开始监控配置文件: ${configFile}`);
      console.log('按 Ctrl+C 停止监控\n');
      
      fs.watchFile(configFile, (curr, prev) => {
        console.log(`🔄 配置文件已更新 (${new Date().toLocaleString()})`);
        
        try {
          // 重新加载配置
          configManager.reload();
          console.log('✅ 配置已重新加载');
          
          // 验证新配置
          ConfigValidator.validateAll();
          console.log('✅ 配置验证通过\n');
          
        } catch (error) {
          console.error('❌ 配置重新加载失败:', error.message);
        }
      });
      
      // 优雅退出
      process.on('SIGINT', () => {
        console.log('\n👋 停止监控配置文件');
        fs.unwatchFile(configFile);
        process.exit(0);
      });
      
    } catch (error) {
      console.error('❌ 启动配置监控失败:', error.message);
      process.exit(1);
    }
  });

// 解析命令行参数
program.parse();

// 如果没有提供命令，显示帮助
if (!process.argv.slice(2).length) {
  program.outputHelp();
}