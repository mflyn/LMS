/**
 * 推荐服务事件总线集成示例
 * 展示如何在推荐服务中集成和使用统一事件总线
 */

const { 
  createEventBus, 
  setupEventPublisher,
  setupEventSubscriber,
  eventTypes 
} = require('../../eventBus');
const { HybridRecommender } = require('../../../services/resource-service/utils/collaborativeFiltering');

/**
 * 配置推荐服务的事件总线
 * @param {Object} app - Express应用实例
 * @param {Object} logger - 日志记录器
 * @returns {Promise<Object>} 包含eventBus和publisher的对象
 */
async function configureRecommendationServiceEventBus(app, logger) {
  try {
    // 创建事件总线实例
    const eventBus = createEventBus({
      serviceName: 'recommendation-service',
      logger,
      url: process.env.RABBITMQ_URL || 'amqp://localhost',
      reconnectInterval: 5000,
      maxReconnectAttempts: 10
    });
    
    // 设置事件发布器
    const publisher = await setupEventPublisher(eventBus, 'recommendation-service');
    
    // 将发布器添加到app对象，以便在路由中使用
    app.locals.eventPublisher = publisher;
    app.locals.eventBus = eventBus;
    
    // 订阅资源服务的事件
    await setupEventSubscriber(
      eventBus,
      'recommendation-service',
      'resource-service',
      [eventTypes.RESOURCE_EVENTS.RATED, eventTypes.RESOURCE_EVENTS.VIEWED],
      async (message, eventType) => {
        // 处理资源评分和查看事件，用于更新推荐模型
        if (eventType === eventTypes.RESOURCE_EVENTS.RATED) {
          logger.info(`处理资源评分事件: ${message._metadata.messageId}`);
          await handleResourceRatingEvent(message, logger);
        } else if (eventType === eventTypes.RESOURCE_EVENTS.VIEWED) {
          logger.info(`处理资源查看事件: ${message._metadata.messageId}`);
          await handleResourceViewEvent(message, logger);
        }
      }
    );
    
    // 订阅用户服务的事件
    await setupEventSubscriber(
      eventBus,
      'recommendation-service',
      'user-service',
      [eventTypes.USER_EVENTS.CREATED],
      async (message, eventType) => {
        // 当新用户创建时，可能需要为其生成初始推荐
        if (eventType === eventTypes.USER_EVENTS.CREATED) {
          logger.info(`处理用户创建事件: ${message._metadata.messageId}`);
          await generateInitialRecommendations(message.userId, publisher, logger);
        }
      }
    );
    
    logger.info('[recommendation-service] 事件总线配置完成');
    
    // 优雅关闭
    setupGracefulShutdown(eventBus, logger);
    
    return { eventBus, publisher };
  } catch (error) {
    logger.error('[recommendation-service] 事件总线配置失败:', error);
    throw error;
  }
}

/**
 * 处理资源评分事件
 * @param {Object} message - 事件消息
 * @param {Object} logger - 日志记录器
 */
async function handleResourceRatingEvent(message, logger) {
  try {
    // 这里实现处理资源评分事件的逻辑
    // 例如：更新用户-资源评分矩阵，重新计算相似度等
    logger.info(`用户 ${message.userId} 对资源 ${message.resourceId} 评分: ${message.rating}`);
    
    // 在实际实现中，这里可能需要：
    // 1. 更新数据库中的评分记录
    // 2. 更新推荐模型的内部状态
    // 3. 可能触发重新计算推荐
    
    // 示例：更新评分记录
    // await updateRatingRecord(message.userId, message.resourceId, message.rating);
    
    // 示例：如果评分变化较大，可能需要重新生成推荐
    // if (message.ratingChange > 2) {
    //   await regenerateRecommendations(message.userId);
    // }
  } catch (error) {
    logger.error(`处理资源评分事件时出错:`, error);
  }
}

