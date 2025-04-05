/**
 * 路由模板文件
 * 展示如何正确使用错误处理和日志记录功能
 */

const express = require('express');
const router = express.Router();

// 导入错误处理工具
const { 
  catchAsync, 
  handleDatabaseError, 
  requestTracker 
} = require('../middleware/errorHandler');

// 导入错误类型
const { 
  NotFoundError, 
  BadRequestError, 
  ForbiddenError, 
  ValidationError 
} = require('../middleware/errorTypes');

/**
 * 示例中间件：权限检查
 */
const checkPermission = (requiredRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ForbiddenError('用户未认证'));
    }
    
    if (req.user.role !== requiredRole) {
      return next(new ForbiddenError(`需要 ${requiredRole} 权限`));
    }
    
    next();
  };
};

/**
 * 路由示例：获取资源列表
 * 展示如何使用catchAsync包装异步路由处理函数
 */
router.get('/', requestTracker, catchAsync(async (req, res) => {
  // 记录审计日志示例
  if (req.app.locals.auditLog) {
    req.app.locals.auditLog('查看资源列表', req.user ? req.user.id : 'anonymous', {
      filters: req.query
    });
  }
  
  // 模拟数据库操作
  const items = [{ id: 1, name: '示例资源' }];
  
  // 记录详细日志
  if (req.app.locals.logger) {
    req.app.locals.logger.info('获取资源列表成功', {
      requestId: req.requestId,
      count: items.length,
      filters: req.query
    });
  }
  
  res.json({ success: true, data: items });
}));

/**
 * 路由示例：获取单个资源
 * 展示如何抛出自定义错误
 */
router.get('/:id', requestTracker, catchAsync(async (req, res) => {
  const id = req.params.id;
  
  // 参数验证示例
  if (!id || isNaN(parseInt(id))) {
    throw new BadRequestError('无效的资源ID');
  }
  
  // 模拟数据库查询
  const item = id === '1' ? { id: 1, name: '示例资源' } : null;
  
  // 资源不存在错误示例
  if (!item) {
    throw new NotFoundError(`找不到ID为 ${id} 的资源`);
  }
  
  // 记录详细日志
  if (req.app.locals.logger) {
    req.app.locals.logger.info(`获取资源 ${id} 成功`, {
      requestId: req.requestId,
      resourceId: id
    });
  }
  
  res.json({ success: true, data: item });
}));

/**
 * 路由示例：创建资源
 * 展示如何处理验证错误
 */
router.post('/', requestTracker, catchAsync(async (req, res) => {
  const { name, description } = req.body;
  
  // 参数验证示例
  const errors = {};
  if (!name) errors.name = '名称不能为空';
  if (!description) errors.description = '描述不能为空';
  
  if (Object.keys(errors).length > 0) {
    throw new ValidationError('数据验证失败', errors);
  }
  
  // 模拟数据库操作
  const newItem = { id: 2, name, description };
  
  // 记录审计日志
  if (req.app.locals.auditLog) {
    req.app.locals.auditLog('创建资源', req.user ? req.user.id : 'anonymous', {
      resourceId: newItem.id,
      resourceName: name
    });
  }
  
  res.status(201).json({ success: true, data: newItem });
}));

/**
 * 路由示例：更新资源
 * 展示如何处理数据库错误
 */
router.put('/:id', requestTracker, checkPermission('admin'), catchAsync(async (req, res) => {
  const id = req.params.id;
  
  try {
    // 模拟数据库操作
    if (id === '999') {
      // 模拟数据库错误
      const dbError = new Error('数据库连接失败');
      dbError.name = 'MongoError';
      throw dbError;
    }
    
    // 模拟资源不存在
    if (id !== '1' && id !== '2') {
      throw new NotFoundError(`找不到ID为 ${id} 的资源`);
    }
    
    const updatedItem = { id: parseInt(id), ...req.body };
    
    // 记录审计日志
    if (req.app.locals.auditLog) {
      req.app.locals.auditLog('更新资源', req.user.id, {
        resourceId: id,
        changes: req.body
      });
    }
    
    res.json({ success: true, data: updatedItem });
  } catch (err) {
    // 处理数据库错误
    if (err.name === 'MongoError') {
      throw handleDatabaseError(err);
    }
    throw err;
  }
}));

/**
 * 路由示例：删除资源
 * 展示完整的错误处理流程
 */
router.delete('/:id', requestTracker, checkPermission('admin'), catchAsync(async (req, res) => {
  const id = req.params.id;
  
  // 模拟资源不存在
  if (id !== '1' && id !== '2') {
    throw new NotFoundError(`找不到ID为 ${id} 的资源`);
  }
  
  // 记录详细日志
  if (req.app.locals.logger) {
    req.app.locals.logger.info(`删除资源 ${id}`, {
      requestId: req.requestId,
      resourceId: id,
      deletedBy: req.user.id
    });
  }
  
  // 记录审计日志
  if (req.app.locals.auditLog) {
    req.app.locals.auditLog('删除资源', req.user.id, {
      resourceId: id
    });
  }
  
  res.json({ success: true, message: '资源已删除' });
}));

module.exports = router;