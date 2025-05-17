const { body, param, query } = require('express-validator');
const mongoose = require('mongoose');

const isValidMongoId = (id) => mongoose.Types.ObjectId.isValid(id);

const mongoIdParamValidation = (fieldName = 'id') => [
  param(fieldName).custom((value) => {
    if (!isValidMongoId(value)) {
      throw new Error(`${fieldName} 必须是有效的 MongoDB ObjectId`);
    }
    return true;
  }),
];

const gradeQueryValidationRules = () => [
  query('subject').optional().custom(isValidMongoId).withMessage('科目ID必须是有效的 ObjectId'),
  query('type').optional().isIn(['exam', 'quiz', 'homework', 'daily']).withMessage('无效的成绩类型'),
  query('dateFrom').optional().isISO8601().toDate().withMessage('dateFrom 必须是有效的日期格式'),
  query('dateTo').optional().isISO8601().toDate().withMessage('dateTo 必须是有效的日期格式'),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('limit 必须是1-100之间的整数'),
  query('page').optional().isInt({ min: 1 }).toInt().withMessage('page 必须是大于0的整数'),
  query('sortBy').optional().isIn(['date', 'score', 'percentage', 'createdAt']).withMessage('无效的排序字段'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('无效的排序顺序'),
];

const createGradeValidationRules = () => [
  body('student').notEmpty().withMessage('学生ID不能为空').custom(isValidMongoId).withMessage('学生ID必须是有效的 ObjectId'),
  body('subject').notEmpty().withMessage('科目ID不能为空').custom(isValidMongoId).withMessage('科目ID必须是有效的 ObjectId'),
  body('class').notEmpty().withMessage('班级ID不能为空').custom(isValidMongoId).withMessage('班级ID必须是有效的 ObjectId'),
  body('type').notEmpty().withMessage('成绩类型不能为空').isIn(['exam', 'quiz', 'homework', 'daily']).withMessage('无效的成绩类型'),
  body('score').notEmpty().withMessage('分数不能为空').isFloat({ min: 0 }).withMessage('分数必须是大于等于0的数字'),
  body('totalScore').notEmpty().withMessage('总分不能为空').isFloat({ gt: 0 }).withMessage('总分必须是大于0的数字')
    .custom((value, { req }) => {
      if (parseFloat(req.body.score) > parseFloat(value)) {
        throw new Error('得分不能超过总分');
      }
      return true;
    }),
  body('date').notEmpty().withMessage('日期不能为空').isISO8601().toDate().withMessage('日期必须是有效的日期格式'),
  body('comments').optional().isString().trim(),
  // recordedBy will be set from req.user.id in the controller/service
];

const batchCreateGradeValidationRules = () => [
  body().isArray({ min: 1 }).withMessage('请求体必须是一个包含至少一个成绩对象的数组'),
  body('*.student').notEmpty().withMessage('每个成绩记录的学生ID不能为空').custom(isValidMongoId).withMessage('学生ID必须是有效的 ObjectId'),
  body('*.subject').notEmpty().withMessage('每个成绩记录的科目ID不能为空').custom(isValidMongoId).withMessage('科目ID必须是有效的 ObjectId'),
  body('*.class').notEmpty().withMessage('每个成绩记录的班级ID不能为空').custom(isValidMongoId).withMessage('班级ID必须是有效的 ObjectId'),
  body('*.type').notEmpty().withMessage('每个成绩记录的成绩类型不能为空').isIn(['exam', 'quiz', 'homework', 'daily']).withMessage('无效的成绩类型'),
  body('*.score').notEmpty().withMessage('每个成绩记录的分数不能为空').isFloat({ min: 0 }).withMessage('分数必须是大于等于0的数字'),
  body('*.totalScore').notEmpty().withMessage('每个成绩记录的总分不能为空').isFloat({ gt: 0 }).withMessage('总分必须是大于0的数字')
    .custom((value, { req, path }) => {
      const index = parseInt(path.match(/\d+/)[0]);
      const score = req.body[index]?.score;
      if (typeof score === 'number' && score > parseFloat(value)) {
        throw new Error(`成绩记录 ${index + 1}: 得分 (${score}) 不能超过总分 (${value})`);
      }
      return true;
    }),
  body('*.date').notEmpty().withMessage('每个成绩记录的日期不能为空').isISO8601().toDate().withMessage('日期必须是有效的日期格式'),
  body('*.comments').optional().isString().trim(),
];

const updateGradeValidationRules = () => [
  body('student').optional().custom(isValidMongoId).withMessage('学生ID必须是有效的 ObjectId'),
  body('subject').optional().custom(isValidMongoId).withMessage('科目ID必须是有效的 ObjectId'),
  body('class').optional().custom(isValidMongoId).withMessage('班级ID必须是有效的 ObjectId'),
  body('type').optional().isIn(['exam', 'quiz', 'homework', 'daily']).withMessage('无效的成绩类型'),
  body('score').optional().isFloat({ min: 0 }).withMessage('分数必须是大于等于0的数字'),
  body('totalScore').optional().isFloat({ gt: 0 }).withMessage('总分必须是大于0的数字'),
  body('date').optional().isISO8601().toDate().withMessage('日期必须是有效的日期格式'),
  body('comments').optional().isString().trim(),
  body().custom((value, { req }) => { // Custom validation for score vs totalScore if both are present or one is updated
    const score = req.body.score !== undefined ? parseFloat(req.body.score) : null;
    const totalScore = req.body.totalScore !== undefined ? parseFloat(req.body.totalScore) : null;
    
    // This logic needs access to the existing document to be fully robust, 
    // or make score and totalScore mandatory if one is provided.
    // For now, if both are provided in the update, check them.
    // If only one is provided, this check might be insufficient without the original document's other value.
    // Service layer will handle this more robustly by loading the existing grade.
    if (score !== null && totalScore !== null && score > totalScore) {
      throw new Error('得分不能超过总分');
    }
    // If only score is updated, it might become > existing totalScore (not checked here).
    // If only totalScore is updated, it might become < existing score (not checked here).
    return true;
  })
];

module.exports = {
  mongoIdParamValidation,
  gradeQueryValidationRules,
  createGradeValidationRules,
  batchCreateGradeValidationRules,
  updateGradeValidationRules
}; 