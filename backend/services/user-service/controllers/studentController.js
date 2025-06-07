const User = require('../../../common/models/User');
// const { logger } = require('../../../common/config/logger'); // Replaced by req.app.locals.logger
const { catchAsync } = require('../../../common/middleware/errorHandler');
const { NotFoundError, InternalServerError } = require('../../../common/middleware/errorTypes');

class StudentController {
  /**
   * 获取学生列表
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   * @param {Function} next - next middleware function
   */
  getStudents = catchAsync(async (req, res, next) => {
    const logger = req.app.locals.logger; // Use logger from app.locals
    const { page = 1, limit = 10, search = '', class: className = '' } = req.query;
    
    const queryOptions = {
      role: 'student',
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      className
    };
    
    // 构建查询条件
    const dbQuery = { role: 'student' };
    if (search) {
      dbQuery.$or = [
        { name: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        // { studentId: { $regex: search, $options: 'i' } } // Assuming studentId is a specific field
      ];
    }
    if (className) {
      dbQuery.class = className;
    }
    
    const skip = (queryOptions.page - 1) * queryOptions.limit;
    
    const students = await User.find(dbQuery)
      .select('_id name username class grade') // Added username for consistency
      .skip(skip)
      .limit(queryOptions.limit)
      .sort({ name: 1 });
      
    const total = await User.countDocuments(dbQuery);
    
    logger.info('获取学生列表成功', {
      count: students.length,
      total,
      page: queryOptions.page,
      limit: queryOptions.limit,
      search: queryOptions.search,
      class: queryOptions.className
    });
    
    res.status(200).json({
      status: 'success',
      message: '获取学生列表成功',
      data: {
        items: students.map(student => ({
          id: student._id,
          name: student.name,
          username: student.username,
          class: student.class,
          grade: student.grade
        })),
        total,
        page: queryOptions.page,
        limit: queryOptions.limit
      }
    });
  });

  /**
   * 获取学生详情
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   * @param {Function} next - next middleware function
   */
  getStudentById = catchAsync(async (req, res, next) => {
    const logger = req.app.locals.logger;
    const { id } = req.params;
    
    const student = await User.findOne({ _id: id, role: 'student' })
      .select('_id name username class grade email avatar'); // Added more fields
    
    if (!student) {
      logger.warn('学生不存在', { studentId: id });
      return next(new NotFoundError('学生不存在'));
    }
    
    // TODO: 获取学生成绩等其他关联信息
    const scores = []; 
    
    logger.info('获取学生详情成功', { studentId: id });
    
    res.status(200).json({
      status: 'success',
      message: '获取学生详情成功',
      data: {
        // Return a clean student object, can use a helper if needed
        id: student._id,
        name: student.name,
        username: student.username,
        class: student.class,
        grade: student.grade,
        email: student.email,
        avatar: student.avatar,
        scores // Example of other associated data
      }
    });
  });
}

module.exports = new StudentController();