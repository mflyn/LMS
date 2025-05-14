// 增加测试超时时间
jest.setTimeout(30000);

// 在所有测试之前运行
beforeAll(async () => {
  console.log('开始集成测试...');
});

// 在所有测试之后运行
afterAll(async () => {
  console.log('集成测试完成');
});
