0918# 事件总线集成示例

## 概述

本目录包含了在小学生学习追踪系统的各个微服务中集成统一事件总线的示例代码。这些示例展示了如何使用事件总线实现服务间的可靠通信，特别是在资源推荐和协同过滤算法的场景中。

## 示例文件说明

### 1. serviceIntegration.js

通用的微服务事件总线集成示例，展示了如何在任何微服务中配置和使用事件总线。包括：

- 创建事件总线实例
- 配置事件发布器
- 设置事件订阅
- 处理各类事件的示例
- 优雅关闭连接

### 2. resourceServiceIntegration.js

资源服务的事件总线集成示例，展示了如何在资源服务中使用事件总线：

- 配置资源服务专用的事件总线
- 订阅用户删除事件，处理被删除用户的资源
- 订阅分析服务的洞察事件，更新资源推荐
- 发布资源创建和推荐事件的示例

### 3. resourceRecommendationEvents.js

资源推荐功能的事件集成示例，展示了如何将协同过滤算法与事件总线结合：

- 创建带有事件发布功能的资源推荐器
- 发布资源评分事件
- 发布资源查看事件
- 发布资源下载事件

### 4. resourceRouteIntegration.js

资源服务路由的事件总线集成示例，展示了如何在API路由中使用事件总线：

- 在获取资源详情时发布资源查看事件
- 在下载资源时发布资源下载事件
- 在创建资源时发布资源创建事件
- 在评价资源时发布资源评分事件

### 5. recommendationServiceIntegration.js

推荐服务的事件总线集成示例，展示了如何在推荐服务中使用事件总线：

- 订阅资源评分和查看事件，更新推荐模型
- 订阅用户创建事件，为新用户生成初始推荐
- 使用协同过滤生成推荐并发布推荐事件

## 使用方法

### 在微服务中集成事件总线

1. 在微服务的入口文件（通常是server.js）中引入事件总线配置：

```javascript
const { configureEventBus } = require('../../common/eventBus/examples/serviceIntegration');

// 创建Express应用
const app = express();

// 配置日志记录器
const logger = winston.createLogger({
  // 日志配置
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  logger.info(`服务运行在端口 ${PORT}`);
  
  try {
    // 配置事件总线
    const { eventBus, publisher } = await configureEventBus(app, '服务名称', logger);
    
    // 现在可以在路由中使用app.locals.eventPublisher发布事件
    
    logger.info('服务启动完成');
  } catch (error) {
    logger.error('服务启动失败:', error);
  }
});
```

### 在路由中发布事件

```javascript
app.post('/api/resources', async (req, res) => {
  try {
    // 创建资源的业务逻辑
    const resource = await createResource(req.body);
    
    // 发布资源创建事件
    if (app.locals.eventPublisher) {
      const eventData = {
        resourceId: resource._id.toString(),
        title: resource.title,
        // 其他资源数据
      };
      
      app.locals.eventPublisher.publish(
        eventTypes.RESOURCE_EVENTS.CREATED,
        eventData
      ).catch(err => {
        logger.error('发布资源创建事件失败:', err);
      });
    }
    
    res.status(201).json(resource);
  } catch (err) {
    logger.error('创建资源失败:', err);
    res.status(500).json({ message: '创建资源失败', error: err.message });
  }
});
```

### 在协同过滤算法中集成事件发布

```javascript
const { createResourceRecommender } = require('../../common/eventBus/examples/resourceRecommendationEvents');

// 创建带有事件发布功能的推荐器
const recommender = createResourceRecommender({ maxRecommendations: 10 }, logger);

// 在路由中使用
app.get('/api/recommendations', async (req, res) => {
  try {
    const userId = req.user.id;
    const userRatings = await fetchUserRatings();
    const resources = await fetchResources();
    
    // 生成推荐并发布事件
    const recommendations = await recommender.generateRecommendationsWithEvents(
      userId, userRatings, resources, req.query, app.locals.eventPublisher
    );
    
    res.json(recommendations);
  } catch (err) {
    logger.error('生成推荐失败:', err);
    res.status(500).json({ message: '生成推荐失败', error: err.message });
  }
});
```

## 最佳实践

1. **使用标准事件类型**：始终使用`eventTypes`中定义的标准事件类型，确保系统一致性。

2. **错误处理**：在发布事件时使用`.catch()`处理可能的错误，避免因事件发布失败而影响主业务流程。

3. **异步处理**：事件处理应该是异步的，不要在主请求处理流程中等待事件处理完成。

4. **事件数据结构**：保持事件数据结构的一致性，包含必要的元数据（如时间戳、事件ID等）。

5. **优雅关闭**：确保在服务关闭时正确关闭事件总线连接，避免消息丢失。