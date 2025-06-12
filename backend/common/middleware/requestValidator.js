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
    .optional()
    .isEmail()
    .withMessage('请输入有效的邮箱地址'),
  body('phone')
    .optional()
    .matches(/^1[3-9]\d{9}$/)
    .withMessage('请输入有效的手机号码'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('姓名不能为空'),
  body('role')
    .isIn(['student', 'teacher', 'parent'])
    .withMessage('角色必须是学生、教师或家长'),
  // 自定义验证：确保至少提供邮箱或手机号之一
  body().custom((value, { req }) => {
    if (!req.body.email && !req.body.phone) {
      throw new Error('必须提供邮箱或手机号码');
    }
    return true;
  }),
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

// 邮箱或手机号登录验证规则
const emailPhoneLoginValidation = [
  body('identifier')
    .trim()
    .notEmpty()
    .withMessage('请输入邮箱或手机号')
    .custom((value) => {
      const isEmail = /^\S+@\S+\.\S+$/.test(value);
      const isPhone = /^1[3-9]\d{9}$/.test(value);
      if (!isEmail && !isPhone) {
        throw new Error('请输入有效的邮箱地址或手机号码');
      }
      return true;
    }),
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

// 修改: 通用 MongoDB ObjectId 路径参数验证规则 - 改为函数
const mongoIdParamValidation = (paramName = 'id') => [
  param(paramName).isMongoId().withMessage((value, { req, location, path }) => `路径参数 ${path} 必须是一个有效的 MongoDB ObjectId`)
];

// 新增: 分页查询参数验证
const paginationQueryValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('page 参数必须是大于0的整数').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit 参数必须是1到100之间的整数').toInt()
];

// 新增: 学生列表查询参数验证
const studentListQueryValidation = [
  query('search').optional().isString().trim().withMessage('search 参数必须是字符串'),
  query('class').optional().isString().trim().withMessage('class 参数必须是字符串') // Route param is 'class'
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

const recordMistakeValidationRules = () => [
  body('student').notEmpty().withMessage('Student ID is required.').isMongoId().withMessage('Invalid Student ID.'),
  body('subject').notEmpty().withMessage('Subject ID is required.').isMongoId().withMessage('Invalid Subject ID.'),
  body('question').trim().notEmpty().withMessage('Question content is required.'),
  body('answer').optional({ checkFalsy: true }).trim(),
  body('correctAnswer').trim().notEmpty().withMessage('Correct answer is required.'),
  body('analysis').optional({ checkFalsy: true }).trim(),
  body('tags').optional().isArray().withMessage('Tags must be an array.')
    .custom((tags) => tags.every(tag => typeof tag === 'string' && tag.trim() !== '')).withMessage('All tags must be non-empty strings.'),
  body('source').optional({ checkFalsy: true }).trim(),
];

const updateMistakeValidationRules = () => [
  param('id').isMongoId().withMessage('Invalid Mistake Record ID in URL parameter.'),
  body('student').optional().isMongoId().withMessage('Invalid Student ID format if provided.'),
  body('subject').optional().isMongoId().withMessage('Invalid Subject ID format if provided.'),
  body('question').optional().trim().notEmpty().withMessage('Question content cannot be empty if provided.'),
  body('answer').optional({ checkFalsy: true }).trim(),
  body('correctAnswer').optional().trim().notEmpty().withMessage('Correct answer cannot be empty if provided.'),
  body('analysis').optional({ checkFalsy: true }).trim(),
  body('tags').optional().isArray().withMessage('Tags must be an array if provided.')
    .custom((tags) => tags.every(tag => typeof tag === 'string' && tag.trim() !== '')).withMessage('All tags must be non-empty strings if provided.'),
  body('source').optional({ checkFalsy: true }).trim(),
  body('status').optional().trim().isIn(['unresolved', 'reviewing', 'resolved', 'archived']).withMessage('Invalid status value.'),
  body('date').optional().isISO8601().withMessage('Invalid date format if provided.').toDate(),
];

const recordClassPerformanceValidationRules = () => [
  body('student').notEmpty().withMessage('Student ID is required.').isMongoId().withMessage('Invalid Student ID.'),
  body('class').notEmpty().withMessage('Class ID is required.').isMongoId().withMessage('Invalid Class ID.'),
  body('subject').notEmpty().withMessage('Subject ID is required.').isMongoId().withMessage('Invalid Subject ID.'),
  body('type')
    .trim()
    .notEmpty().withMessage('Performance type is required.')
    .isIn(['participation', 'behavior', 'attendance', 'quiz', 'interaction', 'other']).withMessage('Invalid performance type.'),
  body('comments').trim().notEmpty().withMessage('Comments are required.'), // Changed from description
  body('score').optional().isFloat({ min: -5, max: 5 }).withMessage('Score must be a number between -5 and 5, if provided.'),
  body('date').notEmpty().withMessage('Date is required.').isISO8601().withMessage('Invalid date format.').toDate() // Made required
];

const updateClassPerformanceValidationRules = () => [
  param('id').isMongoId().withMessage('Invalid Performance ID in URL parameter.'),
  body('type')
    .optional()
    .trim()
    .notEmpty().withMessage('Performance type cannot be empty if provided.')
    .isIn(['participation', 'behavior', 'attendance', 'quiz', 'interaction', 'other']).withMessage('Invalid performance type.'),
  body('comments').optional().trim().notEmpty().withMessage('Comments cannot be empty if provided.'), // Changed from description
  body('score').optional().isFloat({ min: -5, max: 5 }).withMessage('Score must be a number between -5 and 5, if provided.'),
  body('date').optional().isISO8601().withMessage('Invalid date format.').toDate(),
  body('subject').optional().isMongoId().withMessage('Invalid Subject ID if provided.')
];

const resourceSubjectEnum = ['语文', '数学', '英语', '科学', '社会', '音乐', '美术', '体育', '综合'];
const resourceGradeEnum = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'];
const resourceTypeEnum = ['教案', '课件', '习题', '视频', '音频', '图片', '文档', '其他'];

const createResourceValidationRules = () => [
  body('title').trim().notEmpty().withMessage('资源标题不能为空.'),
  body('subject').notEmpty().withMessage('学科不能为空.').isIn(resourceSubjectEnum).withMessage('无效的学科.'),
  body('grade').notEmpty().withMessage('年级不能为空.').isIn(resourceGradeEnum).withMessage('无效的年级.'),
  body('type').notEmpty().withMessage('资源类型不能为空.').isIn(resourceTypeEnum).withMessage('无效的资源类型.'),
  body('description').optional().trim(),
  body('tags').optional().isString().withMessage('标签必须是逗号分隔的字符串.')
    .customSanitizer(value => value ? value.split(',').map(tag => tag.trim()) : [])
];

const updateResourceValidationRules = () => [
  param('id').isMongoId().withMessage('无效的资源ID.'),
  body('title').optional().trim().notEmpty().withMessage('资源标题不能为空.'),
  body('subject').optional().notEmpty().withMessage('学科不能为空.').isIn(resourceSubjectEnum).withMessage('无效的学科.'),
  body('grade').optional().notEmpty().withMessage('年级不能为空.').isIn(resourceGradeEnum).withMessage('无效的年级.'),
  body('type').optional().notEmpty().withMessage('资源类型不能为空.').isIn(resourceTypeEnum).withMessage('无效的资源类型.'),
  body('description').optional().trim(),
  body('tags').optional().isString().withMessage('标签必须是逗号分隔的字符串.')
    .customSanitizer(value => value ? value.split(',').map(tag => tag.trim()) : [])
];

const createResourceReviewValidationRules = () => [
  param('resourceId').isMongoId().withMessage('无效的资源ID参数.'),
  body('rating').notEmpty().withMessage('评分不能为空.')
    .isNumeric().withMessage('评分必须是数字.')
    .isInt({ min: 1, max: 5 }).withMessage('评分必须在1到5之间.'),
  body('comment').optional().trim(),
  body('isRecommended').optional().isBoolean().withMessage('isRecommended必须是布尔值.')
];

const collectResourceValidationRules = () => [
  body('resourceId').notEmpty().withMessage('资源ID不能为空.').isMongoId().withMessage('无效的资源ID.'),
  body('collectionName').optional().trim().isString().withMessage('收藏夹名称必须是字符串.'),
  body('notes').optional().trim().isString().withMessage('备注必须是字符串.')
];

const updateCollectionValidationRules = () => [
  param('id').isMongoId().withMessage('无效的收藏记录ID.'),
  body('collectionName').optional().trim().isString().withMessage('收藏夹名称必须是字符串.'),
  body('notes').optional().trim().isString().withMessage('备注必须是字符串.')
];

const submitOrUpdateReviewValidationRules = () => [
  body('resource').notEmpty().withMessage('资源ID不能为空.').isMongoId().withMessage('无效的资源ID.'),
  body('rating').notEmpty().withMessage('评分不能为空.')
    .isNumeric().withMessage('评分必须是数字.')
    .isInt({ min: 1, max: 5 }).withMessage('评分必须在1到5之间.'),
  body('comment').optional().trim(),
  body('isRecommended').optional().isBoolean().withMessage('isRecommended必须是布尔值.')
];

const getRecommendationsQueryValidation = () => [
  query('subject').optional().isString().trim(),
  query('grade').optional().isString().trim(),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit必须是1到50之间的整数.').toInt()
];

module.exports = {
  validate,
  sanitizeInput,
  registerValidation,
  loginValidation,
  emailPhoneLoginValidation,
  changePasswordValidation,
  updateUserValidation,
  mongoIdParamValidation,
  paginationQueryValidation,
  studentListQueryValidation,
  courseValidation,
  resourceValidation,
  recordMistakeValidationRules,
  updateMistakeValidationRules,
  recordClassPerformanceValidationRules,
  updateClassPerformanceValidationRules,
  createResourceValidationRules,
  updateResourceValidationRules,
  createResourceReviewValidationRules,
  collectResourceValidationRules,
  updateCollectionValidationRules,
  submitOrUpdateReviewValidationRules,
  getRecommendationsQueryValidation
}; 