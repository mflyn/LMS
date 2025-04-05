import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Table, Badge, Modal, InputGroup, FormControl, Tabs, Tab } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import ResourcePreview from '../components/resources/ResourcePreview';
import axios from 'axios';

const Resources = () => {
  const { currentUser } = useAuth();
  const [resources, setResources] = useState([]);
  const [myCollections, setMyCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('browse');
  
  // 搜索筛选状态
  const [filters, setFilters] = useState({
    subject: '',
    grade: '',
    type: '',
    keyword: ''
  });
  
  // 新资源上传表单状态
  const [newResource, setNewResource] = useState({
    title: '',
    description: '',
    subject: '语文',
    grade: '一年级',
    type: '教案',
    tags: '',
    file: null
  });
  
  // 收藏资源表单状态
  const [collectionForm, setCollectionForm] = useState({
    resourceId: '',
    collectionName: '默认收藏夹',
    notes: ''
  });
  
  // 模态框状态
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedResource, setSelectedResource] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [resourceRatings, setResourceRatings] = useState({});
  const [recommendedResources, setRecommendedResources] = useState([]);
  
  // 获取资源列表
  const fetchResources = async () => {
    try {
      const response = await axios.get('/api/resources', {
        params: {
          subject: filters.subject || undefined,
          grade: filters.grade || undefined,
          type: filters.type || undefined,
          keyword: filters.keyword || undefined,
          limit: 20
        }
      });
      setResources(response.data.data);
    } catch (error) {
      console.error('获取资源列表失败:', error);
    }
  };
  
  // 获取我的收藏
  const fetchMyCollections = async () => {
    try {
      const response = await axios.get('/api/resources/collections/my', {
        params: { userId: currentUser.id }
      });
      setMyCollections(response.data.data);
    } catch (error) {
      console.error('获取收藏列表失败:', error);
    }
  };
  
  // 上传资源
  const handleUploadResource = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('title', newResource.title);
      formData.append('description', newResource.description);
      formData.append('subject', newResource.subject);
      formData.append('grade', newResource.grade);
      formData.append('type', newResource.type);
      formData.append('tags', newResource.tags.split(',').map(tag => tag.trim()));
      formData.append('file', newResource.file);
      formData.append('uploader', currentUser.id);
      
      await axios.post('/api/resources', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setShowUploadModal(false);
      setNewResource({
        title: '',
        description: '',
        subject: '语文',
        grade: '一年级',
        type: '教案',
        tags: '',
        file: null
      });
      fetchResources();
    } catch (error) {
      console.error('上传资源失败:', error);
    }
  };
  
  // 收藏资源
  const handleCollectResource = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/resources/collections', {
        user: currentUser.id,
        resource: collectionForm.resourceId,
        collectionName: collectionForm.collectionName,
        notes: collectionForm.notes
      });
      
      setShowCollectionModal(false);
      setCollectionForm({
        resourceId: '',
        collectionName: '默认收藏夹',
        notes: ''
      });
      fetchMyCollections();
    } catch (error) {
      console.error('收藏资源失败:', error);
    }
  };
  
  // 下载资源
  const handleDownloadResource = async (resourceId) => {
    try {
      const response = await axios.get(`/api/resources/${resourceId}/download`, {
        responseType: 'blob'
      });
      
      // 创建下载链接
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', response.headers['content-disposition'].split('filename=')[1]);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('下载资源失败:', error);
    }
  };
  
  // 查看资源详情
  const handleViewResourceDetail = (resource) => {
    setSelectedResource(resource);
    setShowDetailModal(true);
    
    // 在实际项目中，这里应该调用API获取资源评分和推荐资源
    // 模拟获取资源评分
    if (!resourceRatings[resource._id]) {
      const mockRating = {
        averageRating: (Math.random() * 2 + 3).toFixed(1), // 3.0-5.0之间的随机评分
        totalRatings: Math.floor(Math.random() * 100) + 10, // 10-110之间的随机评分数
        userRating: 0 // 当前用户的评分，初始为0
      };
      setResourceRatings(prev => ({ ...prev, [resource._id]: mockRating }));
    }
    
    // 模拟获取推荐资源
    const mockRecommended = [
      { 
        _id: 'rec1', 
        title: `与"${resource.title}"相关的资源1`, 
        subject: resource.subject, 
        grade: resource.grade, 
        type: '文档',
        uploader: { name: '李老师' },
        createdAt: new Date().toISOString()
      },
      { 
        _id: 'rec2', 
        title: `${resource.subject}进阶学习资料`, 
        subject: resource.subject, 
        grade: resource.grade, 
        type: '视频',
        uploader: { name: '王老师' },
        createdAt: new Date().toISOString()
      },
      { 
        _id: 'rec3', 
        title: `${resource.grade}${resource.subject}综合练习`, 
        subject: resource.subject, 
        grade: resource.grade, 
        type: '习题',
        uploader: { name: '张老师' },
        createdAt: new Date().toISOString()
      }
    ];
    setRecommendedResources(mockRecommended);
  };
  
  // 预览资源
  const handlePreviewResource = (resource) => {
    setSelectedResource(resource);
    setShowPreviewModal(true);
  };
  
  // 处理文件选择
  const handleFileChange = (e) => {
    setNewResource({
      ...newResource,
      file: e.target.files[0]
    });
  };
  
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        if (activeTab === 'browse') {
          await fetchResources();
        } else if (activeTab === 'myCollections') {
          await fetchMyCollections();
        }
      } catch (error) {
        console.error('加载数据失败:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [activeTab, currentUser]);
  
  // 当筛选条件变化时重新获取资源
  useEffect(() => {
    if (activeTab === 'browse') {
      fetchResources();
    }
  }, [filters]);
  
  return (
    <Container className="py-4">
      <h2 className="mb-4">学习资源</h2>
      
      <Tabs
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k)}
        className="mb-4"
      >
        <Tab eventKey="browse" title="浏览资源">
          <Card className="mb-4">
            <Card.Header>
              <h5 className="mb-0">资源筛选</h5>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col md={3}>
                  <Form.Group className="mb-3">
                    <Form.Label>学科</Form.Label>
                    <Form.Select 
                      value={filters.subject}
                      onChange={(e) => setFilters({...filters, subject: e.target.value})}
                    >
                      <option value="">全部</option>
                      <option value="语文">语文</option>
                      <option value="数学">数学</option>
                      <option value="英语">英语</option>
                      <option value="科学">科学</option>
                      <option value="社会">社会</option>
                      <option value="音乐">音乐</option>
                      <option value="美术">美术</option>
                      <option value="体育">体育</option>
                      <option value="综合">综合</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-3">
                    <Form.Label>年级</Form.Label>
                    <Form.Select 
                      value={filters.grade}
                      onChange={(e) => setFilters({...filters, grade: e.target.value})}
                    >
                      <option value="">全部</option>
                      <option value="一年级">一年级</option>
                      <option value="二年级">二年级</option>
                      <option value="三年级">三年级</option>
                      <option value="四年级">四年级</option>
                      <option value="五年级">五年级</option>
                      <option value="六年级">六年级</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-3">
                    <Form.Label>类型</Form.Label>
                    <Form.Select 
                      value={filters.type}
                      onChange={(e) => setFilters({...filters, type: e.target.value})}
                    >
                      <option value="">全部</option>
                      <option value="教案">教案</option>
                      <option value="课件">课件</option>
                      <option value="习题">习题</option>
                      <option value="视频">视频</option>
                      <option value="音频">音频</option>
                      <option value="图片">图片</option>
                      <option value="文档">文档</option>
                      <option value="其他">其他</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-3">
                    <Form.Label>关键词</Form.Label>
                    <InputGroup>
                      <FormControl 
                        placeholder="搜索资源" 
                        value={filters.keyword}
                        onChange={(e) => setFilters({...filters, keyword: e.target.value})}
                      />
                      <Button variant="outline-secondary">
                        搜索
                      </Button>
                    </InputGroup>
                  </Form.Group>
                </Col>
              </Row>
            </Card.Body>
          </Card>
          
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0">资源列表</h5>
              {currentUser.role === 'teacher' && (
                <Button variant="primary" size="sm" onClick={() => setShowUploadModal(true)}>
                  上传资源
                </Button>
              )}
            </Card.Header>
            <Card.Body>
              {loading ? (
                <p>加载中...</p>
              ) : resources.length > 0 ? (
                <Table hover responsive>
                  <thead>
                    <tr>
                      <th>标题</th>
                      <th>学科</th>
                      <th>年级</th>
                      <th>类型</th>
                      <th>上传者</th>
                      <th>上传时间</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resources.map((resource) => (
                      <tr key={resource._id}>
                        <td>{resource.title}</td>
                        <td>{resource.subject}</td>
                        <td>{resource.grade}</td>
                        <td>{resource.type}</td>
                        <td>{resource.uploader.name}</td>
                        <td>{new Date(resource.createdAt).toLocaleDateString()}</td>
                        <td>
                          <Button 
                            variant="outline-primary" 
                            size="sm" 
                            className="me-1"
                            onClick={() => handleViewResourceDetail(resource)}
                          >
                            详情
                          </Button>
                          <Button 
                            variant="outline-success" 
                            size="sm" 
                            className="me-1"
                            onClick={() => {
                              setCollectionForm({...collectionForm, resourceId: resource._id});
                              setShowCollectionModal(true);
                            }}
                          >
                            收藏
                          </Button>
                          <Button 
                            variant="outline-warning" 
                            size="sm" 
                            className="me-1"
                            onClick={() => handlePreviewResource(resource)}
                          >
                            预览
                          </Button>
                          <Button 
                            variant="outline-info" 
                            size="sm"
                            onClick={() => handleDownloadResource(resource._id)}
                          >
                            下载
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <p className="text-center">暂无资源</p>
              )}
            </Card.Body>
          </Card>
        </Tab>
        
        <Tab eventKey="myCollections" title="我的收藏">
          <Card>
            <Card.Header>
              <h5 className="mb-0">我的收藏夹</h5>
            </Card.Header>
            <Card.Body>
              {loading ? (
                <p>加载中...</p>
              ) : myCollections.length > 0 ? (
                <Table hover responsive>
                  <thead>
                    <tr>
                      <th>资源标题</th>
                      <th>收藏夹</th>
                      <th>备注</th>
                      <th>收藏时间</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myCollections.map((collection) => (
                      <tr key={collection._id}>
                        <td>{collection.resource.title}</td>
                        <td>{collection.collectionName}</td>
                        <td>{collection.notes}</td>
                        <td>{new Date(collection.createdAt).toLocaleDateString()}</td>
                        <td>
                          <Button 
                            variant="outline-primary" 
                            size="sm" 
                            className="me-1"
                            onClick={() => handleViewResourceDetail(collection.resource)}
                          >
                            详情
                          </Button>
                          <Button 
                            variant="outline-info" 
                            size="sm"
                            onClick={() => handleDownloadResource(collection.resource._id)}
                          >
                            下载
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <p className="text-center">暂无收藏</p>
              )}
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>
      
      {/* 上传资源模态框 */}
      <Modal show={showUploadModal} onHide={() => setShowUploadModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>上传资源</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleUploadResource}>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>标题</Form.Label>
                  <Form.Control 
                    type="text" 
                    placeholder="请输入资源标题" 
                    value={newResource.title}
                    onChange={(e) => setNewResource({...newResource, title: e.target.value})}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>标签</Form.Label>
                  <Form.Control 
                    type="text" 
                    placeholder="请输入标签，用逗号分隔" 
                    value={newResource.tags}
                    onChange={(e) => setNewResource({...newResource, tags: e.target.value})}
                  />
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>学科</Form.Label>
                  <Form.Select 
                    value={newResource.subject}
                    onChange={(e) => setNewResource({...newResource, subject: e.target.value})}
                    required
                  >
                    <option value="语文">语文</option>
                    <option value="数学">数学</option>
                    <option value="英语">英语</option>
                    <option value="科学">科学</option>
                    <option value="社会">社会</option>
                    <option value="音乐">音乐</option>
                    <option value="美术">美术</option>
                    <option value="体育">体育</option>
                    <option value="综合">综合</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>年级</Form.Label>
                  <Form.Select 
                    value={newResource.grade}
                    onChange={(e) => setNewResource({...newResource, grade: e.target.value})}
                    required
                  >
                    <option value="一年级">一年级</option>
                    <option value="二年级">二年级</option>
                    <option value="三年级">三年级</option>
                    <option value="四年级">四年级</option>
                    <option value="五年级">五年级</option>
                    <option value="六年级">六年级</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>类型</Form.Label>
                  <Form.Select 
                    value={newResource.type}
                    onChange={(e) => setNewResource({...newResource, type: e.target.value})}
                    required
                  >
                    <option value="教案">教案</option>
                    <option value="课件">课件</option>
                    <option value="习题">习题</option>
                    <option value="视频">视频</option>
                    <option value="音频">音频</option>
                    <option value="图片">图片</option>
                    <option value="文档">文档</option>
                    <option value="其他">其他</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
            <Form.Group className="mb-3">
              <Form.Label>描述</Form.Label>
              <Form.Control 
                as="textarea" 
                rows={3} 
                placeholder="请输入资源描述" 
                value={newResource.description}
                onChange={(e) => setNewResource({...newResource, description: e.target.value})}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>文件</Form.Label>
              <Form.Control 
                type="file" 
                onChange={handleFileChange}
                required
              />
            </Form.Group>
            <div className="d-flex justify-content-end">
              <Button variant="secondary" className="me-2" onClick={() => setShowUploadModal(false)}>
                取消
              </Button>
              <Button variant="primary" type="submit">
                上传
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
      
      {/* 收藏资源模态框 */}
      <Modal show={showCollectionModal} onHide={() => setShowCollectionModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>收藏资源</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleCollectResource}>
            <Form.Group className="mb-3">
              <Form.Label>收藏夹</Form.Label>
              <Form.Control 
                type="text" 
                placeholder="请输入收藏夹名称" 
                value={collectionForm.collectionName}
                onChange={(e) => setCollectionForm({...collectionForm, collectionName: e.target.value})}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>备注</Form.Label>
              <Form.Control 
                as="textarea" 
                rows={3} 
                placeholder="请输入备注" 
                value={collectionForm.notes}
                onChange={(e) => setCollectionForm({...collectionForm, notes: e.target.value})}
              />
            </Form.Group>
            <div className="d-flex justify-content-end">
              <Button variant="secondary" className="me-2" onClick={() => setShowCollectionModal(false)}>
                取消
              </Button>
              <Button variant="primary" type="submit">
                收藏
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
      
      {/* 资源详情模态框 */}
      <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>资源详情</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedResource && (
            <div>
              <h5>{selectedResource.title}</h5>
              <p className="text-muted">
                <small>
                  上传者: {selectedResource.uploader.name} | 
                  上传时间: {new Date(selectedResource.createdAt).toLocaleString()}
                </small>
              </p>
              <hr />
              <Row>
                <Col md={4}>
                  <p><strong>学科:</strong> {selectedResource.subject}</p>
                </Col>
                <Col md={4}>
                  <p><strong>年级:</strong> {selectedResource.grade}</p>
                </Col>
                <Col md={4}>
                  <p><strong>类型:</strong> {selectedResource.type}</p>
                </Col>
              </Row>
              <p><strong>描述:</strong></p>
              <p>{selectedResource.description || '暂无描述'}</p>
              
              {/* 资源评分 */}
              {resourceRatings[selectedResource._id] && (
                <div className="mt-3">
                  <h6>资源评分</h6>
                  <div className="d-flex align-items-center mb-2">
                    <div className="me-3">
                      <span style={{ fontSize: '24px', fontWeight: 'bold' }}>
                        {resourceRatings[selectedResource._id].averageRating}
                      </span>
                      <span className="text-muted"> / 5</span>
                    </div>
                    <div>
                      {/* 在实际项目中，这里应该使用星级评分组件 */}
                      {'★'.repeat(Math.round(resourceRatings[selectedResource._id].averageRating))}
                      {'☆'.repeat(5 - Math.round(resourceRatings[selectedResource._id].averageRating))}
                      <div className="text-muted">
                        <small>{resourceRatings[selectedResource._id].totalRatings} 人评分</small>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* 推荐资源 */}
              <div className="mt-4">
                <h6>相关推荐</h6>
                <Table hover size="sm">
                  <thead>
                    <tr>
                      <th>标题</th>
                      <th>类型</th>
                      <th>上传者</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recommendedResources.map(resource => (
                      <tr key={resource._id}>
                        <td>{resource.title}</td>
                        <td>{resource.type}</td>
                        <td>{resource.uploader.name}</td>
                        <td>
                          <Button 
                            variant="outline-primary" 
                            size="sm" 
                            className="me-1"
                            onClick={() => handleViewResourceDetail(resource)}
                          >
                            详情
                          </Button>
                          <Button 
                            variant="outline-success" 
                            size="sm"
                            onClick={() => handlePreviewResource(resource)}
                          >
                            预览
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              {selectedResource.tags && selectedResource.tags.length > 0 ? (
                <div>
                  <p><strong>标签:</strong></p>
                  <div>
                    {selectedResource.tags.map((tag, index) => (
                      <Badge key={index} bg="secondary" className="me-1">{tag}</Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <p>暂无标签</p>
              )}
              <div className="mt-3 d-flex justify-content-end">
                <Button 
                  variant="outline-success" 
                  size="sm" 
                  className="me-2"
                  onClick={() => {
                    setCollectionForm({...collectionForm, resourceId: selectedResource._id});
                    setShowDetailModal(false);
                    setShowCollectionModal(true);
                  }}
                >
                  收藏
                </Button>
                <Button 
                  variant="outline-primary" 
                  size="sm"
                  onClick={() => handleDownloadResource(selectedResource._id)}
                >
                  下载
                </Button>
              </div>
            </div>
          )}
        </Modal.Body>
      </Modal>
      
      {/* 资源预览模态框 */}
      <Modal 
        show={showPreviewModal} 
        onHide={() => setShowPreviewModal(false)} 
        size="xl" 
        centered
        dialogClassName="resource-preview-modal"
      >
        <Modal.Body className="p-0">
          {selectedResource && (
            <ResourcePreview 
              resource={selectedResource} 
              onClose={() => setShowPreviewModal(false)} 
            />
          )}
        </Modal.Body>
      </Modal>
    </Container>
  );
};

export default Resources;