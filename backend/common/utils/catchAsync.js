// 捕获异步中间件错误并传递给 next
module.exports = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
}; 