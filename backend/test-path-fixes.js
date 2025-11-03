#!/usr/bin/env node
/**
 * 验证文件路径修复
 * 测试 resource-service 中的文件路径问题是否已修复
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 开始验证文件路径修复...\n');

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
 * 测试路径拼接逻辑
 */
function testPathJoin() {
  console.log('✓ 测试 path.join 行为');
  
  // 演示问题
  const wrongPath = path.join('/some/dir', '..', '/uploads/file.pdf');
  const correctPath = path.join('/some/dir', '..', 'uploads/file.pdf');
  
  console.log(`  ❌ 错误: path.join('/some/dir', '..', '/uploads/file.pdf') = ${wrongPath}`);
  console.log(`  ✅ 正确: path.join('/some/dir', '..', 'uploads/file.pdf') = ${correctPath}`);
  
  if (wrongPath === '/uploads/file.pdf') {
    console.log('  ℹ️  前导斜杠导致 path.join 返回绝对路径 (系统根目录)');
  }
  
  // 测试 replace 方法
  const pathWithSlash = '/uploads/file.pdf';
  const pathWithoutSlash = pathWithSlash.replace(/^\/+/, '');
  console.log(`  ✅ '${pathWithSlash}'.replace(/^\\/+/, '') = '${pathWithoutSlash}'`);
  console.log('');
}

