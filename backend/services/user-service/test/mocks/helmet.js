/**
 * helmet 模拟模块
 */

const helmet = jest.fn().mockReturnValue((req, res, next) => next());

module.exports = helmet;
