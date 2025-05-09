/**
 * cors 模拟模块
 */

const cors = jest.fn().mockReturnValue((req, res, next) => next());

module.exports = cors;
