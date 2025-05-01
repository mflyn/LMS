const { ResourceService } = require('../services/resourceService');
const Resource = require('../models/Resource');
const { createMockLogger } = require('../../../common/test/testUtils');
const mongoose = require('mongoose');

// 模拟依赖
jest.mock('../models/Resource');

describe('ResourceService', () => {
  let resourceService;
  const mockLogger = createMockLogger();
  
  beforeEach(() => {
    jest.clearAllMocks();
    resourceService = new ResourceService({ logger: mockLogger });
  });
  
  describe('getResources', () => {
    test('应返回分页资源列表', async () => {
      // 准备
      const mockResources = [
        { _id: 'resource1', title: '资源1', type: 'video' },
        { _id: 'resource2', title: '资源2', type: 'document' }
      ];
      
      const mockQuery = {
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockResources)
      };
      
      Resource.find.mockReturnValue(mockQuery);
      Resource.countDocuments.mockResolvedValue(10);
      
      const query = { type: 'video', subject: 'math' };
      const options = { page: 2, limit: 10, sort: { createdAt: -1 } };
      
      // 执行
      const result = await resourceService.getResources(query, options);
      
      // 验证
      expect(Resource.find).toHaveBeenCalledWith(query);
      expect(mockQuery.skip).toHaveBeenCalledWith(10);
      expect(mockQuery.limit).toHaveBeenCalledWith(10);
      expect(mockQuery.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(Resource.countDocuments).toHaveBeenCalledWith(query);
      expect(result).toEqual({
        resources: mockResources,
        pagination: {
          total: 10,
          page: 2,
          limit: 10,
          pages: 1
        }
      });
    });
  });
  
  describe('getResourceById', () => {
    test('应返回指定ID的资源', async () => {
      // 准备
      const resourceId = 'resource_id';
      const mockResource = {
        _id: resourceId,
        title: '测试资源',
        description: '资源描述',
        type: 'video'
      };
      
      Resource.findById.mockResolvedValue(mockResource);
      
      // 执行
      const result = await resourceService.getResourceById(resourceId);
      
      // 验证
      expect(Resource.findById).toHaveBeenCalledWith(resourceId);
      expect(result).toEqual(mockResource);
    });
    
    test('资源不存在时应抛出错误', async () => {
      // 准备
      const resourceId = 'nonexistent_id';
      Resource.findById.mockResolvedValue(null);
      
      // 执行与验证
      await expect(resourceService.getResourceById(resourceId))
        .rejects
        .toThrow('资源不存在');
      
      expect(Resource.findById).toHaveBeenCalledWith(resourceId);
    });
  });
  
  describe('createResource', () => {
    test('应成功创建新资源', async () => {
      // 准备
      const resourceData = {
        title: '新资源',
        description: '资源描述',
        type: 'document',
        subject: 'math',
        grade: '三年级',
        url: 'https://example.com/resource.pdf'
      };
      
      const savedResource = {
        _id: 'new_resource_id',
        ...resourceData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const mockResource = {
        save: jest.fn().mockResolvedValue(savedResource)
      };
      
      Resource.mockImplementation(() => mockResource);
      
      // 执行
      const result = await resourceService.createResource(resourceData);
      
      // 验证
      expect(Resource).toHaveBeenCalledWith(resourceData);
      expect(mockResource.save).toHaveBeenCalled();
      expect(result).toEqual(savedResource);
    });
  });
  
  describe('updateResource', () => {
    test('应成功更新资源', async () => {
      // 准备
      const resourceId = 'resource_id';
      const updateData = {
        title: '更新的标题',
        description: '更新的描述'
      };
      
      const updatedResource = {
        _id: resourceId,
        title: updateData.title,
        description: updateData.description,
        type: 'video',
        updatedAt: new Date()
      };
      
      Resource.findByIdAndUpdate.mockResolvedValue(updatedResource);
      
      // 执行
      const result = await resourceService.updateResource(resourceId, updateData);
      
      // 验证
      expect(Resource.findByIdAndUpdate).toHaveBeenCalledWith(
        resourceId,
        updateData,
        { new: true, runValidators: true }
      );
      expect(result).toEqual(updatedResource);
    });
    
    test('资源不存在时应抛出错误', async () => {
      // 准备
      const resourceId = 'nonexistent_id';
      const updateData = { title: '更新的标题' };
      
      Resource.findByIdAndUpdate.mockResolvedValue(null);
      
      // 执行与验证
      await expect(resourceService.updateResource(resourceId, updateData))
        .rejects
        .toThrow('资源不存在');
      
      expect(Resource.findByIdAndUpdate).toHaveBeenCalledWith(
        resourceId,
        updateData,
        { new: true, runValidators: true }
      );
    });
  });
  
  describe('deleteResource', () => {
    test('应成功删除资源', async () => {
      // 准备
      const resourceId = 'resource_id';
      const deletedResource = {
        _id: resourceId,
        title: '被删除的资源'
      };
      
      Resource.findByIdAndDelete.mockResolvedValue(deletedResource);
      
      // 执行
      const result = await resourceService.deleteResource(resourceId);
      
      // 验证
      expect(Resource.findByIdAndDelete).toHaveBeenCalledWith(resourceId);
      expect(result).toEqual(deletedResource);
    });
    
    test('资源不存在时应抛出错误', async () => {
      // 准备
      const resourceId = 'nonexistent_id';
      Resource.findByIdAndDelete.mockResolvedValue(null);
      
      // 执行与验证
      await expect(resourceService.deleteResource(resourceId))
        .rejects
        .toThrow('资源不存在');
      
      expect(Resource.findByIdAndDelete).toHaveBeenCalledWith(resourceId);
    });
  });
});