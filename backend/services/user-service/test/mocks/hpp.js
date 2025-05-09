/**
 * hpp 模拟模块
 */

const hpp = jest.fn().mockReturnValue((req, res, next) => next());

module.exports = hpp;
