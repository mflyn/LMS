/**
 * 微服务事件总线集成示例
 * 展示如何在微服务中集成和使用统一事件总线
 */

const express = require('express');
const { 
  createEventBus, 
  setupEventPublisher,
  setupEventSubscriber,
  eventTypes 
} = require('../../eventBus');

/**
 * 配置微服务的事件总线
 * @param {Object} app - Express应用实例
 * @param {string} serviceName - 服务名称
 * @param {Object} logger - 日志记录器
 * @param {Object} config - 配置对象
 * @returns {Promise<void>}
 */
async function configureEventBus(app, serviceName, logger, config = {}) {
  try {
    // 创建事件总线实例
    const eventBus = createEventBus({
      serviceName,
      logger,
      url: process.env.RABBITMQ_URL || config.rabbitmqUrl || 'amqp://localhost',
      reconnectInterval: config.reconnectInterval || 5000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10
    });
    
    // 设置事件发布器
    const publisher = await setupEventPublisher(eventBus, serviceName);
    
    // 将发布器添加到app对象，以便在路由中使用
    app.locals.eventPublisher = publisher;
    app.locals.eventBus = eventBus;
    
    // 配置事件订阅
    await configureEventSubscriptions(eventBus, serviceName, logger);
    
    logger.info(`[${serviceName}] 事件总线配置完成`);
    
    // 优雅关闭
    setupGracefulShutdown(eventBus, logger);
    
    return { eventBus, publisher };
  } catch (error) {
    logger.error(`[${serviceName}] 事件总线配置失败:`, error);
    throw error;
  }
}

/**
 * 配置服务的事件订阅
 * 根据服务类型订阅不同的事件
 * @param {Object} eventBus - 事件总线实例
 * @param {string} serviceName - 服务名称
 * @param {Object} logger - 日志记录器
 * @returns {Promise<void>}
 */
async function configureEventSubscriptions(eventBus, serviceName, logger) {
  // 根据服务类型配置不同的事件订阅
  switch (serviceName) {
    case 'user-service':
      // 用户服务不需要订阅其他服务的事件，但需要发布用户相关事件
      logger.info('[user-service] 配置为事件发布者');
      break;
      
    case 'notification-service':
      // 通知服务需要订阅多个服务的事件
      await setupEventSubscriber(
        eventBus,
        serviceName,
        'user-service',
        [
          eventTypes.USER_EVENTS.CREATED,
          eventTypes.USER_EVENTS.UPDATED,
          eventTypes.USER_EVENTS.PASSWORD_RESET_REQUESTED
        ],
        handleUserEvents
      );
      
      await setupEventSubscriber(
        eventBus,
        serviceName,
        'homework-service',
        [
          eventTypes.HOMEWORK_EVENTS.ASSIGNED,
          eventTypes.HOMEWORK_EVENTS.GRADED
        ],
        handleHomeworkEvents
      );
      
      logger.info('[notification-service] 已订阅用户和作业事件');
      break;
      
    case 'resource-service':
      // 资源服务需要发布资源相关事件，并可能订阅用户事件
      await setupEventSubscriber(
        eventBus,
        serviceName,
        'user-service',
        [eventTypes.USER_EVENTS.DELETED],
        async (message, eventType) => {
          // 当用户被删除时，处理该用户上传的资源
          if (eventType === eventTypes.USER_EVENTS.DELETED) {
            logger.info(`处理用户删除事件: ${message._metadata.messageId}`);
            // 实现资源处理逻辑
            // 例如: await handleDeletedUserResources(message.userId);
          }
        }
      );
      
      logger.info('[resource-service] 已订阅用户删除事件');
      break;
      
    case 'homework-service':
      // 作业服务需要订阅用户和数据服务的事件
      await setupEventSubscriber(
        eventBus,
        serviceName,
        'user-service',
        [eventTypes.USER_EVENTS.CREATED, eventTypes.USER_EVENTS.DELETED],
        handleUserEvents
      );
      
      await setupEventSubscriber(
        eventBus,
        serviceName,
        'data-service',
        [eventTypes.DATA_EVENTS.EXAM_CREATED],
        handleDataEvents
      );
      
      logger.info('[homework-service] 已订阅用户和数据事件');
      break;
      
    // 可以根据需要添加更多服务的订阅配置
    
    default:
      logger.info(`[${serviceName}] 没有配置特定的事件订阅`);
  }
}

