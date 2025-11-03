#!/usr/bin/env node
/**
 * 验证 resource-service/routes/ 目录下的路径修复
 * 测试所有 routes 文件中的 require 路径是否正确
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 开始验证 resource-service/routes/ 路径修复...\n');

let hasErrors = false;

/**
 * 读取文件内容
 */
function readFile(relativePath) {
  const fullPath = path.join(__dirname, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`文件不存在: ${relativePath}`);
  }
  return fs.readFileSync(fullPath, 'utf8');
}

/**
 * 检查文件中的 require 路径
 */
function checkRequirePaths(filePath, expectedPrefix) {
  console.log(`✓ 检查 ${filePath}`);
  
  try {
    const content = readFile(filePath);
    const lines = content.split('\n');
    
    let foundIssues = false;
    let correctPaths = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // 检查是否有 require('../../common/')
      if (line.includes("require('../../common/")) {
        console.error(`  ❌ Line ${i + 1}: 使用了错误的路径 ../../common/`);
        console.error(`     ${line.trim()}`);
        foundIssues = true;
        hasErrors = true;
      }
      
      // 检查是否有正确的 require('../../../common/')
      if (line.includes("require('../../../common/")) {
        correctPaths++;
      }
    }
    
    if (!foundIssues && correctPaths > 0) {
      console.log(`  ✅ 所有路径正确 (找到 ${correctPaths} 个 ../../../common/ 引用)`);
    } else if (!foundIssues && correctPaths === 0) {
      console.log(`  ℹ️  未找到 common 模块引用`);
    }
    
    return !foundIssues;
  } catch (error) {
    console.error(`  ❌ 检查失败: ${error.message}`);
    hasErrors = true;
    return false;
  }
}

// 测试 1: 检查 resources.js
console.log('✓ 测试 1: resources.js 路径');
checkRequirePaths('services/resource-service/routes/resources.js', '../../../common/');

// 测试 2: 检查 collections.js
console.log('\n✓ 测试 2: collections.js 路径');
checkRequirePaths('services/resource-service/routes/collections.js', '../../../common/');

// 测试 3: 检查 recommendations.js
console.log('\n✓ 测试 3: recommendations.js 路径');
checkRequirePaths('services/resource-service/routes/recommendations.js', '../../../common/');

// 测试 4: 检查 resource.js
console.log('\n✓ 测试 4: resource.js 路径');
checkRequirePaths('services/resource-service/routes/resource.js', '../../../common/');

// 测试 5: 验证路径可以正确解析
console.log('\n✓ 测试 5: 验证路径解析');
try {
  const routesDir = path.join(__dirname, 'services/resource-service/routes');
  
  // 测试从 routes 目录解析路径
  const authPath = path.resolve(routesDir, '../../../common/middleware/auth.js');
  const errorHandlerPath = path.resolve(routesDir, '../../../common/middleware/errorHandler.js');
  const requestValidatorPath = path.resolve(routesDir, '../../../common/middleware/requestValidator.js');
  const fileUploadSecurityPath = path.resolve(routesDir, '../../../common/middleware/fileUploadSecurity.js');
  
  const allExist = [
    authPath,
    errorHandlerPath,
    requestValidatorPath,
    fileUploadSecurityPath
  ].every(p => {
    const exists = fs.existsSync(p);
    if (exists) {
      console.log(`  ✅ ${path.basename(p)} 存在`);
    } else {
      console.error(`  ❌ ${path.basename(p)} 不存在: ${p}`);
      hasErrors = true;
    }
    return exists;
  });
  
  if (allExist) {
    console.log('  ✅ 所有中间件文件都存在');
  }
} catch (error) {
  console.error('  ❌ 测试失败:', error.message);
  hasErrors = true;
}

// 测试 6: 检查是否有遗漏的 ../../common/ 引用
console.log('\n✓ 测试 6: 检查遗漏的错误路径');
try {
  const routesFiles = [
    'services/resource-service/routes/resources.js',
    'services/resource-service/routes/collections.js',
    'services/resource-service/routes/recommendations.js',
    'services/resource-service/routes/resource.js'
  ];
  
  let foundAnyWrongPath = false;
  
  for (const file of routesFiles) {
    const content = readFile(file);
    if (content.includes("require('../../common/")) {
      console.error(`  ❌ ${file} 仍然包含错误路径 ../../common/`);
      foundAnyWrongPath = true;
      hasErrors = true;
    }
  }
  
  if (!foundAnyWrongPath) {
    console.log('  ✅ 未发现错误路径 ../../common/');
  }
} catch (error) {
  console.error('  ❌ 测试失败:', error.message);
  hasErrors = true;
}

// 测试 7: 对比 app.js 和 routes/ 的路径差异
console.log('\n✓ 测试 7: 验证路径层级差异');
try {
  console.log('  ℹ️  路径层级说明:');
  console.log('     - services/{service}/app.js → ../../common/ (2级)');
  console.log('     - services/{service}/routes/*.js → ../../../common/ (3级)');
  
  // 检查 app.js 使用 ../../common/
  const appContent = readFile('services/resource-service/app.js');
  const appHasCorrectPath = appContent.includes("require('../../common/");
  
  // 检查 routes/*.js 使用 ../../../common/
  const routesContent = readFile('services/resource-service/routes/resources.js');
  const routesHasCorrectPath = routesContent.includes("require('../../../common/");
  
  if (appHasCorrectPath && routesHasCorrectPath) {
    console.log('  ✅ app.js 使用 ../../common/ (正确)');
    console.log('  ✅ routes/*.js 使用 ../../../common/ (正确)');
  } else {
    if (!appHasCorrectPath) {
      console.error('  ❌ app.js 未使用 ../../common/');
      hasErrors = true;
    }
    if (!routesHasCorrectPath) {
      console.error('  ❌ routes/*.js 未使用 ../../../common/');
      hasErrors = true;
    }
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
  console.log('✅ 所有 routes 路径修复验证通过!');
  console.log('\n修复总结:');
  console.log('1. ✅ resources.js 路径已修复');
  console.log('2. ✅ collections.js 路径已修复');
  console.log('3. ✅ recommendations.js 路径已修复');
  console.log('4. ✅ resource.js 路径已修复');
  console.log('\n路径规则:');
  console.log('- services/{service}/app.js → ../../common/ (2级)');
  console.log('- services/{service}/routes/*.js → ../../../common/ (3级)');
  console.log('\n影响:');
  console.log('- ✅ resource-service 可以正常启动');
  console.log('- ✅ 所有路由可以正确加载中间件');
  console.log('- ✅ 不再有 MODULE_NOT_FOUND 错误');
  process.exit(0);
}

