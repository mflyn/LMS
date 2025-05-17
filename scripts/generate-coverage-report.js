/**
 * 生成测试覆盖率报告
 * 
 * 这个脚本手动计算项目的测试覆盖率，并生成一个简单的报告
 */

const fs = require('fs');
const path = require('path');

// 服务列表
const services = [
  'analytics-service',
  'data-service',
  'progress-service',
  'notification-service',
  'resource-service',
  'interaction-service',
  'user-service',
  'homework-service'
];

// 文件类型
const fileTypes = ['.js', '.jsx', '.ts', '.tsx'];

// 排除的目录
const excludeDirs = ['node_modules', 'coverage', 'dist', 'build', '__tests__', '__mocks__'];

// 统计结果
const stats = {
  totalFiles: 0,
  testedFiles: 0,
  totalLines: 0,
  testedLines: 0,
  serviceStats: {}
};

// 初始化服务统计
services.forEach(service => {
  stats.serviceStats[service] = {
    totalFiles: 0,
    testedFiles: 0,
    totalLines: 0,
    testedLines: 0,
    coverage: 0
  };
});

// 检查文件是否有对应的测试文件
function hasTestFile(filePath) {
  const dir = path.dirname(filePath);
  const fileName = path.basename(filePath, path.extname(filePath));
  
  // 检查同目录下的测试文件
  const testPath1 = path.join(dir, `${fileName}.test${path.extname(filePath)}`);
  const testPath2 = path.join(dir, `${fileName}.spec${path.extname(filePath)}`);
  
  // 检查 __tests__ 目录下的测试文件
  const testDir = path.join(dir, '__tests__');
  const testPath3 = path.join(testDir, `${fileName}.test${path.extname(filePath)}`);
  const testPath4 = path.join(testDir, `${fileName}.spec${path.extname(filePath)}`);
  
  return (
    fs.existsSync(testPath1) || 
    fs.existsSync(testPath2) || 
    fs.existsSync(testPath3) || 
    fs.existsSync(testPath4)
  );
}

// 计算文件的行数
function countLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.split('\n').length;
  } catch (error) {
    console.error(`无法读取文件 ${filePath}: ${error.message}`);
    return 0;
  }
}

// 递归扫描目录
function scanDir(dir, service) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      // 排除特定目录
      if (entry.isDirectory() && !excludeDirs.includes(entry.name)) {
        scanDir(fullPath, service);
      } 
      // 处理文件
      else if (entry.isFile() && fileTypes.includes(path.extname(entry.name))) {
        const lines = countLines(fullPath);
        const hasTested = hasTestFile(fullPath);
        
        // 更新统计
        stats.totalFiles++;
        stats.totalLines += lines;
        stats.serviceStats[service].totalFiles++;
        stats.serviceStats[service].totalLines += lines;
        
        if (hasTested) {
          stats.testedFiles++;
          stats.testedLines += lines;
          stats.serviceStats[service].testedFiles++;
          stats.serviceStats[service].testedLines += lines;
        }
      }
    }
  } catch (error) {
    console.error(`扫描目录 ${dir} 失败: ${error.message}`);
  }
}

// 计算覆盖率
function calculateCoverage() {
  // 计算总体覆盖率
  stats.fileCoverage = stats.totalFiles > 0 
    ? (stats.testedFiles / stats.totalFiles * 100).toFixed(2) 
    : 0;
  
  stats.lineCoverage = stats.totalLines > 0 
    ? (stats.testedLines / stats.totalLines * 100).toFixed(2) 
    : 0;
  
  // 计算各服务覆盖率
  for (const service in stats.serviceStats) {
    const serviceStat = stats.serviceStats[service];
    serviceStat.fileCoverage = serviceStat.totalFiles > 0 
      ? (serviceStat.testedFiles / serviceStat.totalFiles * 100).toFixed(2) 
      : 0;
    
    serviceStat.lineCoverage = serviceStat.totalLines > 0 
      ? (serviceStat.testedLines / serviceStat.totalLines * 100).toFixed(2) 
      : 0;
  }
}

// 生成报告
function generateReport() {
  let report = '# 测试覆盖率报告\n\n';
  report += `生成时间: ${new Date().toLocaleString()}\n\n`;
  
  report += '## 总体覆盖率\n\n';
  report += `- 文件覆盖率: ${stats.fileCoverage}% (${stats.testedFiles}/${stats.totalFiles})\n`;
  report += `- 代码行覆盖率: ${stats.lineCoverage}% (${stats.testedLines}/${stats.totalLines})\n\n`;
  
  report += '## 各服务覆盖率\n\n';
  report += '| 服务名称 | 文件覆盖率 | 代码行覆盖率 | 测试文件数/总文件数 | 测试代码行数/总代码行数 |\n';
  report += '|---------|-----------|-------------|-------------------|---------------------|\n';
  
  for (const service in stats.serviceStats) {
    const stat = stats.serviceStats[service];
    report += `| ${service} | ${stat.fileCoverage}% | ${stat.lineCoverage}% | ${stat.testedFiles}/${stat.totalFiles} | ${stat.testedLines}/${stat.totalLines} |\n`;
  }
  
  return report;
}

// 主函数
function main() {
  console.log('开始生成测试覆盖率报告...');
  
  // 扫描各服务目录
  services.forEach(service => {
    const serviceDir = path.join(__dirname, '..', 'backend', 'services', service);
    if (fs.existsSync(serviceDir)) {
      console.log(`扫描服务: ${service}`);
      scanDir(serviceDir, service);
    } else {
      console.warn(`服务目录不存在: ${serviceDir}`);
    }
  });
  
  // 计算覆盖率
  calculateCoverage();
  
  // 生成报告
  const report = generateReport();
  
  // 保存报告
  const reportPath = path.join(__dirname, '..', 'coverage-report.md');
  fs.writeFileSync(reportPath, report);
  
  console.log(`测试覆盖率报告已生成: ${reportPath}`);
}

// 执行主函数
main();
