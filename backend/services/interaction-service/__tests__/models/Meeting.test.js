/**
 * 会议模型单元测试
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Meeting = require('../../models/Meeting');

describe('Meeting模型测试', () => {
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
    await Meeting.deleteMany({});
  });
  
  it('应该能成功创建会议', async () => {
    const teacherId = new mongoose.Types.ObjectId();
    const parentId = new mongoose.Types.ObjectId();
    const studentId = new mongoose.Types.ObjectId();
    
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 一小时后
    
    const meetingData = {
      title: '期中考试家长会',
      description: '讨论期中考试安排和注意事项',
      teacher: teacherId,
      parent: parentId,
      student: studentId,
      startTime,
      endTime,
      location: '线上会议室',
      meetingType: '线上',
      meetingLink: 'https://meeting.example.com/123456',
      notes: '请准时参加'
    };
    
    const meeting = new Meeting(meetingData);
    const savedMeeting = await meeting.save();
    
    // 验证保存的会议
    expect(savedMeeting._id).toBeDefined();
    expect(savedMeeting.title).toBe(meetingData.title);
    expect(savedMeeting.description).toBe(meetingData.description);
    expect(savedMeeting.teacher.toString()).toBe(teacherId.toString());
    expect(savedMeeting.parent.toString()).toBe(parentId.toString());
    expect(savedMeeting.student.toString()).toBe(studentId.toString());
    expect(savedMeeting.startTime).toEqual(startTime);
    expect(savedMeeting.endTime).toEqual(endTime);
    expect(savedMeeting.location).toBe(meetingData.location);
    expect(savedMeeting.meetingType).toBe(meetingData.meetingType);
    expect(savedMeeting.meetingLink).toBe(meetingData.meetingLink);
    expect(savedMeeting.notes).toBe(meetingData.notes);
    expect(savedMeeting.status).toBe('待确认'); // 默认状态
    expect(savedMeeting.createdAt).toBeDefined();
    expect(savedMeeting.updatedAt).toBeDefined();
  });
  
  it('缺少必要字段应该抛出验证错误', async () => {
    const teacherId = new mongoose.Types.ObjectId();
    const parentId = new mongoose.Types.ObjectId();
    const studentId = new mongoose.Types.ObjectId();
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    
    const invalidMeetings = [
      { description: '缺少标题', teacher: teacherId, parent: parentId, student: studentId, startTime, endTime },
      { title: '缺少教师', description: '测试', parent: parentId, student: studentId, startTime, endTime },
      { title: '缺少家长', description: '测试', teacher: teacherId, student: studentId, startTime, endTime },
      { title: '缺少学生', description: '测试', teacher: teacherId, parent: parentId, startTime, endTime },
      { title: '缺少开始时间', description: '测试', teacher: teacherId, parent: parentId, student: studentId, endTime },
      { title: '缺少结束时间', description: '测试', teacher: teacherId, parent: parentId, student: studentId, startTime }
    ];
    
    for (const invalidMeeting of invalidMeetings) {
      const meeting = new Meeting(invalidMeeting);
      
      // 使用try-catch捕获验证错误
      try {
        await meeting.save();
        // 如果没有抛出错误，则测试失败
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.name).toBe('ValidationError');
      }
    }
  });
  
  it('应该能正确设置默认值', async () => {
    const teacherId = new mongoose.Types.ObjectId();
    const parentId = new mongoose.Types.ObjectId();
    const studentId = new mongoose.Types.ObjectId();
    
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    
    const meetingData = {
      title: '测试默认值',
      teacher: teacherId,
      parent: parentId,
      student: studentId,
      startTime,
      endTime
    };
    
    const meeting = new Meeting(meetingData);
    const savedMeeting = await meeting.save();
    
    // 验证默认值
    expect(savedMeeting.description).toBe('');
    expect(savedMeeting.location).toBe('线上会议');
    expect(savedMeeting.status).toBe('待确认');
    expect(savedMeeting.meetingType).toBe('线上');
    expect(savedMeeting.createdAt).toBeInstanceOf(Date);
    expect(savedMeeting.updatedAt).toBeInstanceOf(Date);
  });
  
  it('更新会议时应该更新updatedAt字段', async () => {
    const teacherId = new mongoose.Types.ObjectId();
    const parentId = new mongoose.Types.ObjectId();
    const studentId = new mongoose.Types.ObjectId();
    
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    
    // 创建测试会议
    const meetingData = {
      title: '测试更新时间',
      teacher: teacherId,
      parent: parentId,
      student: studentId,
      startTime,
      endTime
    };
    
    const meeting = new Meeting(meetingData);
    const savedMeeting = await meeting.save();
    
    // 记录原始的更新时间
    const originalUpdatedAt = savedMeeting.updatedAt;
    
    // 等待一段时间，确保时间戳会不同
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 更新会议
    savedMeeting.title = '更新后的标题';
    await savedMeeting.save();
    
    // 验证更新时间已更新
    const updatedMeeting = await Meeting.findById(savedMeeting._id);
    expect(updatedMeeting.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });
  
  it('应该能查询和更新会议', async () => {
    const teacherId = new mongoose.Types.ObjectId();
    const parentId = new mongoose.Types.ObjectId();
    const studentId = new mongoose.Types.ObjectId();
    
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    
    // 创建测试会议
    const meetingData = {
      title: '测试查询和更新',
      teacher: teacherId,
      parent: parentId,
      student: studentId,
      startTime,
      endTime
    };
    
    const meeting = new Meeting(meetingData);
    await meeting.save();
    
    // 查询会议
    const foundMeeting = await Meeting.findOne({ title: '测试查询和更新' });
    expect(foundMeeting).toBeDefined();
    expect(foundMeeting.title).toBe(meetingData.title);
    
    // 更新会议
    foundMeeting.status = '已确认';
    foundMeeting.location = '学校会议室';
    foundMeeting.meetingType = '线下';
    await foundMeeting.save();
    
    // 验证更新
    const updatedMeeting = await Meeting.findById(foundMeeting._id);
    expect(updatedMeeting.status).toBe('已确认');
    expect(updatedMeeting.location).toBe('学校会议室');
    expect(updatedMeeting.meetingType).toBe('线下');
  });
  
  it('应该能删除会议', async () => {
    const teacherId = new mongoose.Types.ObjectId();
    const parentId = new mongoose.Types.ObjectId();
    const studentId = new mongoose.Types.ObjectId();
    
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    
    // 创建测试会议
    const meetingData = {
      title: '测试删除',
      teacher: teacherId,
      parent: parentId,
      student: studentId,
      startTime,
      endTime
    };
    
    const meeting = new Meeting(meetingData);
    const savedMeeting = await meeting.save();
    
    // 删除会议
    await Meeting.findByIdAndDelete(savedMeeting._id);
    
    // 验证删除
    const deletedMeeting = await Meeting.findById(savedMeeting._id);
    expect(deletedMeeting).toBeNull();
  });
  
  it('应该能通过教师ID查询会议', async () => {
    const teacherId = new mongoose.Types.ObjectId();
    const parentId = new mongoose.Types.ObjectId();
    const studentId = new mongoose.Types.ObjectId();
    
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    
    // 创建多个测试会议
    const meetings = [
      {
        title: '会议1',
        teacher: teacherId,
        parent: parentId,
        student: studentId,
        startTime,
        endTime
      },
      {
        title: '会议2',
        teacher: new mongoose.Types.ObjectId(), // 不同的教师
        parent: parentId,
        student: studentId,
        startTime,
        endTime
      },
      {
        title: '会议3',
        teacher: teacherId,
        parent: parentId,
        student: studentId,
        startTime,
        endTime
      }
    ];
    
    // 保存所有会议
    await Meeting.insertMany(meetings);
    
    // 通过教师ID查询
    const foundMeetings = await Meeting.find({ teacher: teacherId });
    
    // 验证查询结果
    expect(foundMeetings).toHaveLength(2);
    expect(foundMeetings[0].teacher.toString()).toBe(teacherId.toString());
    expect(foundMeetings[1].teacher.toString()).toBe(teacherId.toString());
  });
  
  it('应该能通过状态查询会议', async () => {
    const teacherId = new mongoose.Types.ObjectId();
    const parentId = new mongoose.Types.ObjectId();
    const studentId = new mongoose.Types.ObjectId();
    
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    
    // 创建多个测试会议
    const meetings = [
      {
        title: '会议1',
        teacher: teacherId,
        parent: parentId,
        student: studentId,
        startTime,
        endTime,
        status: '待确认'
      },
      {
        title: '会议2',
        teacher: teacherId,
        parent: parentId,
        student: studentId,
        startTime,
        endTime,
        status: '已确认'
      },
      {
        title: '会议3',
        teacher: teacherId,
        parent: parentId,
        student: studentId,
        startTime,
        endTime,
        status: '已取消'
      }
    ];
    
    // 保存所有会议
    await Meeting.insertMany(meetings);
    
    // 通过状态查询
    const confirmedMeetings = await Meeting.find({ status: '已确认' });
    
    // 验证查询结果
    expect(confirmedMeetings).toHaveLength(1);
    expect(confirmedMeetings[0].status).toBe('已确认');
    expect(confirmedMeetings[0].title).toBe('会议2');
  });
});
