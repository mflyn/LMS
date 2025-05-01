// 模拟Message模型
const Message = {
  find: jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn()
  })
};

// 设置默认返回值
Message.find().populate().populate().exec.mockResolvedValue([
  { id: 1, content: 'Test message 1' },
  { id: 2, content: 'Test message 2' }
]);

// 模拟countDocuments
Message.countDocuments = jest.fn().mockResolvedValue(2);

// 测试函数
async function getMessages() {
  try {
    const messages = await Message.find()
      .sort({ createdAt: -1 })
      .skip(0)
      .limit(20)
      .populate('sender', 'name role')
      .populate('receiver', 'name role')
      .exec();
    
    const total = await Message.countDocuments({});
    
    return {
      data: messages,
      pagination: {
        total,
        limit: 20,
        skip: 0
      }
    };
  } catch (err) {
    console.error('Error:', err);
    return { error: err.message };
  }
}

// 运行测试
getMessages().then(result => {
  console.log('Result:', JSON.stringify(result, null, 2));
});
