/**
 * bcrypt 模拟模块
 */

const bcrypt = {
  hash: jest.fn().mockImplementation((password, saltRounds) => {
    return Promise.resolve(`hashed_${password}`);
  }),
  
  compare: jest.fn().mockImplementation((password, hash) => {
    // 如果哈希值以 "hashed_" 开头，并且后面跟着的是密码，则返回 true
    return Promise.resolve(hash === `hashed_${password}`);
  }),
  
  genSalt: jest.fn().mockImplementation((saltRounds) => {
    return Promise.resolve('mock_salt');
  })
};

module.exports = bcrypt;