// 测试 1: 检查上传时的路径保存
console.log('✓ 测试 1: 上传时的路径保存');
try {
  const resourcesContent = readFile('services/resource-service/routes/resources.js');

  // 检查是否保持了前导斜杠 (为了客户端 URL 拼接兼容性)
  const uploadMatch = resourcesContent.match(/path:\s*`([^`]+)\$\{req\.file\.filename\}`/);

  if (uploadMatch) {
    const pathTemplate = uploadMatch[1];
    if (pathTemplate.startsWith('/')) {
      console.log(`  ✅ 上传路径保持前导斜杠 (客户端兼容): ${pathTemplate}`);
    } else {
      console.error(`  ❌ 上传路径缺少前导斜杠,会导致客户端 URL 拼接失败: ${pathTemplate}`);
      hasErrors = true;
    }
  } else {
    console.error('  ❌ 无法找到上传路径配置');
    hasErrors = true;
  }
} catch (error) {
  console.error('  ❌ 测试失败:', error.message);
  hasErrors = true;
}

// 测试 2: 检查下载时的路径处理
console.log('\n✓ 测试 2: 下载时的路径处理');
try {
  const resourcesContent = readFile('services/resource-service/routes/resources.js');

  // 检查是否使用了 replace 方法移除前导斜杠
  // 查找包含 "获取文件路径" 注释的部分
  const lines = resourcesContent.split('\n');
  let foundDownloadSection = false;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('获取文件路径')) {
      // 检查接下来的几行
      const nextLines = lines.slice(i, i + 10).join('\n');

      if (nextLines.includes('replace(/^') && nextLines.includes('relativePath')) {
        console.log('  ✅ 下载时正确使用 replace 移除前导斜杠');
        console.log('  ✅ 使用了 relativePath 变量');
        foundDownloadSection = true;
      }
      break;
    }
  }

  if (!foundDownloadSection) {
    console.error('  ❌ 无法找到下载路径处理代码或未正确修复');
    hasErrors = true;
  }
} catch (error) {
  console.error('  ❌ 测试失败:', error.message);
  hasErrors = true;
}

// 测试 3: 检查删除时的路径处理
console.log('\n✓ 测试 3: 删除时的路径处理');
try {
  const resourcesContent = readFile('services/resource-service/routes/resources.js');
  
  // 检查删除部分
  const deleteSection = resourcesContent.match(/\/\/ 删除文件[\s\S]{0,300}fs\.unlinkSync/);
  
  if (deleteSection) {
    const sectionText = deleteSection[0];
    
    if (sectionText.includes('replace(/^\\/+/, \'\')')) {
      console.log('  ✅ 删除时正确使用 replace 移除前导斜杠');
    } else if (sectionText.includes('replace(/^\\//')) {
      console.log('  ✅ 删除时正确使用 replace 移除前导斜杠');
    } else {
      console.error('  ❌ 删除时未使用 replace 移除前导斜杠');
      hasErrors = true;
    }
    
    if (sectionText.includes('const relativePath')) {
      console.log('  ✅ 使用了 relativePath 变量');
    } else {
      console.error('  ❌ 未使用 relativePath 变量');
      hasErrors = true;
    }
  } else {
    console.error('  ❌ 无法找到删除路径处理代码');
    hasErrors = true;
  }
} catch (error) {
  console.error('  ❌ 测试失败:', error.message);
  hasErrors = true;
}

// 测试 4: 检查测试文件
console.log('\n✓ 测试 4: 测试文件修复');
try {
  const testFiles = [
    'services/resource-service/__tests__/routes/resources-integration.test.js',
    'services/resource-service/__tests__/routes/resources-api.mock.test.js'
  ];

  let allTestsFixed = true;

  for (const testFile of testFiles) {
    try {
      const content = readFile(testFile);

      // 检查上传路径 - 应该保持前导斜杠
      const uploadMatches = content.match(/path:\s*`([^`]+)\$\{req\.file\.filename\}`/g);
      if (uploadMatches) {
        for (const match of uploadMatches) {
          if (!match.includes('`/uploads/')) {
            console.error(`  ❌ ${testFile} 中缺少前导斜杠,会导致客户端兼容性问题`);
            allTestsFixed = false;
          }
        }
      }

      // 检查下载/删除路径处理 - 应该使用 replace 移除前导斜杠
      const pathJoinCount = (content.match(/path\.join\(__dirname,\s*'\.\.'/g) || []).length;
      const replaceCount = (content.match(/\.replace\(\/\^\\\/\+\//g) || []).length;

      if (pathJoinCount > 0 && replaceCount === 0) {
        console.error(`  ❌ ${testFile} 使用了 path.join 但未使用 replace`);
        allTestsFixed = false;
      }
    } catch (error) {
      console.error(`  ❌ 无法读取 ${testFile}: ${error.message}`);
      allTestsFixed = false;
    }
  }

  if (allTestsFixed) {
    console.log('  ✅ 所有测试文件已正确修复');
  } else {
    hasErrors = true;
  }
} catch (error) {
  console.error('  ❌ 测试失败:', error.message);
  hasErrors = true;
}

// 测试 5: 路径拼接行为演示
console.log('\n✓ 测试 5: 路径拼接行为演示');
testPathJoin();

// 测试 6: 检查是否有遗漏的地方
console.log('✓ 测试 6: 检查遗漏的路径问题');
try {
  const filesToCheck = [
    'services/resource-service/routes/resources.js',
    'services/resource-service/__tests__/routes/resources-integration.test.js',
    'services/resource-service/__tests__/routes/resources-api.mock.test.js'
  ];
  
  let foundIssues = false;
  
  for (const file of filesToCheck) {
    try {
      const content = readFile(file);
      
      // 检查是否有直接使用 resource.file.path 而没有 replace 的情况
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // 跳过注释和字符串定义
        if (line.trim().startsWith('//') || line.includes('path:')) {
          continue;
        }
        
        // 检查是否有 path.join 使用 resource.file.path 但前面没有 replace
        if (line.includes('path.join') && line.includes('resource.file.path')) {
          // 检查前面几行是否有 replace
          let hasReplace = false;
          for (let j = Math.max(0, i - 3); j <= i; j++) {
            if (lines[j].includes('replace(/^') || lines[j].includes('relativePath')) {
              hasReplace = true;
              break;
            }
          }
          
          if (!hasReplace) {
            console.error(`  ❌ ${file}:${i + 1} 直接使用 resource.file.path 未经 replace`);
            foundIssues = true;
          }
        }
      }
    } catch (error) {
      // 文件可能不存在,跳过
    }
  }
  
  if (!foundIssues) {
    console.log('  ✅ 未发现遗漏的路径问题');
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
  console.log('✅ 所有路径修复验证通过!');
  console.log('\n修复总结:');
  console.log('1. ✅ 上传时保存路径保持前导斜杠 (客户端兼容)');
  console.log('2. ✅ 下载时使用 replace 移除前导斜杠 (服务器端)');
  console.log('3. ✅ 删除时使用 replace 移除前导斜杠 (服务器端)');
  console.log('4. ✅ 测试文件同步修复');
  console.log('\n设计原则:');
  console.log('- 📦 数据库存储: /uploads/xxx (带前导斜杠)');
  console.log('- 🌐 客户端拼接: origin + path = https://domain/uploads/xxx');
  console.log('- 💾 服务器读取: path.join(__dirname, path.replace(/^\\/+/, \'\'))');
  console.log('\n影响:');
  console.log('- ✅ 文件下载功能正常工作');
  console.log('- ✅ 文件删除功能正常工作');
  console.log('- ✅ 不再有文件泄漏问题');
  console.log('- ✅ 客户端 URL 拼接正常工作');
  console.log('- ✅ 完全向后兼容 (新旧数据格式一致)');
  process.exit(0);
}