/**
 * 处理用户事件的回调函数
 * @param {Object} message - 事件消息
 * @param {string} eventType - 事件类型
 */
async function handleUserEvents(message, eventType) {
  console.log(`处理用户事件: ${eventType}`, message);
  
  // 根据事件类型执行不同的处理逻辑
  switch (eventType) {
    case eventTypes.USER_EVENTS.CREATED:
      // 处理用户创建事件
      // 例如: await sendWelcomeNotification(message);
      break;
      
    case eventTypes.USER_EVENTS.UPDATED:
      // 处理用户更新事件
      // 例如: await updateUserRelatedData(message);
      break;
      
    case eventTypes.USER_EVENTS.DELETED:
      // 处理用户删除事件
      // 例如: await cleanupUserData(message.userId);
      break;
      
    case eventTypes.USER_EVENTS.PASSWORD_RESET_REQUESTED:
      // 处理密码重置请求事件
      // 例如: await sendPasswordResetEmail(message);
      break;
  }
}

/**
 * 处理作业事件的回调函数
 * @param {Object} message - 事件消息
 * @param {string} eventType - 事件类型
 */
async function handleHomeworkEvents(message, eventType) {
  console.log(`处理作业事件: ${eventType}`, message);
  
  // 根据事件类型执行不同的处理逻辑
  switch (eventType) {
    case eventTypes.HOMEWORK_EVENTS.ASSIGNED:
      // 处理作业分配事件
      // 例如: await sendHomeworkAssignedNotification(message);
      break;
      
    case eventTypes.HOMEWORK_EVENTS.GRADED:
      // 处理作业评分事件
      // 例如: await sendHomeworkGradedNotification(message);
      break;
  }
}

/**
 * 处理数据服务事件的回调函数
 * @param {Object} message - 事件消息
 * @param {string} eventType - 事件类型
 */
async function handleDataEvents(message, eventType) {
  console.log(`处理数据事件: ${eventType}`, message);
  
  // 根据事件类型执行不同的处理逻辑
  switch (eventType) {
    case eventTypes.DATA_EVENTS.EXAM_CREATED:
      // 处理考试创建事件
      // 例如: await createRelatedHomework(message);
      break;
  }
}

/**
 * 设置优雅关闭
 * 确保在服务关闭时正确关闭事件总线连接
 * @param {Object} eventBus - 事件总线实例
 * @param {Object} logger - 日志记录器
 */
function setupGracefulShutdown(eventBus, logger) {
  // 处理进程终止信号
  process.on('SIGTERM', async () => {
    logger.info('收到SIGTERM信号，正在关闭事件总线连接...');
    await eventBus.close();
    logger.info('事件总线连接已关闭');
    process.exit(0);
  });
  
  process.on('SIGINT', async () => {
    logger.info('收到SIGINT信号，正在关闭事件总线连接...');
    await eventBus.close();
    logger.info('事件总线连接已关闭');
    process.exit(0);
  });
}

/**
 * 在Express路由中使用事件发布的示例
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @param {Object} eventPublisher - 事件发布器
 * @param {string} eventType - 事件类型
 * @param {Object} eventData - 事件数据
 */
async function publishEventExample(req, res, eventPublisher, eventType, eventData) {
  try {
    // 发布事件
    const published = await eventPublisher.publish(eventType, eventData);
    
    if (published) {
      console.log(`事件发布成功: ${eventType}`);
    } else {
      console.error(`事件发布失败: ${eventType}`);
    }
    
    return published;
  } catch (error) {
    console.error(`发布事件时出错: ${error.message}`);
    return false;
  }
}

module.exports = {
  configureEventBus,
  configureEventSubscriptions,
  handleUserEvents,
  handleHomeworkEvents,
  handleDataEvents,
  publishEventExample
};