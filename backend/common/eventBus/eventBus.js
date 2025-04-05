/**
 * 统一事件总线模块
 * 为所有微服务提供统一的事件发布/订阅机制
 * 基于RabbitMQ实现可靠的消息传递
 */

const amqp = require('amqplib');
const { v4: uuidv4 } = require('uuid');

class EventBus {
  constructor(config = {}) {
    this.connection = null;
    this.channel = null;
    this.connected = false;
    this.connecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = config.maxReconnectAttempts || 10;
    this.reconnectInterval = config.reconnectInterval || 5000;
    this.serviceName = config.serviceName || 'unknown-service';
    this.logger = config.logger || console;
    this.url = config.url || process.env.RABBITMQ_URL || 'amqp://localhost';
    this.exchanges = new Map();
    this.queues = new Map();
    this.consumers = new Map();
    this.defaultExchangeType = 'topic';
  }

  /**
   * 连接到RabbitMQ服务器
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.connected || this.connecting) return;

    this.connecting = true;
    try {
      this.logger.info(`[EventBus] 正在连接到RabbitMQ: ${this.url}`);
      this.connection = await amqp.connect(this.url);
      this.channel = await this.connection.createChannel();
      this.connected = true;
      this.connecting = false;
      this.reconnectAttempts = 0;

      this.logger.info(`[EventBus] RabbitMQ连接成功 (服务: ${this.serviceName})`);

      // 设置连接关闭和错误处理
      this.connection.on('close', () => this.handleDisconnect('连接关闭'));
      this.connection.on('error', (err) => this.handleDisconnect(`连接错误: ${err.message}`));
      
      // 重新绑定之前的交换机和队列
      await this.rebindExchangesAndQueues();
    } catch (error) {
      this.connected = false;
      this.connecting = false;
      this.logger.error(`[EventBus] RabbitMQ连接失败: ${error.message}`);
      this.handleDisconnect(`连接失败: ${error.message}`);
    }
  }

  /**
   * 处理断开连接情况
   * @param {string} reason - 断开连接的原因
   * @private
   */
  handleDisconnect(reason) {
    if (!this.connected) return;

    this.connected = false;
    this.logger.warn(`[EventBus] RabbitMQ连接断开: ${reason}`);

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectInterval * Math.min(this.reconnectAttempts, 10);
      
      this.logger.info(`[EventBus] 尝试重新连接 (${this.reconnectAttempts}/${this.maxReconnectAttempts}) 将在 ${delay}ms 后进行`);
      
      setTimeout(() => this.connect(), delay);
    } else {
      this.logger.error(`[EventBus] 达到最大重连次数 (${this.maxReconnectAttempts})，停止重连`);
    }
  }

  /**
   * 重新绑定之前的交换机和队列
   * @private
   */
  async rebindExchangesAndQueues() {
    // 重新声明交换机
    for (const [exchangeName, exchangeType] of this.exchanges.entries()) {
      await this.assertExchange(exchangeName, exchangeType);
    }

    // 重新声明队列和绑定
    for (const [queueName, bindings] of this.queues.entries()) {
      await this.assertQueue(queueName);
      
      for (const binding of bindings) {
        await this.bindQueue(queueName, binding.exchange, binding.routingKey);
      }
    }

    // 重新启动消费者
    for (const [queueName, consumer] of this.consumers.entries()) {
      await this.consume(queueName, consumer.callback, consumer.options);
    }
  }

  /**
   * 声明交换机
   * @param {string} exchangeName - 交换机名称
   * @param {string} type - 交换机类型 (direct, topic, fanout, headers)
   * @returns {Promise<void>}
   */
  async assertExchange(exchangeName, type = this.defaultExchangeType) {
    if (!this.connected) await this.connect();
    
    try {
      await this.channel.assertExchange(exchangeName, type, { durable: true });
      this.exchanges.set(exchangeName, type);
      this.logger.debug(`[EventBus] 交换机声明成功: ${exchangeName} (类型: ${type})`);
    } catch (error) {
      this.logger.error(`[EventBus] 交换机声明失败: ${exchangeName}`, error);
      throw error;
    }
  }

  /**
   * 声明队列
   * @param {string} queueName - 队列名称
   * @param {Object} options - 队列选项
   * @returns {Promise<void>}
   */
  async assertQueue(queueName, options = { durable: true }) {
    if (!this.connected) await this.connect();
    
    try {
      await this.channel.assertQueue(queueName, options);
      if (!this.queues.has(queueName)) {
        this.queues.set(queueName, []);
      }
      this.logger.debug(`[EventBus] 队列声明成功: ${queueName}`);
    } catch (error) {
      this.logger.error(`[EventBus] 队列声明失败: ${queueName}`, error);
      throw error;
    }
  }

  /**
   * 绑定队列到交换机
   * @param {string} queueName - 队列名称
   * @param {string} exchangeName - 交换机名称
   * @param {string} routingKey - 路由键
   * @returns {Promise<void>}
   */
  async bindQueue(queueName, exchangeName, routingKey) {
    if (!this.connected) await this.connect();
    
    try {
      await this.channel.bindQueue(queueName, exchangeName, routingKey);
      
      // 记录绑定关系
      const bindings = this.queues.get(queueName) || [];
      bindings.push({ exchange: exchangeName, routingKey });
      this.queues.set(queueName, bindings);
      
      this.logger.debug(`[EventBus] 队列绑定成功: ${queueName} -> ${exchangeName} (${routingKey})`);
    } catch (error) {
      this.logger.error(`[EventBus] 队列绑定失败: ${queueName} -> ${exchangeName}`, error);
      throw error;
    }
  }

  /**
   * 发布消息到交换机
   * @param {string} exchangeName - 交换机名称
   * @param {string} routingKey - 路由键
   * @param {Object} message - 消息内容
   * @param {Object} options - 发布选项
   * @returns {Promise<boolean>} - 发布是否成功
   */
  async publish(exchangeName, routingKey, message, options = {}) {
    if (!this.connected) await this.connect();
    
    try {
      // 确保交换机存在
      if (!this.exchanges.has(exchangeName)) {
        await this.assertExchange(exchangeName);
      }
      
      // 添加元数据
      const enhancedMessage = {
        ...message,
        _metadata: {
          messageId: options.messageId || uuidv4(),
          timestamp: options.timestamp || new Date().toISOString(),
          publisher: this.serviceName,
          routingKey
        }
      };
      
      // 发布消息
      const publishOptions = {
        persistent: true,  // 消息持久化
        ...options
      };
      
      const result = this.channel.publish(
        exchangeName,
        routingKey,
        Buffer.from(JSON.stringify(enhancedMessage)),
        publishOptions
      );
      
      this.logger.debug(`[EventBus] 消息发布: ${exchangeName} -> ${routingKey}`, {
        messageId: enhancedMessage._metadata.messageId,
        service: this.serviceName
      });
      
      return result;
    } catch (error) {
      this.logger.error(`[EventBus] 消息发布失败: ${exchangeName} -> ${routingKey}`, error);
      return false;
    }
  }

  /**
   * 消费队列消息
   * @param {string} queueName - 队列名称
   * @param {Function} callback - 消息处理回调函数
   * @param {Object} options - 消费选项
   * @returns {Promise<void>}
   */
  async consume(queueName, callback, options = {}) {
    if (!this.connected) await this.connect();
    
    try {
      // 确保队列存在
      await this.assertQueue(queueName);
      
      // 设置消费者
      await this.channel.consume(queueName, async (msg) => {
        if (!msg) return;
        
        try {
          const content = JSON.parse(msg.content.toString());
          
          this.logger.debug(`[EventBus] 收到消息: ${queueName}`, {
            messageId: content._metadata?.messageId,
            routingKey: msg.fields.routingKey,
            service: this.serviceName
          });
          
          // 调用回调处理消息
          await callback(content, msg);
          
          // 确认消息已处理
          this.channel.ack(msg);
        } catch (error) {
          this.logger.error(`[EventBus] 处理消息失败: ${queueName}`, error);
          
          // 根据配置决定是否重新入队
          if (options.requeue !== false) {
            this.channel.nack(msg, false, true);
          } else {
            this.channel.nack(msg, false, false);
          }
        }
      }, options);
      
      // 记录消费者
      this.consumers.set(queueName, { callback, options });
      
      this.logger.info(`[EventBus] 开始消费队列: ${queueName}`);
    } catch (error) {
      this.logger.error(`[EventBus] 设置消费者失败: ${queueName}`, error);
      throw error;
    }
  }

  /**
   * 关闭连接
   * @returns {Promise<void>}
   */
  async close() {
    if (!this.connected) return;
    
    try {
      await this.channel.close();
      await this.connection.close();
      this.connected = false;
      this.logger.info('[EventBus] RabbitMQ连接已关闭');
    } catch (error) {
      this.logger.error('[EventBus] 关闭RabbitMQ连接失败', error);
    }
  }
}

module.exports = EventBus;