const express = require('express');
const router = express.Router();
const Homework = require('../models/Homework');

// 获取所有作业
router.get('/', async (req, res) => {
  try {
    const homework = await Homework.find()
      .populate('subject', 'name')
      .populate('class', 'name')
      .populate('assignedBy', 'name')
      .populate('assignedTo', 'name');
    
    res.json({ success: true, data: homework });
  } catch (error) {
    req.app.locals.logger.error('获取作业列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取作业列表失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 获取单个作业
router.get('/:id', async (req, res) => {
  try {
    const homework = await Homework.findById(req.params.id)
      .populate('subject', 'name')
      .populate('class', 'name')
      .populate('assignedBy', 'name')
      .populate('assignedTo', 'name');
    
    if (!homework) {
      return res.status(404).json({
        success: false,
        message: '作业不存在'
      });
    }
    
    res.json({ success: true, data: homework });
  } catch (error) {
    req.app.locals.logger.error('获取作业详情错误:', error);
    res.status(500).json({
      success: false,
      message: '获取作业详情失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 创建作业
router.post('/', async (req, res) => {
  try {
    const { title, description, subject, class: classId, assignedBy, assignedTo, dueDate, attachments } = req.body;
    
    const newHomework = new Homework({
      title,
      description,
      subject,
      class: classId,
      assignedBy,
      assignedTo,
      dueDate,
      attachments,
      status: 'draft'
    });
    
    const savedHomework = await newHomework.save();
    
    // 发布作业创建事件到消息队列
    if (req.app.locals.mq) {
      const { channel, exchange } = req.app.locals.mq;
      channel.publish(
        exchange,
        'homework.created',
        Buffer.from(JSON.stringify(savedHomework)),
        { persistent: true }
      );
      req.app.locals.logger.info(`作业创建事件已发布: ${savedHomework._id}`);
    }
    
    res.status(201).json({
      success: true,
      message: '作业创建成功',
      data: savedHomework
    });
  } catch (error) {
    req.app.locals.logger.error('创建作业错误:', error);
    res.status(500).json({
      success: false,
      message: '创建作业失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 更新作业
router.put('/:id', async (req, res) => {
  try {
    const { title, description, subject, class: classId, assignedBy, assignedTo, dueDate, status, attachments } = req.body;
    
    const updatedHomework = await Homework.findByIdAndUpdate(
      req.params.id,
      {
        title,
        description,
        subject,
        class: classId,
        assignedBy,
        assignedTo,
        dueDate,
        status,
        attachments,
        updatedAt: Date.now()
      },
      { new: true }
    );
    
    if (!updatedHomework) {
      return res.status(404).json({
        success: false,
        message: '作业不存在'
      });
    }
    
    // 发布作业更新事件到消息队列
    if (req.app.locals.mq) {
      const { channel, exchange } = req.app.locals.mq;
      channel.publish(
        exchange,
        'homework.updated',
        Buffer.from(JSON.stringify(updatedHomework)),
        { persistent: true }
      );
      req.app.locals.logger.info(`作业更新事件已发布: ${updatedHomework._id}`);
    }
    
    res.json({
      success: true,
      message: '作业更新成功',
      data: updatedHomework
    });
  } catch (error) {
    req.app.locals.logger.error('更新作业错误:', error);
    res.status(500).json({
      success: false,
      message: '更新作业失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 删除作业
router.delete('/:id', async (req, res) => {
  try {
    const deletedHomework = await Homework.findByIdAndDelete(req.params.id);
    
    if (!deletedHomework) {
      return res.status(404).json({
        success: false,
        message: '作业不存在'
      });
    }
    
    // 发布作业删除事件到消息队列
    if (req.app.locals.mq) {
      const { channel, exchange } = req.app.locals.mq;
      channel.publish(
        exchange,
        'homework.deleted',
        Buffer.from(JSON.stringify({ id: deletedHomework._id })),
        { persistent: true }
      );
      req.app.locals.logger.info(`作业删除事件已发布: ${deletedHomework._id}`);
    }
    
    res.json({
      success: true,
      message: '作业删除成功'
    });
  } catch (error) {
    req.app.locals.logger.error('删除作业错误:', error);
    res.status(500).json({
      success: false,
      message: '删除作业失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 分配作业给学生
router.post('/:id/assign', async (req, res) => {
  try {
    const { studentIds } = req.body;
    
    const homework = await Homework.findById(req.params.id);
    
    if (!homework) {
      return res.status(404).json({
        success: false,
        message: '作业不存在'
      });
    }
    
    // 添加新学生到assignedTo数组（避免重复）
    const updatedAssignedTo = [...new Set([...homework.assignedTo.map(id => id.toString()), ...studentIds])];
    
    const updatedHomework = await Homework.findByIdAndUpdate(
      req.params.id,
      {
        assignedTo: updatedAssignedTo,
        status: 'assigned',
        updatedAt: Date.now()
      },
      { new: true }
    );
    
    // 发布作业分配事件到消息队列
    if (req.app.locals.mq) {
      const { channel, exchange } = req.app.locals.mq;
      channel.publish(
        exchange,
        'homework.assigned',
        Buffer.from(JSON.stringify({
          homework: updatedHomework,
          newlyAssignedStudents: studentIds
        })),
        { persistent: true }
      );
      req.app.locals.logger.info(`作业分配事件已发布: ${updatedHomework._id}`);
    }
    
    res.json({
      success: true,
      message: '作业分配成功',
      data: updatedHomework
    });
  } catch (error) {
    req.app.locals.logger.error('分配作业错误:', error);
    res.status(500).json({
      success: false,
      message: '分配作业失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;