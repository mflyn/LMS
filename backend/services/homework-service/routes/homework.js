const express = require('express');
const router = express.Router();
const Homework = require('../models/Homework');
const { AppError, catchAsync } = require('../../../common/middleware/errorHandler');
const { authenticateGateway, checkRole } = require('../../../common/middleware/auth');
const { validate } = require('../../../common/middleware/requestValidator');
const {
  mongoIdParamValidation,
  createHomeworkValidationRules,
  updateHomeworkValidationRules,
  assignHomeworkValidationRules,
  listHomeworkQueryValidationRules
} = require('../validators/homeworkValidators');

// 预设角色常量，根据实际项目调整
const ROLES = { TEACHER: 'teacher', ADMIN: 'admin', STUDENT: 'student' };

// 获取所有作业
router.get('/', 
  authenticateGateway, 
  checkRole([ROLES.TEACHER, ROLES.ADMIN]), // 教师和管理员可以查看所有作业布置
  listHomeworkQueryValidationRules(),
  validate,
  catchAsync(async (req, res) => {
    const { limit = 10, page = 1, sortBy = 'createdAt', sortOrder = 'desc', subject, class: classId, status } = req.query;
    const queryOptions = {};
    if (subject) queryOptions.subject = subject;
    if (classId) queryOptions.class = classId;
    if (status) queryOptions.status = status;

    // 在测试环境中不使用 populate (这个逻辑可以保留，或者考虑更复杂的mock策略)
    // 注意: populate 跨服务引用的潜在问题。这里假设ID是有效的，但获取name可能失败或需要其他机制。
    const populateFields = process.env.NODE_ENV === 'test' ? [] : [
        { path: 'subject', select: 'name' },
        { path: 'class', select: 'name' },
        { path: 'assignedBy', select: 'name role' }, // 添加role以供参考
        { path: 'assignedTo', select: 'name role' }  // 添加role以供参考
    ];

    const homeworkQuery = Homework.find(queryOptions)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit);

    populateFields.forEach(p => homeworkQuery.populate(p));
    
    const homework = await homeworkQuery.exec();
    const totalHomeworks = await Homework.countDocuments(queryOptions);

    res.json({
      success: true,
      data: homework,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalHomeworks / limit),
        totalItems: totalHomeworks,
        itemsPerPage: limit
      }
    });
  })
);

// 获取单个作业
router.get('/:id',
  authenticateGateway,
  checkRole([ROLES.TEACHER, ROLES.ADMIN, ROLES.STUDENT]), // 学生可以查看分配给自己的作业详情
  mongoIdParamValidation('id'),
  validate,
  catchAsync(async (req, res) => {
    const populateFields = process.env.NODE_ENV === 'test' ? [] : [
        { path: 'subject', select: 'name' },
        { path: 'class', select: 'name' },
        { path: 'assignedBy', select: 'name role' },
        { path: 'assignedTo', select: 'name role' }
    ];
    
    const homeworkQuery = Homework.findById(req.params.id);
    populateFields.forEach(p => homeworkQuery.populate(p));
    const homework = await homeworkQuery.exec();

    if (!homework) {
      throw new AppError('作业不存在', 404);
    }

    // 学生只能查看分配给自己的或自己所在班级的作业
    if (req.user.role === ROLES.STUDENT) {
        const isAssignedToStudent = homework.assignedTo.some(user => user._id.equals(req.user.id));
        // 假设学生用户对象上有 classId 字段
        // const isAssignedToStudentClass = homework.class._id.equals(req.user.classId); 
        // 更准确的班级检查可能需要查询 User 模型或依赖JWT中的班级信息
        if (!isAssignedToStudent) { 
             throw new AppError('无权查看此作业详情', 403);
        }
    }

    res.json({ success: true, data: homework });
  })
);

// 创建作业
router.post('/', 
  authenticateGateway, 
  checkRole([ROLES.TEACHER, ROLES.ADMIN]),
  createHomeworkValidationRules(),
  validate,
  catchAsync(async (req, res) => {
    const { title, description, subject, class: classId, assignedTo, dueDate, attachments } = req.body;
    const assignedById = req.user.id; // 布置人ID从认证用户中获取

    const newHomework = new Homework({
      title,
      description,
      subject,
      class: classId,
      assignedBy: assignedById,
      assignedTo: assignedTo || [], // 确保 assignedTo 是数组
      dueDate,
      attachments,
      // status 默认为 'draft' (由模型定义)
    });

    const savedHomework = await newHomework.save();

    if (req.app.locals.mq && req.app.locals.mq.channel) {
      const { channel, exchange } = req.app.locals.mq;
      channel.publish(
        exchange,
        'homework.created',
        Buffer.from(JSON.stringify(savedHomework)),
        { persistent: true }
      );
      req.app.locals.logger.info(`作业创建事件已发布: ${savedHomework._id}`, { homeworkId: savedHomework._id, createdBy: assignedById });
    } else {
      req.app.locals.logger.warn('MQ未初始化，无法发布作业创建事件', { homeworkId: savedHomework._id });
    }

    res.status(201).json({
      success: true,
      message: '作业创建成功',
      data: savedHomework
    });
  })
);

