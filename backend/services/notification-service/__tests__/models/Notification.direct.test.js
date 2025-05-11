const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Notification = require('../../models/Notification');

// 增加超时时间
jest.setTimeout(60000);

describe('Notification 模型直接测试', () => {
  let mongoServer;

  beforeAll(async () => {
    // 创建内存数据库
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  });
  
  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // 清理测试数据
    await Notification.deleteMany({});
  });

  it('应该创建并保存通知', async () => {
    const userId = new mongoose.Types.ObjectId();
    const notificationData = {
      user: userId,
      message: '您有一条新消息',
      type: 'info'
    };

    const notification = new Notification(notificationData);
    await notification.save();

    const savedNotification = await Notification.findOne({ user: userId });
    expect(savedNotification).not.toBeNull();
    expect(savedNotification.message).toBe(notificationData.message);
    expect(savedNotification.type).toBe(notificationData.type);
    expect(savedNotification.read).toBe(false); // 默认为未读
  });

  it('应该验证必填字段', async () => {
    const invalidNotification = new Notification({
      // 缺少必填字段
      type: 'info'
    });

    let error;
    try {
      await invalidNotification.validate();
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
    expect(error.errors.user).toBeDefined();
    expect(error.errors.message).toBeDefined();
  });

  it('应该验证类型枚举值', async () => {
    const userId = new mongoose.Types.ObjectId();
    const invalidNotification = new Notification({
      user: userId,
      message: '测试消息',
      type: 'invalid_type' // 无效的类型
    });

    let error;
    try {
      await invalidNotification.validate();
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
    expect(error.errors.type).toBeDefined();
  });

  it('应该支持标记通知为已读', async () => {
    const userId = new mongoose.Types.ObjectId();
    const notification = await Notification.create({
      user: userId,
      message: '测试消息',
      type: 'info'
    });

    // 验证初始状态为未读
    expect(notification.read).toBe(false);

    // 标记为已读
    notification.read = true;
    await notification.save();

    // 验证状态已更新
    const updatedNotification = await Notification.findById(notification._id);
    expect(updatedNotification.read).toBe(true);
  });

  it('应该支持查询用户的通知', async () => {
    const userId1 = new mongoose.Types.ObjectId();
    const userId2 = new mongoose.Types.ObjectId();

    // 创建多个通知
    await Notification.create([
      {
        user: userId1,
        message: '用户1的通知1',
        type: 'info'
      },
      {
        user: userId1,
        message: '用户1的通知2',
        type: 'warning'
      },
      {
        user: userId2,
        message: '用户2的通知',
        type: 'info'
      }
    ]);

    // 查询用户1的通知
    const user1Notifications = await Notification.find({ user: userId1 });
    expect(user1Notifications.length).toBe(2);

    // 查询用户2的通知
    const user2Notifications = await Notification.find({ user: userId2 });
    expect(user2Notifications.length).toBe(1);
    expect(user2Notifications[0].message).toBe('用户2的通知');
  });

  it('应该支持按类型查询通知', async () => {
    const userId = new mongoose.Types.ObjectId();

    // 创建不同类型的通知
    await Notification.create([
      {
        user: userId,
        message: '信息通知',
        type: 'info'
      },
      {
        user: userId,
        message: '警告通知',
        type: 'warning'
      },
      {
        user: userId,
        message: '错误通知',
        type: 'error'
      }
    ]);

    // 查询信息类型的通知
    const infoNotifications = await Notification.find({ type: 'info' });
    expect(infoNotifications.length).toBe(1);
    expect(infoNotifications[0].message).toBe('信息通知');

    // 查询警告类型的通知
    const warningNotifications = await Notification.find({ type: 'warning' });
    expect(warningNotifications.length).toBe(1);
    expect(warningNotifications[0].message).toBe('警告通知');
  });
});
