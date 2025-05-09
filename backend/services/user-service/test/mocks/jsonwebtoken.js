/**
 * jsonwebtoken 模拟模块
 */

const jwt = {
  sign: jest.fn().mockImplementation((payload, secret, options) => {
    return `mock_token_for_${payload.username || payload.id}`;
  }),
  
  verify: jest.fn().mockImplementation((token, secret) => {
    // 从令牌中提取用户名或ID
    const matches = token.match(/mock_token_for_(.*)/);
    if (matches && matches[1]) {
      return {
        id: matches[1],
        username: matches[1],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      };
    }
    throw new Error('Invalid token');
  })
};

module.exports = jwt;
