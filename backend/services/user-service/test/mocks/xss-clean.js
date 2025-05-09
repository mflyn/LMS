/**
 * xss-clean 模拟模块
 */

const xss = jest.fn().mockReturnValue((req, res, next) => next());

module.exports = xss;
