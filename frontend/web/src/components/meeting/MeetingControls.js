import React from 'react';
import { Button, Tooltip } from 'antd';
import {
  AudioOutlined,
  AudioMutedOutlined,
  VideoCameraOutlined,
  VideoCameraAddOutlined,
  ShareAltOutlined,
  FullscreenOutlined,
  SettingOutlined,
  CloseOutlined,
} from '@ant-design/icons';

const MeetingControls = ({
  isAudioMuted,
  isVideoOff,
  isScreenSharing,
  isFullScreen,
  toggleAudio,
  toggleVideo,
  toggleScreenSharing,
  toggleFullScreen,
  onShowSettings, // Assuming a new prop for settings modal
  endMeeting,
}) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '16px' }}>
      <Tooltip title={isAudioMuted ? '取消静音' : '静音'}>
        <Button
          type="primary"
          shape="circle"
          icon={isAudioMuted ? <AudioMutedOutlined /> : <AudioOutlined />}
          onClick={toggleAudio}
          danger={isAudioMuted}
        />
      </Tooltip>
      <Tooltip title={isVideoOff ? '开启视频' : '关闭视频'}>
        <Button
          type="primary"
          shape="circle"
          icon={isVideoOff ? <VideoCameraAddOutlined /> : <VideoCameraOutlined />}
          onClick={toggleVideo}
          danger={isVideoOff}
        />
      </Tooltip>
      <Tooltip title={isScreenSharing ? '停止共享' : '屏幕共享'}>
        <Button
          type="primary"
          shape="circle"
          icon={<ShareAltOutlined />}
          onClick={toggleScreenSharing}
          danger={isScreenSharing} // Corrected: should be danger={isScreenSharing} if active
        />
      </Tooltip>
      <Tooltip title={isFullScreen ? '退出全屏' : '全屏'}>
        <Button
          type="primary"
          shape="circle"
          icon={<FullscreenOutlined />}
          onClick={toggleFullScreen}
        />
      </Tooltip>
      <Tooltip title="设置">
        <Button
          type="primary"
          shape="circle"
          icon={<SettingOutlined />}
          onClick={onShowSettings} // Connect to a settings modal later
        />
      </Tooltip>
      <Tooltip title="结束会议">
        <Button
          type="primary"
          shape="circle"
          icon={<CloseOutlined />}
          danger
          onClick={endMeeting}
        />
      </Tooltip>
    </div>
  );
};

export default MeetingControls; 