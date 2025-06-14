const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const homeworkRouter = require('../../routes/homework');
const Homework = require('../../models/Homework');

// 增加超时时间
jest.setTimeout(60000);

// 设置测试环境
process.env.NODE_ENV = 'test';

// 创建测试应用
const app = express();
app.use(express.json());

// 模拟日志记录器
app.locals.logger = {
  info: jest.fn(),
  error: jest.fn()
};

// 模拟消息队列
app.locals.mq = {
  channel: {
    publish: jest.fn()
  },
  exchange: 'homework.events'
};

app.use('/api/homework', homeworkRouter);

// 使用内存数据库进行测试
let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('作业路由测试', () => {
  beforeEach(async () => {
    // 诊断日志
    console.log('Mongoose connection readystate:', mongoose.connection.readyState); // 1 means connected
    console.log('Homework model object:', Homework);
    console.log('Type of Homework.deleteMany:', typeof Homework.deleteMany);
    console.log('Homework.modelName:', Homework.modelName); // Should be 'Homework'

    try {
      await Homework.deleteMany({});
    } catch (e) {
      console.error('Error during Homework.deleteMany:', e);
      // 备用方案：如果 deleteMany 失败，尝试通过 collection 直接删除
      if (mongoose.connection.readyState === 1 && Homework.collection) {
         console.log('Attempting direct collection drop for Homework...');
         try {
            await Homework.collection.drop(); // 这会移除整个 collection，包括索引
            console.log('Homework collection dropped successfully.');
            // 如果需要保持索引，可以考虑 await Homework.collection.deleteMany({});
         } catch (dropError) {
            // 如果 drop 失败（例如 collection 不存在），通常可以忽略
            if (dropError.code === 26 || dropError.message.includes('ns not found')) {
               console.log('Homework collection did not exist, no need to drop.');
            } else {
               console.error('Error dropping Homework collection:', dropError);
            }
         }
      } else {
         console.log('Cannot attempt direct collection drop, connection or collection unavailable.');
      }
      // 抛出原始错误以便测试仍然失败并指示问题
      throw e;
    }
    // 重置模拟函数
    app.locals.logger.info.mockClear();
    app.locals.logger.error.mockClear();
    app.locals.mq.channel.publish.mockClear();
  });

  describe('GET /api/homework', () => {
    it('应该返回所有作业', async () => {
      const mockTeacherId = new mongoose.Types.ObjectId();
      const mockSubjectId = new mongoose.Types.ObjectId();
      const mockClassId = new mongoose.Types.ObjectId();

      // 创建测试数据
      await Homework.create([
        {
          title: '数学作业1',
          description: '描述1',
          subject: mockSubjectId,
          class: mockClassId,
          assignedBy: mockTeacherId,
          dueDate: new Date(),
          status: 'draft'
        },
        {
          title: '数学作业2',
          description: '描述2',
          subject: mockSubjectId,
          class: mockClassId,
          assignedBy: mockTeacherId,
          dueDate: new Date(),
          status: 'assigned'
        }
      ]);

      // 发送请求
      const response = await request(app).get('/api/homework');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /api/homework/:id', () => {
    it('应该返回单个作业', async () => {
      const mockTeacherId = new mongoose.Types.ObjectId();
      const mockSubjectId = new mongoose.Types.ObjectId();
      const mockClassId = new mongoose.Types.ObjectId();

      // 创建测试数据
      const homework = await Homework.create({
        title: '数学作业',
        description: '描述',
        subject: mockSubjectId,
        class: mockClassId,
        assignedBy: mockTeacherId,
        dueDate: new Date(),
        status: 'draft'
      });

      // 发送请求
      const response = await request(app).get(`/api/homework/${homework._id}`);

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data.title).toBe('数学作业');
    });

    it('应该处理不存在的作业', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      // 发送请求
      const response = await request(app).get(`/api/homework/${nonExistentId}`);

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', '作业不存在');
    });
  });

  describe('POST /api/homework', () => {
    it('应该创建新作业', async () => {
      const mockTeacherId = new mongoose.Types.ObjectId();
      const mockSubjectId = new mongoose.Types.ObjectId();
      const mockClassId = new mongoose.Types.ObjectId();

      const homeworkData = {
        title: '新数学作业',
        description: '新描述',
        subject: mockSubjectId,
        class: mockClassId,
        assignedBy: mockTeacherId,
        dueDate: new Date().toISOString(),
        attachments: []
      };

      // 发送请求
      const response = await request(app)
        .post('/api/homework')
        .send(homeworkData);

      // 验证响应
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', '作业创建成功');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data.title).toBe('新数学作业');
      expect(response.body.data.status).toBe('draft');

      // 验证数据库中的记录
      const homework = await Homework.findById(response.body.data._id);
      expect(homework).toBeDefined();
      expect(homework.title).toBe('新数学作业');

      // 验证消息发布
      expect(app.locals.mq.channel.publish).toHaveBeenCalledTimes(1);
      expect(app.locals.mq.channel.publish).toHaveBeenCalledWith(
        'homework.events',
        'homework.created',
        expect.any(Buffer),
        { persistent: true }
      );
    });
  });

  describe('PUT /api/homework/:id', () => {
    it('应该更新作业', async () => {
      const mockTeacherId = new mongoose.Types.ObjectId();
      const mockSubjectId = new mongoose.Types.ObjectId();
      const mockClassId = new mongoose.Types.ObjectId();

      // 创建测试数据
      const homework = await Homework.create({
        title: '数学作业',
        description: '描述',
        subject: mockSubjectId,
        class: mockClassId,
        assignedBy: mockTeacherId,
        dueDate: new Date(),
        status: 'draft'
      });

      const updateData = {
        title: '更新后的数学作业',
        description: '更新后的描述',
        subject: mockSubjectId,
        class: mockClassId,
        assignedBy: mockTeacherId,
        dueDate: new Date().toISOString(),
        status: 'assigned'
      };

      // 发送请求
      const response = await request(app)
        .put(`/api/homework/${homework._id}`)
        .send(updateData);

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', '作业更新成功');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data.title).toBe('更新后的数学作业');
      expect(response.body.data.status).toBe('assigned');

      // 验证数据库中的记录
      const updatedHomework = await Homework.findById(homework._id);
      expect(updatedHomework).toBeDefined();
      expect(updatedHomework.title).toBe('更新后的数学作业');
      expect(updatedHomework.status).toBe('assigned');

      // 验证消息发布
      expect(app.locals.mq.channel.publish).toHaveBeenCalledTimes(1);
      expect(app.locals.mq.channel.publish).toHaveBeenCalledWith(
        'homework.events',
        'homework.updated',
        expect.any(Buffer),
        { persistent: true }
      );
    });

    it('应该处理不存在的作业', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const updateData = {
        title: '更新后的数学作业',
        description: '更新后的描述'
      };

      // 发送请求
      const response = await request(app)
        .put(`/api/homework/${nonExistentId}`)
        .send(updateData);

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', '作业不存在');
    });
  });

  describe('DELETE /api/homework/:id', () => {
    it('应该删除作业', async () => {
      const mockTeacherId = new mongoose.Types.ObjectId();
      const mockSubjectId = new mongoose.Types.ObjectId();
      const mockClassId = new mongoose.Types.ObjectId();

      // 创建测试数据
      const homework = await Homework.create({
        title: '数学作业',
        description: '描述',
        subject: mockSubjectId,
        class: mockClassId,
        assignedBy: mockTeacherId,
        dueDate: new Date(),
        status: 'draft'
      });

      // 发送请求
      const response = await request(app).delete(`/api/homework/${homework._id}`);

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', '作业删除成功');

      // 验证数据库中的记录已删除
      const deletedHomework = await Homework.findById(homework._id);
      expect(deletedHomework).toBeNull();

      // 验证消息发布
      expect(app.locals.mq.channel.publish).toHaveBeenCalledTimes(1);
      expect(app.locals.mq.channel.publish).toHaveBeenCalledWith(
        'homework.events',
        'homework.deleted',
        expect.any(Buffer),
        { persistent: true }
      );
    });

    it('应该处理不存在的作业', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      // 发送请求
      const response = await request(app).delete(`/api/homework/${nonExistentId}`);

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', '作业不存在');
    });
  });

  describe('POST /api/homework/:id/assign', () => {
    it('应该分配作业给学生', async () => {
      const mockTeacherId = new mongoose.Types.ObjectId();
      const mockSubjectId = new mongoose.Types.ObjectId();
      const mockClassId = new mongoose.Types.ObjectId();
      const mockStudentId1 = new mongoose.Types.ObjectId();
      const mockStudentId2 = new mongoose.Types.ObjectId();

      // 创建测试数据
      const homework = await Homework.create({
        title: '数学作业',
        description: '描述',
        subject: mockSubjectId,
        class: mockClassId,
        assignedBy: mockTeacherId,
        dueDate: new Date(),
        status: 'draft',
        assignedTo: [mockStudentId1]
      });

      // 发送请求
      const response = await request(app)
        .post(`/api/homework/${homework._id}/assign`)
        .send({
          studentIds: [mockStudentId2.toString()]
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', '作业分配成功');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data.status).toBe('assigned');
      expect(response.body.data.assignedTo.length).toBe(2);

      // 验证数据库中的记录
      const updatedHomework = await Homework.findById(homework._id);
      expect(updatedHomework).toBeDefined();
      expect(updatedHomework.status).toBe('assigned');
      expect(updatedHomework.assignedTo.length).toBe(2);
      expect(updatedHomework.assignedTo.map(id => id.toString())).toContain(mockStudentId1.toString());
      expect(updatedHomework.assignedTo.map(id => id.toString())).toContain(mockStudentId2.toString());

      // 验证消息发布
      expect(app.locals.mq.channel.publish).toHaveBeenCalledTimes(1);
      expect(app.locals.mq.channel.publish).toHaveBeenCalledWith(
        'homework.events',
        'homework.assigned',
        expect.any(Buffer),
        { persistent: true }
      );
    });

    it('应该处理不存在的作业', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const mockStudentId = new mongoose.Types.ObjectId();

      // 发送请求
      const response = await request(app)
        .post(`/api/homework/${nonExistentId}/assign`)
        .send({
          studentIds: [mockStudentId.toString()]
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', '作业不存在');
    });
  });
});
