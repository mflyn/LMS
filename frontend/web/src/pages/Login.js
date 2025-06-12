import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Radio, message, Row, Col, Tabs } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, PhoneOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const Login = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { login, loginWithEmailOrPhone } = useAuth();
  const [loading, setLoading] = useState(false);
  const [userType, setUserType] = useState('student');
  const [loginType, setLoginType] = useState('username');

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      let success = false;
      
      if (loginType === 'username') {
        // 用户名登录
        success = await login(values.username, values.password, values.userType);
      } else {
        // 邮箱或手机号登录
        success = await loginWithEmailOrPhone(values.identifier, values.password);
      }
      
      if (success) {
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('登录错误:', error);
      message.error('登录失败，请检查登录信息');
    } finally {
      setLoading(false);
    }
  };

  const handleUserTypeChange = (e) => {
    setUserType(e.target.value);
  };

  const handleLoginTypeChange = (key) => {
    setLoginType(key);
    form.resetFields(['username', 'identifier']);
  };

  return (
    <Row justify="center" align="middle" style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Col xs={22} sm={16} md={12} lg={8} xl={6}>
        <Card
          className="login-card"
          bordered={false}
          style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
        >
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <Title level={2}>小学生学习追踪系统</Title>
            <Text type="secondary">请登录您的账号</Text>
          </div>
          
          <Form
            form={form}
            name="login"
            onFinish={handleSubmit}
            layout="vertical"
          >
            {/* 登录方式选择 */}
            <Tabs activeKey={loginType} onChange={handleLoginTypeChange} centered style={{ marginBottom: 16 }}>
              <TabPane tab="用户名登录" key="username">
                <Form.Item
                  name="username"
                  rules={[{ required: true, message: '请输入用户名!' }]}
                >
                  <Input 
                    prefix={<UserOutlined />} 
                    placeholder="用户名" 
                    size="large" 
                  />
                </Form.Item>
              </TabPane>
              <TabPane tab="邮箱/手机号登录" key="identifier">
                <Form.Item
                  name="identifier"
                  rules={[
                    { required: true, message: '请输入邮箱或手机号!' },
                    {
                      validator: (_, value) => {
                        if (!value) return Promise.resolve();
                        const isEmail = /^\S+@\S+\.\S+$/.test(value);
                        const isPhone = /^1[3-9]\d{9}$/.test(value);
                        if (isEmail || isPhone) {
                          return Promise.resolve();
                        }
                        return Promise.reject(new Error('请输入有效的邮箱地址或手机号码!'));
                      }
                    }
                  ]}
                >
                  <Input 
                    prefix={<MailOutlined />} 
                    placeholder="邮箱地址或手机号码" 
                    size="large" 
                  />
                </Form.Item>
              </TabPane>
            </Tabs>

            {/* 用户类型选择（仅用户名登录时显示） */}
            {loginType === 'username' && (
              <Form.Item
                name="userType"
                initialValue={userType}
              >
                <Radio.Group onChange={handleUserTypeChange} value={userType} buttonStyle="solid" style={{ width: '100%', textAlign: 'center', marginBottom: 16 }}>
                  <Radio.Button value="student">学生</Radio.Button>
                  <Radio.Button value="parent">家长</Radio.Button>
                  <Radio.Button value="teacher">教师</Radio.Button>
                  <Radio.Button value="admin">管理员</Radio.Button>
                </Radio.Group>
              </Form.Item>
            )}

            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码!' }]}
            >
              <Input.Password 
                prefix={<LockOutlined />} 
                placeholder="密码" 
                size="large" 
              />
            </Form.Item>

            <Form.Item>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={loading} 
                block
                size="large"
              >
                登录
              </Button>
            </Form.Item>
            
            <div style={{ textAlign: 'center' }}>
              <Link to="/forgot-password">忘记密码?</Link>
              <span style={{ margin: '0 8px' }}>|</span>
              <Link to="/register">注册账号</Link>
            </div>
          </Form>
        </Card>
      </Col>
    </Row>
  );
};

export default Login;