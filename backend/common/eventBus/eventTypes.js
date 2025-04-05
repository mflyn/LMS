/**
 * 事件类型定义
 * 统一定义系统中所有微服务使用的事件类型
 * 确保事件命名和结构的一致性
 */

// 用户服务事件
const USER_EVENTS = {
  // 用户账户相关事件
  CREATED: 'user.created',
  UPDATED: 'user.updated',
  DELETED: 'user.deleted',
  PASSWORD_CHANGED: 'user.password.changed',
  ROLE_CHANGED: 'user.role.changed',
  
  // 用户认证相关事件
  LOGGED_IN: 'user.logged_in',
  LOGGED_OUT: 'user.logged_out',
  LOGIN_FAILED: 'user.login.failed',
  PASSWORD_RESET_REQUESTED: 'user.password.reset.requested',
  PASSWORD_RESET_COMPLETED: 'user.password.reset.completed'
};

// 作业服务事件
const HOMEWORK_EVENTS = {
  // 作业管理相关事件
  CREATED: 'homework.created',
  UPDATED: 'homework.updated',
  DELETED: 'homework.deleted',
  ASSIGNED: 'homework.assigned',
  
  // 作业提交相关事件
  SUBMITTED: 'homework.submitted',
  GRADED: 'homework.graded',
  RETURNED: 'homework.returned',
  OVERDUE: 'homework.overdue'
};

// 通知服务事件
const NOTIFICATION_EVENTS = {
  // 通知管理相关事件
  CREATED: 'notification.created',
  READ: 'notification.read',
  DELETED: 'notification.deleted',
  
  // 通知发送相关事件
  EMAIL_SENT: 'notification.email.sent',
  SMS_SENT: 'notification.sms.sent',
  PUSH_SENT: 'notification.push.sent',
  DELIVERY_FAILED: 'notification.delivery.failed'
};

// 资源服务事件
const RESOURCE_EVENTS = {
  // 资源管理相关事件
  CREATED: 'resource.created',
  UPDATED: 'resource.updated',
  DELETED: 'resource.deleted',
  
  // 资源使用相关事件
  VIEWED: 'resource.viewed',
  DOWNLOADED: 'resource.downloaded',
  RATED: 'resource.rated',
  RECOMMENDED: 'resource.recommended'
};

// 数据服务事件
const DATA_EVENTS = {
  // 成绩相关事件
  SCORE_RECORDED: 'data.score.recorded',
  SCORE_UPDATED: 'data.score.updated',
  SCORE_DELETED: 'data.score.deleted',
  
  // 考试相关事件
  EXAM_CREATED: 'data.exam.created',
  EXAM_UPDATED: 'data.exam.updated',
  EXAM_DELETED: 'data.exam.deleted',
  EXAM_RESULTS_PUBLISHED: 'data.exam.results.published'
};

// 进度服务事件
const PROGRESS_EVENTS = {
  // 学习进度相关事件
  UPDATED: 'progress.updated',
  MILESTONE_REACHED: 'progress.milestone.reached',
  GOAL_ACHIEVED: 'progress.goal.achieved',
  
  // 学习计划相关事件
  PLAN_CREATED: 'progress.plan.created',
  PLAN_UPDATED: 'progress.plan.updated',
  PLAN_COMPLETED: 'progress.plan.completed'
};

// 互动服务事件
const INTERACTION_EVENTS = {
  // 评论相关事件
  COMMENT_CREATED: 'interaction.comment.created',
  COMMENT_UPDATED: 'interaction.comment.updated',
  COMMENT_DELETED: 'interaction.comment.deleted',
  
  // 消息相关事件
  MESSAGE_SENT: 'interaction.message.sent',
  MESSAGE_READ: 'interaction.message.read',
  
  // 会议相关事件
  MEETING_SCHEDULED: 'interaction.meeting.scheduled',
  MEETING_UPDATED: 'interaction.meeting.updated',
  MEETING_CANCELLED: 'interaction.meeting.cancelled'
};

// 分析服务事件
const ANALYTICS_EVENTS = {
  // 报告相关事件
  REPORT_GENERATED: 'analytics.report.generated',
  INSIGHT_DISCOVERED: 'analytics.insight.discovered',
  
  // 数据分析相关事件
  DATA_PROCESSED: 'analytics.data.processed',
  TREND_DETECTED: 'analytics.trend.detected',
  ALERT_TRIGGERED: 'analytics.alert.triggered'
};

// 系统事件
const SYSTEM_EVENTS = {
  // 服务健康相关事件
  SERVICE_STARTED: 'system.service.started',
  SERVICE_STOPPED: 'system.service.stopped',
  SERVICE_ERROR: 'system.service.error',
  
  // 系统维护相关事件
  MAINTENANCE_STARTED: 'system.maintenance.started',
  MAINTENANCE_COMPLETED: 'system.maintenance.completed',
  
  // 数据库相关事件
  DATABASE_BACKUP_STARTED: 'system.database.backup.started',
  DATABASE_BACKUP_COMPLETED: 'system.database.backup.completed',
  DATABASE_BACKUP_FAILED: 'system.database.backup.failed'
};

module.exports = {
  USER_EVENTS,
  HOMEWORK_EVENTS,
  NOTIFICATION_EVENTS,
  RESOURCE_EVENTS,
  DATA_EVENTS,
  PROGRESS_EVENTS,
  INTERACTION_EVENTS,
  ANALYTICS_EVENTS,
  SYSTEM_EVENTS
};