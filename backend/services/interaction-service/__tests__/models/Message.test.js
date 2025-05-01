/**
 * 消息模型单元测试
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Message = require('../../models/Message');

describe('Message模型测试', () => {
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
    await Message.deleteMany({});
  });

  it('应该能成功创建消息', async () => {
    const senderId = new mongoose.Types.ObjectId();
    const receiverId = new mongoose.Types.ObjectId();

    const messageData = {
      sender: senderId,
      receiver: receiverId,
      content: '这是一条测试消息'
    };

    const message = new Message(messageData);
    const savedMessage = await message.save();

    // 验证保存的消息
    expect(savedMessage._id).toBeDefined();
    expect(savedMessage.sender.toString()).toBe(senderId.toString());
    expect(savedMessage.receiver.toString()).toBe(receiverId.toString());
    expect(savedMessage.content).toBe(messageData.content);
    expect(savedMessage.read).toBe(false); // 默认为未读
    expect(savedMessage.createdAt).toBeDefined();
  });

  it('缺少必要字段应该抛出验证错误', async () => {
    const invalidMessages = [
      { receiver: new mongoose.Types.ObjectId(), content: '缺少发送者' },
      { sender: new mongoose.Types.ObjectId(), content: '缺少接收者' },
      { sender: new mongoose.Types.ObjectId(), receiver: new mongoose.Types.ObjectId() } // 缺少内容
    ];

    for (const invalidMessage of invalidMessages) {
      const message = new Message(invalidMessage);

      // 使用try-catch捕获验证错误
      try {
        await message.save();
        // 如果没有抛出错误，则测试失败
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.name).toBe('ValidationError');
      }
    }
  });

  it('应该能正确设置默认值', async () => {
    const senderId = new mongoose.Types.ObjectId();
    const receiverId = new mongoose.Types.ObjectId();

    const messageData = {
      sender: senderId,
      receiver: receiverId,
      content: '测试默认值'
    };

    const message = new Message(messageData);
    const savedMessage = await message.save();

    // 验证默认值
    expect(savedMessage.read).toBe(false);
    expect(savedMessage.attachments).toEqual([]);
    expect(savedMessage.createdAt).toBeInstanceOf(Date);
  });

  it('应该能查询和更新消息', async () => {
    const senderId = new mongoose.Types.ObjectId();
    const receiverId = new mongoose.Types.ObjectId();

    // 创建测试消息
    const messageData = {
      sender: senderId,
      receiver: receiverId,
      content: '测试查询和更新',
      read: false
    };

    const message = new Message(messageData);
    await message.save();

    // 查询消息
    const foundMessage = await Message.findOne({ content: '测试查询和更新' });
    expect(foundMessage).toBeDefined();
    expect(foundMessage.content).toBe(messageData.content);

    // 更新消息
    foundMessage.read = true;
    await foundMessage.save();

    // 验证更新
    const updatedMessage = await Message.findById(foundMessage._id);
    expect(updatedMessage.read).toBe(true);
  });

  it('应该能删除消息', async () => {
    const senderId = new mongoose.Types.ObjectId();
    const receiverId = new mongoose.Types.ObjectId();

    // 创建测试消息
    const messageData = {
      sender: senderId,
      receiver: receiverId,
      content: '测试删除',
      read: false
    };

    const message = new Message(messageData);
    const savedMessage = await message.save();

    // 删除消息
    await Message.findByIdAndDelete(savedMessage._id);

    // 验证删除
    const deletedMessage = await Message.findById(savedMessage._id);
    expect(deletedMessage).toBeNull();
  });


});
