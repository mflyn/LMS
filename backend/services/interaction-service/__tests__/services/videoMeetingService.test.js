/**
 * 视频会议服务单元测试
 */

const videoMeetingService = require('../../services/videoMeetingService');

describe('视频会议服务测试', () => {
  // 测试创建会议功能
  describe('createMeeting', () => {
    it('应该创建一个新的视频会议', async () => {
      const meetingInfo = {
        topic: '测试会议',
        duration: 30,
        host: 'test-host'
      };

      const result = await videoMeetingService.createMeeting(meetingInfo);

      // 验证返回的会议信息
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('joinUrl');
      expect(result).toHaveProperty('hostUrl');
      expect(result).toHaveProperty('password');
      expect(result.topic).toBe(meetingInfo.topic);
      expect(result.duration).toBe(meetingInfo.duration);
      expect(result.host).toBe(meetingInfo.host);
    });

    it('应该使用默认持续时间', async () => {
      const meetingInfo = {
        topic: '测试会议',
        host: 'test-host'
        // 没有提供duration
      };

      const result = await videoMeetingService.createMeeting(meetingInfo);

      // 验证使用了默认持续时间
      expect(result.duration).toBe(60); // 默认值为60分钟
    });

    it('应该生成唯一的会议ID', async () => {
      const meetingInfo = {
        topic: '测试会议',
        host: 'test-host'
      };

      // 创建两个会议
      const result1 = await videoMeetingService.createMeeting(meetingInfo);
      const result2 = await videoMeetingService.createMeeting(meetingInfo);

      // 验证两次生成的会议ID不同
      expect(result1.id).not.toBe(result2.id);
    });
  });

  // 测试结束会议功能
  describe('endMeeting', () => {
    it('应该成功结束会议', async () => {
      const meetingId = 'test-meeting-id';

      const result = await videoMeetingService.endMeeting(meetingId);

      // 验证结束会议成功
      expect(result).toBe(true);
    });
  });

  // 测试获取会议状态功能
  describe('getMeetingStatus', () => {
    it('应该返回会议状态信息', async () => {
      const meetingId = 'test-meeting-id';

      const result = await videoMeetingService.getMeetingStatus(meetingId);

      // 验证返回的会议状态信息
      expect(result).toHaveProperty('status');
      expect(['waiting', 'in_progress', 'ended']).toContain(result.status);
      expect(result).toHaveProperty('participants');
      expect(typeof result.participants).toBe('number');
      expect(result).toHaveProperty('duration');
      expect(typeof result.duration).toBe('number');
      expect(result).toHaveProperty('startTime');
      expect(result.startTime instanceof Date).toBe(true);
    });
  });
});
