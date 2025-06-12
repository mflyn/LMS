import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Radio, message, Row, Col, Tabs } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, PhoneOutlined, UserAddOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const Register = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { register } = useAuth();
  const [loading, setLoading] = useState(false);
  const [registrationType, setRegistrationType] = useState('email');

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      // 根据注册类型构建用户数据
      const userData = {
        username: values.username,
        password: values.password,
        name: values.name,
        role: values.role
      };

      // 根据选择的注册类型添加邮箱或手机号
      if (registrationType === 'email') {
        userData.email = values.email;
      } else if (registrationType === 'phone') {
        userData.phone = values.phone;
      } else if (registrationType === 'mixed') {
        userData.email = values.email;
        userData.phone = values.phone;
      }

      const success = await register(userData);
      if (success) {
        message.success('注册成功！请登录');
        navigate('/login');
      }
    } catch (error) {
      console.error('注册错误:', error);
      message.error('注册失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (key) => {
    setRegistrationType(key);
    form.resetFields(['email', 'phone']);
  };

  const renderEmailForm = () => (
    <Form.Item
      name="email"
      rules={[
        { required: true, message: '请输入邮箱地址!' },
        { type: 'email', message: '请输入有效的邮箱地址!' }
      ]}
    >
      <Input 
        prefix={<MailOutlined />} 
        placeholder="邮箱地址" 
        size="large" 
      />
    </Form.Item>
  );

  const renderPhoneForm = () => (
    <Form.Item
      name="phone"
      rules={[
        { required: true, message: '请输入手机号码!' },
        { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号码!' }
      ]}
    >
      <Input 
        prefix={<PhoneOutlined />} 
        placeholder="手机号码" 
        size="large" 
      />
    </Form.Item>
  );

  const renderMixedForm = () => (
    <>
      <Form.Item
        name="email"
        rules={[
          { required: true, message: '请输入邮箱地址!' },
          { type: 'email', message: '请输入有效的邮箱地址!' }
        ]}
      >
        <Input 
          prefix={<MailOutlined />} 
          placeholder="邮箱地址" 
          size="large" 
        />
      </Form.Item>
      <Form.Item
        name="phone"
        rules={[
          { required: true, message: '请输入手机号码!' },
          { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号码!' }
        ]}
      >
        <Input 
          prefix={<PhoneOutlined />} 
          placeholder="手机号码" 
          size="large" 
        />
      </Form.Item>
    </>
  );

  return (
    <Row justify="center" align="middle" style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Col xs={22} sm={18} md={14} lg={10} xl={8}>
        <Card
          className="register-card"
          bordered={false}
          style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
        >
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <Title level={2}>用户注册</Title>
            <Text type="secondary">创建您的账号</Text>
          </div>
          
          <Form
            form={form}
            name="register"
            onFinish={handleSubmit}
            layout="vertical"
            initialValues={{ role: 'student' }}
          >
            {/* 注册方式选择 */}
            <div style={{ marginBottom: 16 }}>
              <Text strong>选择注册方式：</Text>
              <Tabs activeKey={registrationType} onChange={handleTabChange} centered>
                <TabPane tab="邮箱注册" key="email">
                  {renderEmailForm()}
                </TabPane>
                <TabPane tab="手机号注册" key="phone">
                  {renderPhoneForm()}
                </TabPane>
                <TabPane tab="邮箱+手机号" key="mixed">
                  {renderMixedForm()}
                </TabPane>
              </Tabs>
            </div>

            {/* 基本信息 */}
            <Form.Item
              name="username"
              rules={[
                { required: true, message: '请输入用户名!' },
                { min: 3, max: 20, message: '用户名长度必须在3-20个字符之间!' },
                { pattern: /^[a-zA-Z0-9_]+$/, message: '用户名只能包含字母、数字和下划线!' }
              ]}
            >
              <Input 
                prefix={<UserOutlined />} 
                placeholder="用户名" 
                size="large" 
              />
            </Form.Item>

            <Form.Item
              name="name"
              rules={[
                { required: true, message: '请输入真实姓名!' },
                { min: 2, max: 10, message: '姓名长度必须在2-10个字符之间!' }
              ]}
            >
              <Input 
                prefix={<UserAddOutlined />} 
                placeholder="真实姓名" 
                size="large" 
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[
                { required: true, message: '请输入密码!' },
                { min: 8, message: '密码长度至少为8个字符!' }
              ]}
            >
              <Input.Password 
                prefix={<LockOutlined />} 
                placeholder="密码" 
                size="large" 
              />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              dependencies={['password']}
              rules={[
                { required: true, message: '请确认密码!' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('两次输入的密码不一致!'));
                  },
                }),
              ]}
            >
              <Input.Password 
                prefix={<LockOutlined />} 
                placeholder="确认密码" 
                size="large" 
              />
            </Form.Item>

            {/* 角色选择 */}
            <Form.Item
              name="role"
              rules={[{ required: true, message: '请选择用户角色!' }]}
            >
              <Radio.Group buttonStyle="solid" style={{ width: '100%', textAlign: 'center' }}>
                <Radio.Button value="student">学生</Radio.Button>
                <Radio.Button value="parent">家长</Radio.Button>
                <Radio.Button value="teacher">教师</Radio.Button>
              </Radio.Group>
            </Form.Item>

            <Form.Item>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={loading} 
                block
                size="large"
              >
                注册
              </Button>
            </Form.Item>
            
            <div style={{ textAlign: 'center' }}>
              <Text>已有账号？</Text>
              <Link to="/login" style={{ marginLeft: 8 }}>立即登录</Link>
            </div>
          </Form>
        </Card>
      </Col>
    </Row>
  );
};

export default Register; 