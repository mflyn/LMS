/**
 * express-rate-limit 模拟模块
 */

const rateLimit = jest.fn().mockReturnValue((req, res, next) => next());

module.exports = rateLimit;
