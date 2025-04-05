# 数据库迁移脚本

此目录包含所有数据库迁移脚本，用于初始化数据库结构和填充初始数据。迁移脚本确保数据库结构和基础数据在所有环境中保持一致。

## 使用方法

1. 确保MongoDB服务已启动
2. 运行迁移脚本：`node runMigrations.js`
3. 也可以通过导入模块方式在应用启动时执行：
   ```javascript
   const runMigrations = require('./common/migrations/runMigrations');
   
   // 在应用启动时执行迁移
   async function startApp() {
     await runMigrations();
     // 继续应用启动流程...
   }
   ```

## 迁移脚本命名规则

迁移脚本按照执行顺序编号，格式为：`001_migration_name.js`、`002_migration_name.js`等。这确保了迁移脚本按照正确的顺序执行。

## 编写迁移脚本

每个迁移脚本应该导出一个异步函数，该函数执行特定的数据库操作：

```javascript
// 示例：001_create_users_collection.js
const { MongoClient } = require('mongodb');
const config = require('../config');

module.exports = async function() {
  const client = new MongoClient(config.mongodb.url);
  
  try {
    await client.connect();
    const db = client.db(config.mongodb.dbName);
    
    // 创建集合
    await db.createCollection('users', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['username', 'email', 'role'],
          properties: {
            username: { bsonType: 'string' },
            email: { bsonType: 'string' },
            role: { enum: ['student', 'teacher', 'parent', 'admin'] }
          }
        }
      }
    });
    
    // 创建索引
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    
    console.log('用户集合创建成功');
  } finally {
    await client.close();
  }
};
```

## 最佳实践

1. **幂等性**：确保迁移脚本可以多次执行而不会产生副作用
2. **原子性**：每个迁移脚本应该执行单一的逻辑变更
3. **错误处理**：妥善处理可能出现的错误，并提供清晰的错误信息
4. **日志记录**：记录迁移过程中的关键步骤和结果
5. **回滚机制**：在可能的情况下，提供回滚操作的实现

## 注意事项

- 已执行过的迁移脚本不应该被修改，如需变更应创建新的迁移脚本
- 在生产环境执行迁移前，应在测试环境充分测试
- 大型数据迁移可能需要考虑性能影响，建议在低峰期执行