// 更新作业 (通常只能更新 draft 状态的作业，或特定字段)
router.put('/:id', 
  authenticateGateway, 
  checkRole([ROLES.TEACHER, ROLES.ADMIN]),
  mongoIdParamValidation('id'),
  updateHomeworkValidationRules(),
  validate,
  catchAsync(async (req, res) => {
    const homeworkId = req.params.id;
    const updates = req.body;

    // 防止关键字段被随意修改，例如 assignedBy
    delete updates.assignedBy;
    // updatedAt 将由 mongoose timestamps 自动处理

    const homework = await Homework.findById(homeworkId);
    if (!homework) {
      throw new AppError('作业不存在', 404);
    }

    // 权限：只有布置人或管理员可以修改
    if (homework.assignedBy.toString() !== req.user.id && req.user.role !== ROLES.ADMIN) {
        throw new AppError('无权修改此作业', 403);
    }
    
    // 业务逻辑：例如，已分配 (assigned) 的作业可能限制某些字段的修改
    // if (homework.status === 'assigned' && (updates.subject || updates.class || updates.dueDate)) {
    //   throw new AppError('已分配的作业不能修改科目、班级或截止日期，请考虑创建新作业', 400);
    // }

    Object.assign(homework, updates);
    const updatedHomework = await homework.save();

    if (req.app.locals.mq && req.app.locals.mq.channel) {
      const { channel, exchange } = req.app.locals.mq;
      channel.publish(
        exchange,
        'homework.updated',
        Buffer.from(JSON.stringify(updatedHomework)),
        { persistent: true }
      );
      req.app.locals.logger.info(`作业更新事件已发布: ${updatedHomework._id}`, { homeworkId: updatedHomework._id, updatedBy: req.user.id });
    } else {
      req.app.locals.logger.warn('MQ未初始化，无法发布作业更新事件', { homeworkId: updatedHomework._id });
    }

    res.json({
      success: true,
      message: '作业更新成功',
      data: updatedHomework
    });
  })
);

// 删除作业
router.delete('/:id', 
  authenticateGateway, 
  checkRole([ROLES.TEACHER, ROLES.ADMIN]),
  mongoIdParamValidation('id'),
  validate,
  catchAsync(async (req, res) => {
    const homeworkId = req.params.id;
    const homework = await Homework.findById(homeworkId);

    if (!homework) {
      throw new AppError('作业不存在', 404);
    }

    // 权限：只有布置人或管理员可以删除
    if (homework.assignedBy.toString() !== req.user.id && req.user.role !== ROLES.ADMIN) {
        throw new AppError('无权删除此作业', 403);
    }

    // 业务逻辑：例如，已分配的作业是否允许删除，或需要其他处理
    // if (homework.status === 'assigned') {
    //    throw new AppError('不能删除已分配的作业，请先取消分配或归档', 400);
    // }

    await Homework.findByIdAndDelete(homeworkId);

    if (req.app.locals.mq && req.app.locals.mq.channel) {
      const { channel, exchange } = req.app.locals.mq;
      channel.publish(
        exchange,
        'homework.deleted',
        Buffer.from(JSON.stringify({ id: homeworkId, deletedBy: req.user.id })),
        { persistent: true }
      );
      req.app.locals.logger.info(`作业删除事件已发布: ${homeworkId}`, { homeworkId: homeworkId, deletedBy: req.user.id });
    } else {
      req.app.locals.logger.warn('MQ未初始化，无法发布作业删除事件', { homeworkId: homeworkId });
    }

    res.json({
      success: true,
      message: '作业删除成功'
    });
  })
);

// 分配/发布作业给学生 (将作业状态从 draft 变为 assigned)
router.post('/:id/assign', 
  authenticateGateway, 
  checkRole([ROLES.TEACHER, ROLES.ADMIN]),
  mongoIdParamValidation('id'),
  assignHomeworkValidationRules(), // 验证 studentIds
  validate,
  catchAsync(async (req, res) => {
    const homeworkId = req.params.id;
    const { studentIds } = req.body; // studentIds 用于明确指定分配给哪些学生，可以覆盖或追加

    const homework = await Homework.findById(homeworkId);

    if (!homework) {
      throw new AppError('作业不存在', 404);
    }

    // 权限：只有布置人或管理员可以分配
    if (homework.assignedBy.toString() !== req.user.id && req.user.role !== ROLES.ADMIN) {
        throw new AppError('无权分配此作业', 403);
    }
    
    // 确保 studentIds 是一个数组，即使是空数组
    const newAssignedStudentIds = Array.isArray(studentIds) ? studentIds : [];

    // 更新 assignedTo 列表，并确保ID唯一性
    // 如果 studentIds 为空，则之前 assignedTo 列表中的学生仍保留，作业状态变为 assigned
    // 如果希望替换，则 homework.assignedTo = newAssignedStudentIds.map(id => new mongoose.Types.ObjectId(id));
    // 这里采用合并策略，如果需要，也可以用 studentIds 完全替换 homework.assignedTo
    const currentAssignedToStringSet = new Set(homework.assignedTo.map(id => id.toString()));
    newAssignedStudentIds.forEach(id => currentAssignedToStringSet.add(id.toString()));
    
homework.assignedTo = Array.from(currentAssignedToStringSet).map(id => new mongoose.Types.ObjectId(id));
    homework.status = 'assigned';
    // updatedAt 会自动更新

    const updatedHomework = await homework.save();

    if (req.app.locals.mq && req.app.locals.mq.channel) {
      const { channel, exchange } = req.app.locals.mq;
      channel.publish(
        exchange,
        'homework.assigned', // 或者 'homework.status.changed'
        Buffer.from(JSON.stringify({
          homework: updatedHomework,
          assignedBy: req.user.id,
          // newlyAssignedStudents: studentIds // 可以只发送本次操作相关的学生
        })),
        { persistent: true }
      );
      req.app.locals.logger.info(`作业分配/发布事件已发布: ${updatedHomework._id}`, { homeworkId: updatedHomework._id, assignedBy: req.user.id });
    } else {
      req.app.locals.logger.warn('MQ未初始化，无法发布作业分配事件', { homeworkId: updatedHomework._id });
    }

    res.json({
      success: true,
      message: '作业分配/发布成功',
      data: updatedHomework
    });
  })
);

module.exports = router;