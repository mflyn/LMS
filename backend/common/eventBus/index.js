/**
 * 事件总线模块索引文件
 * 导出所有事件总线相关的组件和工具
 */

const EventBus = require('./eventBus');
const eventTypes = require('./eventTypes');
const eventBusFactory = require('./eventBusFactory');

module.exports = {
  EventBus,
  eventTypes,
  ...eventBusFactory
};