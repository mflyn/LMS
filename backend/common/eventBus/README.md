# 统一事件总线系统

## 概述

统一事件总线系统是小学生学习追踪系统中微服务架构的核心组件，用于实现服务间的可靠通信和事件驱动架构。该系统基于RabbitMQ消息队列，提供了统一的事件发布/订阅机制，使各微服务能够以松耦合的方式进行交互。

## 主要特性

- **统一的事件类型定义**：所有微服务使用相同的事件命名和结构
- **可靠的消息传递**：基于RabbitMQ实现消息持久化和可靠传递
- **自动重连机制**：在网络故障时自动尝试重新连接
- **事件追踪**：为每个事件添加元数据，便于追踪和调试
- **灵活的路由**：支持基于主题的消息路由
- **错误处理**：提供完善的错误处理和日志记录

## 安装和配置

事件总线系统已集成在`backend/common/eventBus`目录中，所有微服务可以直接引用。

### 依赖项

确保项目已安装以下依赖：

```bash
npm install amqplib uuid
```

### 环境变量

在`.env`文件或环境变量中设置RabbitMQ连接信息：

```
RABBITMQ_URL=amqp://username:password@hostname:port
```

如果未设置，系统将默认使用`amqp://localhost`。

## 使用指南

### 1. 创建事件总线实例

```javascript
const { createEventBus } = require('../../common/eventBus');
const winston = require('winston'); // 或其他日志库

// 创建事件总线实例
const eventBus = createEventBus({
  serviceName: 'user-service',
  logger: winston.createLogger({
    // 日志配置
  }),
  url: process.env.RABBITMQ_URL,
  reconnectInterval: 5000,
  maxReconnectAttempts: 10
});
```

### 2. 发布事件

```javascript
const { setupEventPublisher, eventTypes } = require('../../common/eventBus');

// 设置事件发布器
const publisher = await setupEventPublisher(eventBus, 'user-service');

// 发布用户创建事件
await publisher.publish(
  eventTypes.USER_EVENTS.CREATED,
  {
    userId: '123456',
    username: 'zhangsan',
    email: 'zhangsan@example.com',
    role: 'student'
  }
);
```

### 3. 订阅事件

```javascript
const { setupEventSubscriber, eventTypes } = require('../../common/eventBus');

// 设置事件订阅
await setupEventSubscriber(
  eventBus,
  'notification-service', // 当前服务名称
  'user-service',        // 事件源服务名称
  [                      // 要订阅的事件类型
    eventTypes.USER_EVENTS.CREATED,
    eventTypes.USER_EVENTS.UPDATED
  ],
  async (message, eventType) => {
    // 处理接收到的事件
    console.log(`收到事件: ${eventType}`, message);
    
    // 根据事件类型执行不同的处理逻辑
    switch (eventType) {
      case eventTypes.USER_EVENTS.CREATED:
        await sendWelcomeNotification(message);
        break;
      case eventTypes.USER_EVENTS.UPDATED:
        await sendProfileUpdateNotification(message);
        break;
    }
  }
);
```

### 4. 创建事件桥接

事件桥接用于将一个服务的事件转发到另一个交换机，实现事件的广播或聚合。

```javascript
const { createEventBridge, createExchangeName } = require('../../common/eventBus');

// 创建从用户服务到系统广播交换机的桥接
await createEventBridge(
  eventBus,
  createExchangeName('user-service'),  // 源交换机
  'system.broadcast',                 // 目标交换机
  ['user.*.created', 'user.*.deleted'] // 要转发的事件模式
);
```

## 完整示例：在服务中集成事件总线

以下是在一个微服务中完整集成事件总线的示例：

```javascript
// server.js
const express = require('express');
const winston = require('winston');
const { 
  createEventBus, 
  setupEventPublisher,
  setupEventSubscriber,
  eventTypes 
} = require('../../common/eventBus');

// 创建Express应用
const app = express();

// 配置日志记录器
const logger = winston.createLogger({
  // 日志配置
});

// 创建事件总线实例
const eventBus = createEventBus({
  serviceName: 'homework-service',
  logger,
  url: process.env.RABBITMQ_URL
});

// 启动服务器
const PORT = process.env.PORT || 3002;
app.listen(PORT, async () => {
  logger.info(`作业服务运行在端口 ${PORT}`);
  
  try {
    // 设置事件发布器
    const publisher = await setupEventPublisher(eventBus, 'homework-service');
    
    // 将发布器添加到app对象，以便在路由中使用
    app.locals.eventPublisher = publisher;
    
    // 订阅用户服务的事件
    await setupEventSubscriber(
      eventBus,
      'homework-service',
      'user-service',
      [eventTypes.USER_EVENTS.CREATED, eventTypes.USER_EVENTS.DELETED],
      async (message, eventType) => {
        // 处理用户事件
        logger.info(`处理用户事件: ${eventType}`);
        
        if (eventType === eventTypes.USER_EVENTS.DELETED) {
          // 当用户被删除时，删除相关的作业记录
          // ...
        }
      }
    );
    
    // 订阅数据服务的事件
    await setupEventSubscriber(
      eventBus,
      'homework-service',
      'data-service',
      [eventTypes.DATA_EVENTS.EXAM_CREATED],
      async (message, eventType) => {
        // 处理考试创建事件
        logger.info(`处理考试事件: ${eventType}`);
        // ...
      }
    );
    
    logger.info('事件总线配置完成');
  } catch (error) {
    logger.error('事件总线配置失败:', error);
  }
});

// 在路由中使用事件发布器
app.post('/api/homework', async (req, res) => {
  try {
    // 创建作业逻辑
    const newHomework = await createHomework(req.body);
    
    // 发布作业创建事件
    await app.locals.eventPublisher.publish(
      eventTypes.HOMEWORK_EVENTS.CREATED,
      newHomework
    );
    
    res.status(201).json(newHomework);
  } catch (error) {
    logger.error('创建作业失败:', error);
    res.status(500).json({ error: '创建作业失败' });
  }
});
```

## 最佳实践

1. **使用标准事件类型**：始终使用`eventTypes`中定义的标准事件类型，确保系统一致性。

2. **添加足够的元数据**：在发布事件时添加足够的元数据，便于追踪和调试。

3. **处理错误**：在事件处理函数中妥善处理错误，避免因单个事件处理失败而影响整个服务。

4. **合理设置重试策略**：根据业务需求设置合理的消息重试策略。

5. **监控事件流**：实现对事件流的监控，及时发现和解决问题。

## 故障排除

### 连接问题

- 检查RabbitMQ服务是否正常运行
- 验证连接URL是否正确
- 检查网络连接和防火墙设置

### 消息未被处理

- 检查交换机和队列绑定是否正确
- 验证路由键是否匹配
- 检查消费者是否正常运行

### 性能问题

- 考虑增加消费者数量
- 优化消息处理逻辑
- 检查RabbitMQ服务器资源使用情况