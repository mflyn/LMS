/**
 * 事件总线工厂
 * 为微服务提供创建和配置事件总线实例的统一接口
 */

const EventBus = require('./eventBus');
const eventTypes = require('./eventTypes');

/**
 * 创建事件总线实例
 * @param {Object} config - 配置对象
 * @param {string} config.serviceName - 服务名称
 * @param {Object} config.logger - 日志记录器
 * @param {string} config.url - RabbitMQ连接URL
 * @param {number} config.reconnectInterval - 重连间隔(毫秒)
 * @param {number} config.maxReconnectAttempts - 最大重连尝试次数
 * @returns {EventBus} 事件总线实例
 */
function createEventBus(config) {
  const eventBus = new EventBus(config);
  
  // 立即连接到RabbitMQ
  eventBus.connect().catch(err => {
    const logger = config.logger || console;
    logger.error(`[EventBusFactory] 初始连接失败: ${err.message}`);
  });
  
  return eventBus;
}

/**
 * 为服务创建标准化的交换机名称
 * @param {string} serviceName - 服务名称
 * @returns {string} 标准化的交换机名称
 */
function createExchangeName(serviceName) {
  return `${serviceName}.events`;
}

/**
 * 为服务创建标准化的队列名称
 * @param {string} serviceName - 服务名称
 * @param {string} purpose - 队列用途
 * @returns {string} 标准化的队列名称
 */
function createQueueName(serviceName, purpose) {
  return `${serviceName}.${purpose}`;
}

/**
 * 配置服务的事件发布
 * @param {EventBus} eventBus - 事件总线实例
 * @param {string} serviceName - 服务名称
 * @returns {Object} 事件发布器
 */
async function setupEventPublisher(eventBus, serviceName) {
  const exchangeName = createExchangeName(serviceName);
  
  // 确保交换机存在
  await eventBus.assertExchange(exchangeName, 'topic');
  
  return {
    /**
     * 发布事件
     * @param {string} eventType - 事件类型
     * @param {Object} eventData - 事件数据
     * @param {Object} options - 发布选项
     * @returns {Promise<boolean>} 发布是否成功
     */
    publish: async (eventType, eventData, options = {}) => {
      return eventBus.publish(exchangeName, eventType, eventData, options);
    }
  };
}

/**
 * 配置服务的事件订阅
 * @param {EventBus} eventBus - 事件总线实例
 * @param {string} serviceName - 服务名称
 * @param {string} sourceService - 事件源服务名称
 * @param {Array<string>} eventTypes - 要订阅的事件类型数组
 * @param {Function} handler - 事件处理函数
 * @returns {Promise<void>}
 */
async function setupEventSubscriber(eventBus, serviceName, sourceService, eventTypes, handler) {
  const exchangeName = createExchangeName(sourceService);
  const queueName = createQueueName(serviceName, `${sourceService}_events`);
  
  // 确保交换机存在
  await eventBus.assertExchange(exchangeName, 'topic');
  
  // 确保队列存在
  await eventBus.assertQueue(queueName, { durable: true });
  
  // 绑定队列到交换机，使用指定的事件类型作为路由键
  for (const eventType of eventTypes) {
    await eventBus.bindQueue(queueName, exchangeName, eventType);
  }
  
  // 开始消费消息
  await eventBus.consume(queueName, async (message, originalMessage) => {
    try {
      // 调用处理函数
      await handler(message, originalMessage.fields.routingKey);
    } catch (error) {
      eventBus.logger.error(`[EventSubscriber] 处理事件失败: ${originalMessage.fields.routingKey}`, error);
      throw error; // 重新抛出错误，让事件总线决定是否重新入队
    }
  });
}

/**
 * 创建服务间的事件桥接
 * 将一个服务的事件转发到另一个交换机
 * @param {EventBus} eventBus - 事件总线实例
 * @param {string} sourceExchange - 源交换机
 * @param {string} targetExchange - 目标交换机
 * @param {Array<string>} routingPatterns - 路由模式数组
 * @returns {Promise<void>}
 */
async function createEventBridge(eventBus, sourceExchange, targetExchange, routingPatterns) {
  // 确保两个交换机都存在
  await eventBus.assertExchange(sourceExchange, 'topic');
  await eventBus.assertExchange(targetExchange, 'topic');
  
  // 创建桥接队列
  const bridgeQueueName = `bridge.${sourceExchange}.to.${targetExchange}`;
  await eventBus.assertQueue(bridgeQueueName, { durable: true });
  
  // 绑定队列到源交换机
  for (const pattern of routingPatterns) {
    await eventBus.bindQueue(bridgeQueueName, sourceExchange, pattern);
  }
  
  // 消费队列并转发到目标交换机
  await eventBus.consume(bridgeQueueName, async (message, originalMessage) => {
    const routingKey = originalMessage.fields.routingKey;
    return eventBus.publish(targetExchange, routingKey, message);
  });
  
  eventBus.logger.info(`[EventBridge] 创建事件桥接: ${sourceExchange} -> ${targetExchange}`);
}

module.exports = {
  createEventBus,
  createExchangeName,
  createQueueName,
  setupEventPublisher,
  setupEventSubscriber,
  createEventBridge,
  eventTypes
};