/**
 * 处理资源查看事件
 * @param {Object} message - 事件消息
 * @param {Object} logger - 日志记录器
 */
async function handleResourceViewEvent(message, logger) {
  try {
    // 这里实现处理资源查看事件的逻辑
    // 例如：更新用户行为记录，用于基于行为的推荐
    logger.info(`用户 ${message.userId} 查看了资源 ${message.resourceId}`);
    
    // 在实际实现中，这里可能需要：
    // 1. 记录用户查看行为
    // 2. 更新用户兴趣模型
    // 3. 可能用于冷启动推荐
    
    // 示例：记录查看行为
    // await recordViewBehavior(message.userId, message.resourceId, message.timestamp);
  } catch (error) {
    logger.error(`处理资源查看事件时出错:`, error);
  }
}

/**
 * 为新用户生成初始推荐
 * @param {string} userId - 用户ID
 * @param {Object} publisher - 事件发布器
 * @param {Object} logger - 日志记录器
 */
async function generateInitialRecommendations(userId, publisher, logger) {
  try {
    logger.info(`为新用户 ${userId} 生成初始推荐`);
    
    // 这里实现为新用户生成初始推荐的逻辑
    // 例如：基于热门资源、新资源等生成推荐
    
    // 示例：获取热门资源作为初始推荐
    // const popularResources = await getPopularResources(10);
    
    // 发布推荐事件
    // if (publisher && popularResources.length > 0) {
    //   const eventData = {
    //     userId,
    //     timestamp: new Date().toISOString(),
    //     recommendationType: 'initial',
    //     recommendations: popularResources.map(resource => ({
    //       resourceId: resource._id.toString(),
    //       title: resource.title,
    //       score: 1.0,
    //       reason: '热门资源'
    //     }))
    //   };
    //   
    //   await publisher.publish(
    //     eventTypes.RESOURCE_EVENTS.RECOMMENDED,
    //     eventData
    //   );
    //   
    //   logger.info(`为新用户 ${userId} 发布了初始推荐事件`);
    // }
  } catch (error) {
    logger.error(`为新用户生成初始推荐时出错:`, error);
  }
}

/**
 * 使用协同过滤生成推荐并发布事件
 * @param {string} userId - 用户ID
 * @param {Array} userRatings - 用户评分数据
 * @param {Array} resources - 资源数据
 * @param {Object} filters - 过滤条件
 * @param {Object} publisher - 事件发布器
 * @param {Object} logger - 日志记录器
 * @returns {Array} 推荐结果
 */
async function generateRecommendationsWithEvents(userId, userRatings, resources, filters, publisher, logger) {
  try {
    // 创建推荐器实例
    const recommender = new HybridRecommender({
      userWeight: 0.5,
      itemWeight: 0.5,
      maxRecommendations: 10,
      logger
    });
    
    // 生成推荐
    const recommendations = recommender.generateRecommendations(
      userId, userRatings, resources, filters
    );
    
    // 如果有推荐结果且有事件发布器，则发布推荐事件
    if (recommendations.length > 0 && publisher) {
      const eventData = {
        userId,
        timestamp: new Date().toISOString(),
        recommendationType: 'hybrid',
        filters: filters,
        recommendations: recommendations.map(rec => ({
          resourceId: rec.resource._id.toString(),
          title: rec.resource.title,
          score: rec.score,
          similarityScore: rec.similarityScore
        }))
      };
      
      await publisher.publish(
        eventTypes.RESOURCE_EVENTS.RECOMMENDED,
        eventData
      );
      
      logger.info(`为用户 ${userId} 发布了资源推荐事件，包含 ${recommendations.length} 个推荐`);
    }
    
    return recommendations;
  } catch (error) {
    logger.error(`生成推荐并发布事件时出错:`, error);
    return [];
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

module.exports = {
  configureRecommendationServiceEventBus,
  handleResourceRatingEvent,
  handleResourceViewEvent,
  generateInitialRecommendations,
  generateRecommendationsWithEvents
};