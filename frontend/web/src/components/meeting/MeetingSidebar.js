import React from 'react';
import { Card, List, Avatar, Input, Button, Tabs, Empty } from 'antd';
import { UserOutlined, MessageOutlined, SendOutlined } from '@ant-design/icons';

const { TabPane } = Tabs;
const { TextArea } = Input;

const MeetingSidebar = ({
  participants,
  chatMessages,
  newMessage,
  onNewMessageChange,
  onSendMessage,
  currentUserId // Needed to identify user's own messages for styling, assuming '1' for now
}) => {
  return (
    <Card
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      bodyStyle={{ flexGrow: 1, overflow: 'hidden', padding: 0 }}
      tabList={[
        { key: 'participants', tab: <><UserOutlined /> 参与者 ({participants.length})</> },
        { key: 'chat', tab: <><MessageOutlined /> 聊天</> },
      ]}
      activeTabKey="participants" // Default active tab, can be made dynamic if needed
      // onTabChange={key => setActiveTabKey(key)} // Handler if tab switching is needed
    >
      {/* Using Tabs component directly for content to better manage overflow */}
      <Tabs defaultActiveKey="participants" style={{ height: '100%', display: 'flex', flexDirection: 'column' }} tabBarGutter={0}>
        <TabPane tab="participants_content" key="participants" style={{ flexGrow: 1, overflowY: 'auto', padding: '16px' }}>
          {participants.length > 0 ? (
            <List
              dataSource={participants}
              renderItem={participant => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar icon={<UserOutlined />} />}
                    title={participant.name}
                    description={participant.isHost ? '主持人' : participant.role}
                  />
                </List.Item>
              )}
            />
          ) : (
            <Empty description="暂无其他参与者" />
          )}
        </TabPane>
        <TabPane tab="chat_content" key="chat" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '16px' }}>
          <div style={{ flexGrow: 1, overflowY: 'auto', marginBottom: '16px' }}>
            {chatMessages.length === 0 ? (
              <Empty description="暂无聊天消息" />
            ) : (
              chatMessages.map(msg => (
                <div 
                  key={msg.id} 
                  style={{
                    textAlign: msg.sender.id === currentUserId ? 'right' : 'left',
                    marginBottom: '8px',
                  }}
                >
                  <div 
                    style={{
                      display: 'inline-block',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: msg.sender.id === currentUserId ? '#1890ff' : '#f0f0f0',
                      color: msg.sender.id === currentUserId ? '#fff' : '#000',
                      maxWidth: '80%',
                    }}
                  >
                    <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '4px' }}>
                      {msg.sender.name} ({msg.timestamp})
                    </div>
                    <div>{msg.content}</div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Input.Search
              placeholder="输入消息..."
              value={newMessage}
              onChange={onNewMessageChange}
              enterButton={<Button type="primary" icon={<SendOutlined />} disabled={!newMessage.trim()} onClick={onSendMessage}/>}
              onSearch={onSendMessage} // Allow sending with Enter key on Search component
            />
          </div>
        </TabPane>
      </Tabs>
    </Card>
  );
};

export default MeetingSidebar; 