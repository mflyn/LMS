import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Form, 
  Button, 
  Table, 
  Tag, 
  Modal, 
  Input, 
  Tabs, 
  Row, 
  Col,
  Upload,
  Select,
  message,
  Spin,
  Space
} from 'antd';
import { UploadOutlined, DownloadOutlined, EyeOutlined, SearchOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

const { Option } = Select;
const { TextArea } = Input;

const Resources = () => {
  const { currentUser } = useAuth();
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('browse');
  
  // 搜索筛选状态
  const [filters, setFilters] = useState({
    subject: '',
    grade: '',
    type: '',
    keyword: ''
  });

  // 模拟数据
  const mockResources = [
    {
      id: 1,
      title: '小学数学基础教案',
      description: '适合一年级学生的数学基础知识教案',
      subject: '数学',
      grade: '一年级',
      type: '教案',
      uploader: { name: '张老师' },
      createdAt: '2024-01-15',
      downloads: 156
    },
    {
      id: 2,
      title: '语文阅读理解练习',
      description: '提高学生阅读理解能力的练习题集',
      subject: '语文',
      grade: '二年级',
      type: '习题',
      uploader: { name: '李老师' },
      createdAt: '2024-01-10',
      downloads: 89
    }
  ];

  useEffect(() => {
    setResources(mockResources);
  }, []);

  const columns = [
    {
      title: '资源名称',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '学科',
      dataIndex: 'subject',
      key: 'subject',
      render: (subject) => <Tag color="blue">{subject}</Tag>
    },
    {
      title: '年级',
      dataIndex: 'grade',
      key: 'grade',
      render: (grade) => <Tag color="green">{grade}</Tag>
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => <Tag color="orange">{type}</Tag>
    },
    {
      title: '上传者',
      dataIndex: ['uploader', 'name'],
      key: 'uploader',
    },
    {
      title: '下载次数',
      dataIndex: 'downloads',
      key: 'downloads',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button 
            type="link" 
            icon={<EyeOutlined />}
            onClick={() => handleViewResource(record)}
          >
            查看
          </Button>
          <Button 
            type="link" 
            icon={<DownloadOutlined />}
            onClick={() => handleDownloadResource(record)}
          >
            下载
          </Button>
        </Space>
      ),
    },
  ];

  const handleViewResource = (resource) => {
    message.info(`查看资源: ${resource.title}`);
  };

  const handleDownloadResource = (resource) => {
    message.success(`开始下载: ${resource.title}`);
  };

  const handleSearch = () => {
    setLoading(true);
    // 模拟搜索
    setTimeout(() => {
      setLoading(false);
      message.success('搜索完成');
    }, 1000);
  };

  const tabItems = [
    {
      key: 'browse',
      label: '浏览资源',
      children: (
        <div>
          <Card title="搜索筛选" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={6}>
                <Select
                  placeholder="选择学科"
                  style={{ width: '100%' }}
                  value={filters.subject}
                  onChange={(value) => setFilters({...filters, subject: value})}
                >
                  <Option value="">全部学科</Option>
                  <Option value="语文">语文</Option>
                  <Option value="数学">数学</Option>
                  <Option value="英语">英语</Option>
                </Select>
              </Col>
              <Col span={6}>
                <Select
                  placeholder="选择年级"
                  style={{ width: '100%' }}
                  value={filters.grade}
                  onChange={(value) => setFilters({...filters, grade: value})}
                >
                  <Option value="">全部年级</Option>
                  <Option value="一年级">一年级</Option>
                  <Option value="二年级">二年级</Option>
                  <Option value="三年级">三年级</Option>
                </Select>
              </Col>
              <Col span={6}>
                <Input
                  placeholder="关键词搜索"
                  value={filters.keyword}
                  onChange={(e) => setFilters({...filters, keyword: e.target.value})}
                />
              </Col>
              <Col span={6}>
                <Button 
                  type="primary" 
                  icon={<SearchOutlined />}
                  onClick={handleSearch}
                  loading={loading}
                >
                  搜索
                </Button>
              </Col>
            </Row>
          </Card>
          
          <Card title="资源列表">
            <Table
              columns={columns}
              dataSource={resources}
              rowKey="id"
              loading={loading}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
              }}
            />
          </Card>
        </div>
      )
    },
    {
      key: 'upload',
      label: '上传资源',
      children: (
        <Card title="上传新资源">
          <Form layout="vertical">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="资源标题" required>
                  <Input placeholder="请输入资源标题" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="学科" required>
                  <Select placeholder="请选择学科">
                    <Option value="语文">语文</Option>
                    <Option value="数学">数学</Option>
                    <Option value="英语">英语</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="年级" required>
                  <Select placeholder="请选择年级">
                    <Option value="一年级">一年级</Option>
                    <Option value="二年级">二年级</Option>
                    <Option value="三年级">三年级</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="资源类型" required>
                  <Select placeholder="请选择类型">
                    <Option value="教案">教案</Option>
                    <Option value="习题">习题</Option>
                    <Option value="课件">课件</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="资源描述">
              <TextArea rows={4} placeholder="请输入资源描述" />
            </Form.Item>
            <Form.Item label="上传文件" required>
              <Upload>
                <Button icon={<UploadOutlined />}>选择文件</Button>
              </Upload>
            </Form.Item>
            <Form.Item>
              <Button type="primary" size="large">
                上传资源
              </Button>
            </Form.Item>
          </Form>
        </Card>
      )
    },
    {
      key: 'collections',
      label: '我的收藏',
      children: (
        <Card title="我的收藏">
          <p>暂无收藏的资源</p>
        </Card>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
        items={tabItems}
      />
    </div>
  );
};

export default Resources; 