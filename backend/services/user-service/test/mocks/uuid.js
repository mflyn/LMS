/**
 * uuid 模拟模块
 */

const uuid = {
  v4: jest.fn().mockReturnValue('00000000-0000-0000-0000-000000000000')
};

module.exports = uuid;
