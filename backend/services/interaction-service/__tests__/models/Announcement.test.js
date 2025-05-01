/**
 * 公告模型单元测试
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Announcement = require('../../models/Announcement');

describe('Announcement模型测试', () => {
  let mongoServer;

  // 在所有测试之前连接到内存数据库
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  });

  // 在所有测试之后断开连接并停止内存数据库
  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  // 在每个测试之前清空数据库
  beforeEach(async () => {
    await Announcement.deleteMany({});
  });

  it('应该能成功创建公告', async () => {
    const authorId = new mongoose.Types.ObjectId();
    const classId = new mongoose.Types.ObjectId();

    const announcementData = {
      title: '测试公告标题',
      content: '这是一条测试公告内容',
      author: authorId,
      class: classId
    };

    const announcement = new Announcement(announcementData);
    const savedAnnouncement = await announcement.save();

    // 验证保存的公告
    expect(savedAnnouncement._id).toBeDefined();
    expect(savedAnnouncement.title).toBe(announcementData.title);
    expect(savedAnnouncement.content).toBe(announcementData.content);
    expect(savedAnnouncement.author.toString()).toBe(authorId.toString());
    expect(savedAnnouncement.class.toString()).toBe(classId.toString());
    expect(savedAnnouncement.createdAt).toBeDefined();
  });

  it('缺少必要字段应该抛出验证错误', async () => {
    const authorId = new mongoose.Types.ObjectId();
    const classId = new mongoose.Types.ObjectId();

    const invalidAnnouncements = [
      { content: '缺少标题', author: authorId, class: classId },
      { title: '缺少内容', author: authorId, class: classId },
      { title: '缺少作者', content: '测试内容', class: classId },
      { title: '缺少班级', content: '测试内容', author: authorId }
    ];

    for (const invalidAnnouncement of invalidAnnouncements) {
      const announcement = new Announcement(invalidAnnouncement);

      // 使用try-catch捕获验证错误
      try {
        await announcement.save();
        // 如果没有抛出错误，则测试失败
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.name).toBe('ValidationError');
      }
    }
  });

  it('应该能正确设置默认值', async () => {
    const authorId = new mongoose.Types.ObjectId();
    const classId = new mongoose.Types.ObjectId();

    const announcementData = {
      title: '测试默认值',
      content: '测试默认值内容',
      author: authorId,
      class: classId
    };

    const announcement = new Announcement(announcementData);
    const savedAnnouncement = await announcement.save();

    // 验证默认值
    expect(savedAnnouncement.attachments).toEqual([]);
    expect(savedAnnouncement.createdAt).toBeInstanceOf(Date);
  });

  it('应该能查询和更新公告', async () => {
    const authorId = new mongoose.Types.ObjectId();
    const classId = new mongoose.Types.ObjectId();

    // 创建测试公告
    const announcementData = {
      title: '测试查询和更新',
      content: '测试查询和更新内容',
      author: authorId,
      class: classId
    };

    const announcement = new Announcement(announcementData);
    await announcement.save();

    // 查询公告
    const foundAnnouncement = await Announcement.findOne({ title: '测试查询和更新' });
    expect(foundAnnouncement).toBeDefined();
    expect(foundAnnouncement.content).toBe(announcementData.content);

    // 更新公告
    foundAnnouncement.title = '更新后的标题';
    await foundAnnouncement.save();

    // 验证更新
    const updatedAnnouncement = await Announcement.findById(foundAnnouncement._id);
    expect(updatedAnnouncement.title).toBe('更新后的标题');
  });

  it('应该能删除公告', async () => {
    const authorId = new mongoose.Types.ObjectId();
    const classId = new mongoose.Types.ObjectId();

    // 创建测试公告
    const announcementData = {
      title: '测试删除',
      content: '测试删除内容',
      author: authorId,
      class: classId
    };

    const announcement = new Announcement(announcementData);
    const savedAnnouncement = await announcement.save();

    // 删除公告
    await Announcement.findByIdAndDelete(savedAnnouncement._id);

    // 验证删除
    const deletedAnnouncement = await Announcement.findById(savedAnnouncement._id);
    expect(deletedAnnouncement).toBeNull();
  });

  it('应该能通过作者ID查询公告', async () => {
    const authorId = new mongoose.Types.ObjectId();
    const classId = new mongoose.Types.ObjectId();

    // 创建多个测试公告
    const announcements = [
      {
        title: '公告1',
        content: '内容1',
        author: authorId,
        class: classId
      },
      {
        title: '公告2',
        content: '内容2',
        author: new mongoose.Types.ObjectId(), // 不同的作者
        class: classId
      },
      {
        title: '公告3',
        content: '内容3',
        author: authorId,
        class: classId
      }
    ];

    // 保存所有公告
    await Announcement.insertMany(announcements);

    // 通过作者ID查询
    const foundAnnouncements = await Announcement.find({ author: authorId });

    // 验证查询结果
    expect(foundAnnouncements).toHaveLength(2);
    expect(foundAnnouncements[0].author.toString()).toBe(authorId.toString());
    expect(foundAnnouncements[1].author.toString()).toBe(authorId.toString());
  });


});
