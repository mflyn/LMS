import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Radio, message, Row, Col } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

const Login = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [userType, setUserType] = useState('student');

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      // 在实际登录请求中，可能需要传递用户类型
      const success = await login(values.username, values.password);
      if (success) {
        // 根据用户类型导航到不同的仪表盘
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('登录错误:', error);
      message.error('登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  const handleUserTypeChange = (e) => {
    setUserType(e.target.value);
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