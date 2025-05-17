const MEETING_STATUS = Object.freeze({
  PENDING: '待确认',
  CONFIRMED: '已确认',
  CANCELLED: '已取消',
  COMPLETED: '已完成'
});

const MEETING_TYPES = Object.freeze({
  ONLINE: '线上',
  OFFLINE: '线下'
});

module.exports = {
  MEETING_STATUS,
  MEETING_TYPES
}; 