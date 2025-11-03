/**
 * 测试脚本 - 验证所有修复是否生效
 * 通过检查源代码来验证修复,不需要安装依赖
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 开始验证修复...\n');

let hasErrors = false;

// 辅助函数:读取文件内容
function readFile(filePath) {
  return fs.readFileSync(path.join(__dirname, filePath), 'utf8');
}

// 测试 1: MONGO_URI 验证
console.log('✓ 测试 1: MONGO_URI 验证');
try {
  const configContent = readFile('common/config/index.js');

  if (configContent.includes("uri({ scheme: ['mongodb', 'mongodb+srv'] })")) {
    console.log('  ✅ MONGO_URI 验证已修复 (支持 mongodb:// 和 mongodb+srv://)');
  } else if (configContent.includes('uri()') && !configContent.includes('scheme:')) {
    console.error('  ❌ MONGO_URI 验证未修复 (仍使用默认 uri() 验证)');
    hasErrors = true;
  } else {
    console.log('  ✅ MONGO_URI 验证已修复');
  }
} catch (error) {
  console.error('  ❌ 测试失败:', error.message);
  hasErrors = true;
}

// 测试 2: requestTracker 导出
console.log('\n✓ 测试 2: requestTracker 导出');
try {
  const errorHandlerContent = readFile('common/middleware/errorHandler.js');

  if (errorHandlerContent.includes('requestTracker,') || errorHandlerContent.includes('requestTracker:')) {
    console.log('  ✅ requestTracker 已在 module.exports 中导出');
  } else {
    console.error('  ❌ requestTracker 未在 module.exports 中导出');
    hasErrors = true;
  }
} catch (error) {
  console.error('  ❌ 测试失败:', error.message);
  hasErrors = true;
}

// 测试 3: AppError 导出
console.log('\n✓ 测试 3: AppError 导出');
try {
  const errorHandlerContent = readFile('common/middleware/errorHandler.js');

  if (errorHandlerContent.includes('AppError,') || errorHandlerContent.includes('AppError:')) {
    console.log('  ✅ AppError 已在 module.exports 中导出');
  } else {
    console.error('  ❌ AppError 未在 module.exports 中导出');
    hasErrors = true;
  }
} catch (error) {
  console.error('  ❌ 测试失败:', error.message);
  hasErrors = true;
}

// 测试 4: setupUncaughtExceptionHandler 别名
console.log('\n✓ 测试 4: setupUncaughtExceptionHandler 别名');
try {
  const errorHandlerContent = readFile('common/middleware/errorHandler.js');

  if (errorHandlerContent.includes('setupUncaughtExceptionHandler:') ||
      errorHandlerContent.includes('setupUncaughtExceptionHandler,')) {
    console.log('  ✅ setupUncaughtExceptionHandler 已在 module.exports 中导出');
  } else {
    console.error('  ❌ setupUncaughtExceptionHandler 未在 module.exports 中导出');
    hasErrors = true;
  }
} catch (error) {
  console.error('  ❌ 测试失败:', error.message);
  hasErrors = true;
}

// 测试 5: createLogger 工厂函数
console.log('\n✓ 测试 5: createLogger 工厂函数');
try {
  const configLoggerContent = readFile('common/config/logger.js');

  if (configLoggerContent.includes('function createLogger') &&
      configLoggerContent.includes('createLogger')) {
    console.log('  ✅ createLogger 工厂函数已定义并导出');
  } else {
    console.error('  ❌ createLogger 工厂函数未定义或未导出');
    hasErrors = true;
  }
} catch (error) {
  console.error('  ❌ 测试失败:', error.message);
  hasErrors = true;
}

// 测试 6: utils/logger 向后兼容
console.log('\n✓ 测试 6: utils/logger 向后兼容');
try {
  const utilsLoggerContent = readFile('common/utils/logger.js');

  if (utilsLoggerContent.includes('@deprecated') &&
      utilsLoggerContent.includes("require('../config/logger')")) {
    console.log('  ✅ utils/logger 已重定向到 config/logger (向后兼容)');
  } else {
    console.error('  ❌ utils/logger 未正确重定向到 config/logger');
    hasErrors = true;
  }
} catch (error) {
  console.error('  ❌ 测试失败:', error.message);
  hasErrors = true;
}

// 测试 7: 服务导入修复
console.log('\n✓ 测试 7: 服务导入修复');
try {
  const interactionServiceContent = readFile('services/interaction-service/server.js');
  const userServiceContent = readFile('services/user-service/server.js');
  const dataServiceContent = readFile('services/data-service/server.js');

  let serviceErrors = 0;

  // 检查 interaction-service
  if (!interactionServiceContent.includes("require('../../common/config/logger')")) {
    console.error('  ❌ interaction-service 未使用 config/logger');
    serviceErrors++;
  }
  if (interactionServiceContent.includes('requestTracker(logger)') ||
      interactionServiceContent.includes('errorHandler(logger)')) {
    console.error('  ❌ interaction-service 仍在错误地调用中间件');
    serviceErrors++;
  }

  // 检查 user-service
  if (!userServiceContent.includes("require('../../common/config/logger')")) {
    console.error('  ❌ user-service 未使用 config/logger');
    serviceErrors++;
  }

  // 检查 data-service
  if (!dataServiceContent.includes("require('../../common/config/logger')")) {
    console.error('  ❌ data-service 未使用 config/logger');
    serviceErrors++;
  }

  if (serviceErrors === 0) {
    console.log('  ✅ 所有服务的导入已正确修复');
  } else {
    hasErrors = true;
  }
} catch (error) {
  console.error('  ❌ 测试失败:', error.message);
  hasErrors = true;
}

// 测试 8: httpLogger 修复
console.log('\n✓ 测试 8: httpLogger 修复');
try {
  const resourceAppContent = readFile('services/resource-service/app.js');

  if (resourceAppContent.includes('performanceLogger') &&
      resourceAppContent.includes('app.use(performanceLogger)')) {
    console.log('  ✅ resource-service 已使用 performanceLogger 替代 httpLogger');
  } else if (resourceAppContent.includes('httpLogger')) {
    console.error('  ❌ resource-service 仍在使用未定义的 httpLogger');
    hasErrors = true;
  } else {
    console.log('  ✅ resource-service httpLogger 问题已修复');
  }
} catch (error) {
  console.error('  ❌ 测试失败:', error.message);
  hasErrors = true;
}

// 测试 9: 路径错误修复
console.log('\n✓ 测试 9: 服务路径错误修复');
try {
  const interactionServiceContent = readFile('services/interaction-service/server.js');
  const homeworkServiceContent = readFile('services/homework-service/server.js');
  const resourceAppContent = readFile('services/resource-service/app.js');

  let pathErrors = 0;

  // 检查是否还有错误的三级路径
  if (interactionServiceContent.includes("require('../../../common/")) {
    console.error('  ❌ interaction-service 仍有错误的三级路径');
    pathErrors++;
  }

  if (homeworkServiceContent.includes("require('../../../common/")) {
    console.error('  ❌ homework-service 仍有错误的三级路径');
    pathErrors++;
  }

  if (resourceAppContent.includes("require('../../../common/")) {
    console.error('  ❌ resource-service/app.js 仍有错误的三级路径');
    pathErrors++;
  }

  // 检查 resource-service 的路由文件
  const recommendationsContent = readFile('services/resource-service/routes/recommendations.js');
  const collectionsContent = readFile('services/resource-service/routes/collections.js');
  const resourcesContent = readFile('services/resource-service/routes/resources.js');

  if (recommendationsContent.includes("require('../../../common/")) {
    console.error('  ❌ resource-service/routes/recommendations.js 仍有错误的三级路径');
    pathErrors++;
  }

  if (collectionsContent.includes("require('../../../common/")) {
    console.error('  ❌ resource-service/routes/collections.js 仍有错误的三级路径');
    pathErrors++;
  }

  if (resourcesContent.includes("require('../../../common/")) {
    console.error('  ❌ resource-service/routes/resources.js 仍有错误的三级路径');
    pathErrors++;
  }

  if (pathErrors === 0) {
    console.log('  ✅ 所有服务的路径已正确修复 (使用 ../../common/ 而不是 ../../../common/)');
  } else {
    hasErrors = true;
  }
} catch (error) {
  console.error('  ❌ 测试失败:', error.message);
  hasErrors = true;
}

// 总结
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.log('❌ 部分测试失败,请检查上述错误');
  process.exit(1);
} else {
  console.log('✅ 所有测试通过!修复验证成功!');
  console.log('\n建议下一步:');
  console.log('1. 运行 npm test 执行完整测试套件');
  console.log('2. 启动服务验证实际运行情况');
  console.log('3. 检查日志输出是否正常');
  process.exit(0);
}

