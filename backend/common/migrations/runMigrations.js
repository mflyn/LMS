/**
 * 数据库迁移脚本运行器
 * 按顺序执行所有迁移脚本
 */

const fs = require('fs');
const path = require('path');

async function runMigrations() {
  console.log('开始执行数据库迁移...');
  
  try {
    // 获取迁移脚本目录中的所有JS文件
    const migrationFiles = fs.readdirSync(__dirname)
      .filter(file => file.endsWith('.js') && file !== 'runMigrations.js')
      .sort(); // 确保按文件名顺序执行
    
    console.log(`找到 ${migrationFiles.length} 个迁移脚本`);
    
    // 按顺序执行每个迁移脚本
    for (const file of migrationFiles) {
      console.log(`执行迁移脚本: ${file}`);
      const migration = require(path.join(__dirname, file));
      await migration();
      console.log(`迁移脚本 ${file} 执行完成`);
    }
    
    console.log('所有迁移脚本执行完成');
  } catch (err) {
    console.error('迁移过程中发生错误:', err);
    process.exit(1);
  }
}

// 如果直接运行此脚本，则执行迁移
if (require.main === module) {
  runMigrations();
}

module.exports = runMigrations;