const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const yargs = require('yargs');

// 解析命令行参数
const argv = yargs
  .option('type', {
    alias: 't',
    description: '要执行的种子数据类型',
    type: 'string'
  })
  .help()
  .alias('help', 'h')
  .argv;

// 数据库连接配置
const dbConfig = require('../config/database');

// 连接数据库
mongoose.connect(dbConfig.mongoUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// 获取所有种子数据文件
const getSeedFiles = (type) => {
  const seedDir = path.join(__dirname, type);
  if (!fs.existsSync(seedDir)) {
    return [];
  }
  return fs.readdirSync(seedDir)
    .filter(file => file.endsWith('.js'))
    .map(file => require(path.join(seedDir, file)));
};

// 执行种子数据
const runSeeds = async () => {
  try {
    console.log('开始执行数据库种子数据...');

    // 如果指定了类型，只执行该类型的种子数据
    if (argv.type) {
      const seedFiles = getSeedFiles(argv.type);
      for (const seed of seedFiles) {
        await seed();
      }
    } else {
      // 执行所有类型的种子数据
      const types = ['users', 'classes', 'courses', 'resources', 'subjects', 'homework', 'progress'];
      for (const type of types) {
        const seedFiles = getSeedFiles(type);
        for (const seed of seedFiles) {
          await seed();
        }
      }
    }

    console.log('数据库种子数据执行完成！');
    process.exit(0);
  } catch (error) {
    console.error('执行种子数据时出错：', error);
    process.exit(1);
  }
};

runSeeds();