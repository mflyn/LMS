/**
 * amqplib 模拟模块
 */

const amqplib = {
  connect: jest.fn().mockResolvedValue({
    createChannel: jest.fn().mockResolvedValue({
      assertQueue: jest.fn().mockResolvedValue({}),
      assertExchange: jest.fn().mockResolvedValue({}),
      bindQueue: jest.fn().mockResolvedValue({}),
      publish: jest.fn(),
      sendToQueue: jest.fn(),
      consume: jest.fn().mockImplementation((queue, callback) => {
        // 模拟消息
        const message = {
          content: Buffer.from(JSON.stringify({ test: 'message' })),
          fields: { routingKey: 'test.route' },
          properties: { correlationId: '123' }
        };
        callback(message);
        return { consumerTag: 'test-consumer' };
      }),
      ack: jest.fn(),
      nack: jest.fn(),
      prefetch: jest.fn(),
      close: jest.fn().mockResolvedValue({}),
      cancel: jest.fn().mockResolvedValue({})
    }),
    close: jest.fn().mockResolvedValue({})
  })
};

module.exports = amqplib;
