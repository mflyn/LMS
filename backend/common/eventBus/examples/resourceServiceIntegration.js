/**
 * 资源服务事件总线集成示例
 * 展示如何在资源服务中集成和使用统一事件总线
 */

const { 
  createEventBus, 
  setupEventPublisher,
  setupEventSubscriber,
  eventTypes 
} = require('../../eventBus');

/**
 * 配置资源服务的事件总线
 * @param {Object} app - Express应用实例
 * @param {Object} logger - 日志记录器
 * @returns {Promise<Object>} 包含eventBus和publisher的对象
 */
async function configureResourceServiceEventBus(app, logger) {
  try {
    // 创建事件总线实例
    const eventBus = createEventBus({
      serviceName: 'resource-service',
      logger,
      url: process.env.RABBITMQ_URL || 'amqp://localhost',
      reconnectInterval: 5000,
      maxReconnectAttempts: 10
    });
    
    // 设置事件发布器
    const publisher = await setupEventPublisher(eventBus, 'resource-service');
    
    // 将发布器添加到app对象，以便在路由中使用
    app.locals.eventPublisher = publisher;
    app.locals.eventBus = eventBus;
    
    // 订阅用户服务的事件
    await setupEventSubscriber(
      eventBus,
      'resource-service',
      'user-service',
      [eventTypes.USER_EVENTS.DELETED],
      async (message, eventType) => {
        // 当用户被删除时，处理该用户上传的资源
        if (eventType === eventTypes.USER_EVENTS.DELETED) {
          logger.info(`处理用户删除事件: ${message._metadata.messageId}`);
          await handleDeletedUserResources(message.userId, logger);
        }
      }
    );
    
    // 订阅分析服务的事件
    await setupEventSubscriber(
      eventBus,
      'resource-service',
      'analytics-service',
      [eventTypes.ANALYTICS_EVENTS.INSIGHT_DISCOVERED],
      async (message, eventType) => {
        // 当发现新的学习洞察时，可能需要调整资源推荐
        if (eventType === eventTypes.ANALYTICS_EVENTS.INSIGHT_DISCOVERED) {
          logger.info(`处理学习洞察事件: ${message._metadata.messageId}`);
          if (message.insightType === 'resource_recommendation') {
            await updateResourceRecommendations(message.data, logger);
          }
        }
      }
    );
    
    logger.info('[resource-service] 事件总线配置完成');
    
    // 优雅关闭
    setupGracefulShutdown(eventBus, logger);
    
    return { eventBus, publisher };
  } catch (error) {
    logger.error('[resource-service] 事件总线配置失败:', error);
    throw error;
  }
}

/**
 * 处理被删除用户的资源
 * @param {string} userId - 被删除的用户ID
 * @param {Object} logger - 日志记录器
 */
async function handleDeletedUserResources(userId, logger) {
  try {
    // 这里实现处理被删除用户资源的逻辑
    // 例如：将资源标记为系统资源，或者删除资源
    const Resource = require('../../models/Resource');
    
    // 查找用户上传的所有资源
    const userResources = await Resource.find({ uploader: userId });
    
    logger.info(`找到 ${userResources.length} 个属于用户 ${userId} 的资源`);
    
    // 将资源标记为系统资源（而不是删除它们）
    await Resource.updateMany(
      { uploader: userId },
      { 
        $set: { 
          uploader: null,
          systemResource: true,
          notes: `原上传者(ID:${userId})已被删除`
        }
      }
    );
    
    logger.info(`已将 ${userResources.length} 个资源标记为系统资源`);
  } catch (error) {
    logger.error(`处理被删除用户资源时出错:`, error);
  }
}

/**
 * 更新资源推荐
 * @param {Object} insightData - 洞察数据
 * @param {Object} logger - 日志记录器
 */
async function updateResourceRecommendations(insightData, logger) {
  try {
    // 根据分析服务提供的洞察更新资源推荐
    logger.info(`根据洞察更新资源推荐: ${insightData.insightId}`);
    
    // 实现推荐更新逻辑
    // ...
  } catch (error) {
    logger.error(`更新资源推荐时出错:`, error);
  }
}

/**
 * 设置优雅关闭
 * @param {Object} eventBus - 事件总线实例
 * @param {Object} logger - 日志记录器
 */
function setupGracefulShutdown(eventBus, logger) {
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
 * 资源服务中发布事件的示例
 */
const resourceEventExamples = {
  /**
   * 发布资源创建事件
   * @param {Object} resource - 新创建的资源对象
   * @param {Object} publisher - 事件发布器
   * @param {Object} logger - 日志记录器
   */
  publishResourceCreated: async (resource, publisher, logger) => {
    try {
      const eventData = {
        resourceId: resource._id.toString(),
        title: resource.title,
        type: resource.type,
        subject: resource.subject,
        grade: resource.grade,
        uploaderId: resource.uploader ? resource.uploader.toString() : null
      };
      
      const published = await publisher.publish(
        eventTypes.RESOURCE_EVENTS.CREATED,
        eventData
      );
      
      if (published) {
        logger.info(`资源创建事件发布成功: ${resource._id}`);
      } else {
        logger.warn(`资源创建事件发布失败: ${resource._id}`);
      }
      
      return published;
    } catch (error) {
      logger.error(`发布资源创建事件时出错:`, error);
      return false;
    }
  },
  
  /**
   * 发布资源推荐事件
   * @param {string} userId - 用户ID
   * @param {Array} recommendations - 推荐资源列表
   * @param {Object} publisher - 事件发布器
   * @param {Object} logger - 日志记录器
   */
  publishResourceRecommended: async (userId, recommendations, publisher, logger) => {
    try {
      const eventData = {
        userId,
        timestamp: new Date().toISOString(),
        recommendations: recommendations.map(rec => ({
          resourceId: rec.resource._id.toString(),
          title: rec.resource.title,
          score: rec.score,
          similarityScore: rec.similarityScore
        }))
      };
      
      const published = await publisher.publish(
        eventTypes.RESOURCE_EVENTS.RECOMMENDED,
        eventData
      );
      
      if (published) {
        logger.info(`资源推荐事件发布成功: 用户 ${userId}, ${recommendations.length} 个推荐`);
      } else {
        logger.warn(`资源推荐事件发布失败: 用户 ${userId}`);
      }
      
      return published;
    } catch (error) {
      logger.error(`发布资源推荐事件时出错:`, error);
      return false;
    }
  }
};

module.exports = {
  configureResourceServiceEventBus,
  handleDeletedUserResources,
  updateResourceRecommendations,
  resourceEventExamples
};