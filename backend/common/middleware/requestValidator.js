const { body, query, param, validationResult } = require('express-validator');
const sanitizeHtml = require('sanitize-html');
const { ValidationError } = require('./errorTypes'); // Assuming errorTypes.js is in the same directory

// 通用验证中间件
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // 将详细错误信息传递给 ValidationError，它会处理 status 和 message
    return next(new ValidationError(errors.array(), '请求参数验证失败')); 
  }
  next();
};

// 用户输入清理中间件
const sanitizeInput = (req, res, next) => {
  // 清理请求体
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeHtml(req.body[key], {
          allowedTags: [],
          allowedAttributes: {}
        });
      }
    });
  }

  // 清理查询参数
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeHtml(req.query[key], {
          allowedTags: [],
          allowedAttributes: {}
        });
      }
    });
  }

  // 清理URL参数
  if (req.params) {
    Object.keys(req.params).forEach(key => {
      if (typeof req.params[key] === 'string') {
        req.params[key] = sanitizeHtml(req.params[key], {
          allowedTags: [],
          allowedAttributes: {}
        });
      }
    });
  }

  next();
};

// 用户注册验证规则
const registerValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('用户名长度必须在3-20个字符之间')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('用户名只能包含字母、数字和下划线'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('密码长度至少为8个字符'),
  body('email')
    .isEmail()
    .withMessage('请输入有效的邮箱地址'),
  body('role')
    .isIn(['student', 'teacher', 'parent'])
    .withMessage('角色必须是学生、教师或家长'),
  body('firstName').optional().trim().isAlpha('en-US', {ignore: ' '}).withMessage('名字只能包含字母'),
  body('lastName').optional().trim().isAlpha('en-US', {ignore: ' '}).withMessage('姓氏只能包含字母')
];

// 用户登录验证规则
const loginValidation = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('用户名不能为空'),
  body('password')
    .notEmpty()
    .withMessage('密码不能为空')
];

// 修改密码验证规则
const changePasswordValidation = [
  body('oldPassword')
    .notEmpty().withMessage('旧密码不能为空'),
  body('newPassword')
    .notEmpty().withMessage('新密码不能为空')
    .isLength({ min: 8 }).withMessage('新密码长度至少为8个字符')
];

// 更新用户信息验证规则
const updateUserValidation = [
  body('email')
    .optional()
    .isEmail()
    .withMessage('请输入有效的邮箱地址'),
  // Note: email uniqueness should be checked at the service/controller layer after validation
  body('firstName')
    .optional()
    .trim()
    .isAlpha('en-US', { ignore: ' ' })
    .withMessage('名字只能包含字母'),
  body('lastName')
    .optional()
    .trim()
    .isAlpha('en-US', { ignore: ' ' })
    .withMessage('姓氏只能包含字母'),
  body('avatar')
    .optional()
    .isURL()
    .withMessage('头像必须是一个有效的URL'),
  body('contactNumber')
    .optional()
    .trim()
    // .isMobilePhone('any', { strictMode: false }) // Example, can be specific like 'zh-CN'
    // .withMessage('请输入有效的手机号码')
    // Using a simpler string check for now, as isMobilePhone can be restrictive or require specific libraries
    .isLength({ min: 7, max: 15 }).withMessage('联系电话长度应在7-15位之间') 
];

// 课程创建验证规则
const courseValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('课程名称不能为空'),
  body('grade')
    .trim()
    .notEmpty()
    .withMessage('年级不能为空'),
  body('description')
    .trim()
    .isLength({ max: 500 })
    .withMessage('描述不能超过500个字符')
];

// 资源上传验证规则
const resourceValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('资源标题不能为空'),
  body('type')
    .isIn(['textbook', 'exercise', 'video'])
    .withMessage('资源类型必须是教材、练习题或视频'),
  body('description')
    .trim()
    .isLength({ max: 500 })
    .withMessage('描述不能超过500个字符')
];

module.exports = {
  validate,
  sanitizeInput,
  registerValidation,
  loginValidation,
  changePasswordValidation,
  updateUserValidation,
  courseValidation,
  resourceValidation
}; 