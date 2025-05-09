/**
 * winston-daily-rotate-file 模拟模块
 */

class DailyRotateFile {
  constructor(options) {
    this.options = options;
  }

  on(event, callback) {
    return this;
  }
}

module.exports = DailyRotateFile;
