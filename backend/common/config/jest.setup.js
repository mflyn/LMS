/**
 * Jest测试全局设置文件
 * 在每个测试文件执行前运行
 */

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // 测试时只记录错误日志

// 增加测试超时时间
jest.setTimeout(10000);

// 全局模拟对象
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

// 全局模拟
global.mockLogger = mockLogger;

// 在所有测试完成后清理
afterAll(() => {
  jest.clearAllMocks();
});

// 在每个测试后清理
afterEach(() => {
  jest.clearAllTimers();
});