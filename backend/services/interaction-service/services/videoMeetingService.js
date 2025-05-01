/**
 * 视频会议服务
 * 
 * 这个服务负责与视频会议API进行交互，例如创建会议、结束会议、获取会议状态等。
 * 在实际应用中，这个服务会与第三方视频会议平台（如Zoom、腾讯会议等）集成。
 * 
 * 目前这是一个模拟实现，用于测试。
 */

/**
 * 创建视频会议
 * @param {Object} meetingInfo 会议信息
 * @returns {Promise<Object>} 创建的会议信息
 */
async function createMeeting(meetingInfo) {
  // 模拟API调用延迟
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // 生成随机会议ID
  const meetingId = Math.random().toString(36).substring(2, 10);
  
  return {
    id: meetingId,
    joinUrl: `https://example.com/join/${meetingId}`,
    hostUrl: `https://example.com/host/${meetingId}`,
    password: Math.random().toString(36).substring(2, 8),
    topic: meetingInfo.topic,
    duration: meetingInfo.duration || 60,
    host: meetingInfo.host
  };
}

/**
 * 结束视频会议
 * @param {string} meetingId 会议ID
 * @returns {Promise<boolean>} 是否成功结束会议
 */
async function endMeeting(meetingId) {
  // 模拟API调用延迟
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // 模拟成功结束会议
  return true;
}

/**
 * 获取会议状态
 * @param {string} meetingId 会议ID
 * @returns {Promise<Object>} 会议状态信息
 */
async function getMeetingStatus(meetingId) {
  // 模拟API调用延迟
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // 模拟会议状态
  const statuses = ['waiting', 'in_progress', 'ended'];
  const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
  
  return {
    status: randomStatus,
    participants: Math.floor(Math.random() * 10),
    duration: Math.floor(Math.random() * 60),
    startTime: new Date(Date.now() - Math.floor(Math.random() * 3600000))
  };
}

module.exports = {
  createMeeting,
  endMeeting,
  getMeetingStatus
};
