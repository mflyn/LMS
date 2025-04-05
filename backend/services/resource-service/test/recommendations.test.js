const chai = require('chai');
const chaiHttp = require('chai-http');
const sinon = require('sinon');
const mongoose = require('mongoose');
const { expect } = chai;

// 导入模型
const Resource = require('../models/Resource');
const ResourceReview = require('../models/ResourceReview');

// 导入应用
const app = require('../server');

chai.use(chaiHttp);

describe('资源推荐功能测试', () => {
  // 测试数据
  const testUser = {
    id: '60d0fe4f5311236168a109ca',
    role: 'teacher'
  };
  
  const testResources = [
    {
      _id: '60d0fe4f5311236168a109cb',
      title: '数学练习题',
      subject: '数学',
      grade: '三年级',
      type: '习题',
      uploader: '60d0fe4f5311236168a109ca',
      averageRating: 4.5,
      reviewCount: 5,
      createdAt: new Date('2023-01-01')
    },
    {
      _id: '60d0fe4f5311236168a109cc',
      title: '语文阅读理解',
      subject: '语文',
      grade: '三年级',
      type: '习题',
      uploader: '60d0fe4f5311236168a109ca',
      averageRating: 4.0,
      reviewCount: 3,
      createdAt: new Date('2023-01-02')
    },
    {
      _id: '60d0fe4f5311236168a109cd',
      title: '英语单词表',
      subject: '英语',
      grade: '三年级',
      type: '文档',
      uploader: '60d0fe4f5311236168a109ca',
      averageRating: 3.5,
      reviewCount: 2,
      createdAt: new Date('2023-01-03')
    }
  ];
  
  const testReviews = [
    {
      _id: '60d0fe4f5311236168a109ce',
      resource: '60d0fe4f5311236168a109cb',
      reviewer: '60d0fe4f5311236168a109ca',
      rating: 5,
      isRecommended: true
    },
    {
      _id: '60d0fe4f5311236168a109cf',
      resource: '60d0fe4f5311236168a109cc',
      reviewer: '60d0fe4f5311236168a109ca',
      rating: 4,
      isRecommended: true
    }
  ];
  
  // 在每个测试前设置存根
  beforeEach(() => {
    // 模拟认证中间件
    sinon.stub(app.request, 'headers').value({
      'x-user-id': testUser.id,
      'x-user-role': testUser.role
    });
    
    // 模拟Resource.find
    sinon.stub(Resource, 'find').returns({
      populate: sinon.stub().returns({
        sort: sinon.stub().returns({
          limit: sinon.stub().returns(Promise.resolve(testResources))
        })
      })
    });
    
    // 模拟ResourceReview.find
    sinon.stub(ResourceReview, 'find').resolves(testReviews);
    
    // 模拟ResourceReview.aggregate
    sinon.stub(ResourceReview, 'aggregate').resolves([
      {
        _id: '60d0fe4f5311236168a109cb',
        averageRating: 4.5,
        reviewCount: 5,
        recommendCount: 3
      },
      {
        _id: '60d0fe4f5311236168a109cc',
        averageRating: 4.0,
        reviewCount: 3,
        recommendCount: 2
      }
    ]);
  });
  
  // 在每个测试后恢复存根
  afterEach(() => {
    sinon.restore();
  });
  
  describe('GET /recommended', () => {
    it('应该返回推荐资源列表', async () => {
      const res = await chai.request(app)
        .get('/api/resource/recommendations/recommended')
        .query({ limit: 10 });
      
      expect(res).to.have.status(200);
      expect(res.body).to.be.an('object');
      expect(res.body).to.have.property('recommendedResources');
      expect(res.body.recommendedResources).to.be.an('array');
      expect(res.body).to.have.property('count');
      expect(res.body.count).to.equal(res.body.recommendedResources.length);
    });
    
    it('应该根据科目和年级筛选推荐资源', async () => {
      const res = await chai.request(app)
        .get('/api/resource/recommendations/recommended')
        .query({ subject: '数学', grade: '三年级', limit: 10 });
      
      expect(res).to.have.status(200);
      expect(res.body).to.be.an('object');
      expect(res.body).to.have.property('recommendedResources');
    });
  });
  
  describe('GET /personalized', () => {
    it('应该返回个性化推荐资源列表', async () => {
      const res = await chai.request(app)
        .get('/api/resource/recommendations/personalized')
        .query({ limit: 10 });
      
      expect(res).to.have.status(200);
      expect(res.body).to.be.an('object');
      expect(res.body).to.have.property('personalizedResources');
      expect(res.body.personalizedResources).to.be.an('array');
      expect(res.body).to.have.property('count');
      expect(res.body).to.have.property('userPreferences');
    });
    
    it('应该根据用户偏好推荐资源', async () => {
      // 模拟用户有评价记录
      sinon.restore();
      sinon.stub(ResourceReview, 'find').resolves(testReviews);
      sinon.stub(Resource, 'find').returns({
        populate: sinon.stub().returns({
          sort: sinon.stub().returns({
            limit: sinon.stub().returns(Promise.resolve(testResources))
          })
        })
      });
      
      const res = await chai.request(app)
        .get('/api/resource/recommendations/personalized')
        .query({ limit: 10 });
      
      expect(res).to.have.status(200);
      expect(res.body).to.have.property('userPreferences');
      expect(res.body.userPreferences).to.have.property('favoriteSubject');
      expect(res.body.userPreferences).to.have.property('favoriteType');
      expect(res.body.userPreferences).to.have.property('favoriteGrade');
    });
    
    it('没有评价记录时应该重定向到普通推荐', async () => {
      // 模拟用户没有评价记录
      sinon.restore();
      sinon.stub(ResourceReview, 'find').resolves([]);
      
      // 模拟重定向
      const redirectStub = sinon.stub();
      sinon.stub(app.response, 'redirect').value(redirectStub);
      
      await chai.request(app)
        .get('/api/resource/recommendations/personalized')
        .query({ limit: 10 });
      
      expect(redirectStub.calledOnce).to.be.true;
      expect(redirectStub.firstCall.args[0]).to.include('/api/resource/recommendations/recommended');
    });
  });
  
  describe('POST /reviews', () => {
    it('应该成功提交资源评分', async () => {
      // 模拟ResourceReview.findOne和save方法
      sinon.restore();
      sinon.stub(ResourceReview, 'findOne').resolves(null);
      
      const saveStub = sinon.stub().resolves({});
      sinon.stub(mongoose.Model.prototype, 'save').callsFake(saveStub);
      
      const res = await chai.request(app)
        .post('/api/resource/recommendations/reviews')
        .send({
          resource: '60d0fe4f5311236168a109cb',
          rating: 5,
          comment: '非常好的资源',
          isRecommended: true
        });
      
      expect(res).to.have.status(201);
      expect(res.body).to.have.property('message');
      expect(res.body.message).to.equal('评价已提交');
    });
    
    it('应该更新已存在的资源评分', async () => {
      // 模拟已存在的评价
      sinon.restore();
      const existingReview = {
        resource: '60d0fe4f5311236168a109cb',
        reviewer: testUser.id,
        rating: 4,
        comment: '好资源',
        isRecommended: true,
        save: sinon.stub().resolves({})
      };
      
      sinon.stub(ResourceReview, 'findOne').resolves(existingReview);
      
      const res = await chai.request(app)
        .post('/api/resource/recommendations/reviews')
        .send({