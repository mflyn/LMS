/**
 * @deprecated This module is deprecated. Please use '../config/logger' instead.
 * This file is kept for backward compatibility and will be removed in a future version.
 *
 * 此模块已废弃。请使用 '../config/logger' 代替。
 * 此文件仅为保持向后兼容性而保留,将在未来版本中移除。
 */

// 重新导出 config/logger 的内容以保持向后兼容
const configLogger = require('../config/logger');

// 在第一次导入时显示废弃警告
if (process.env.NODE_ENV !== 'test') {
  console.warn('\x1b[33m%s\x1b[0m',
    'WARNING: common/utils/logger is deprecated. Please use common/config/logger instead.'
  );
}

module.exports = configLogger;