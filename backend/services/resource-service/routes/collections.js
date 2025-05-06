const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ResourceCollection = require('../models/ResourceCollection');
const Resource = require('../models/Resource');

/**
 * @route   GET /api/resources/collections
 * @desc    获取用户的收藏列表
 * @access  Private
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return res.status(401).json({ message: '未授权，请先登录' });
    }

    // 查询用户的所有收藏，并填充资源信息
    const collections = await ResourceCollection.find({ user: userId })
      .populate('resource')
      .sort({ createdAt: -1 });

    res.json({ collections });
  } catch (error) {
    console.error('获取收藏列表失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

/**
 * @route   GET /api/resources/collections/check/:resourceId
 * @desc    检查资源是否已被收藏
 * @access  Private
 */
router.get('/check/:resourceId', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return res.status(401).json({ message: '未授权，请先登录' });
    }

    const { resourceId } = req.params;

    // 检查资源是否存在
    const resource = await Resource.findById(resourceId);
    if (!resource) {
      return res.status(404).json({ message: '资源不存在' });
    }

    // 检查是否已收藏
    const isCollected = await ResourceCollection.exists({
      user: userId,
      resource: resourceId
    });

    res.json({ isCollected: !!isCollected });
  } catch (error) {
    console.error('检查收藏状态失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

/**
 * @route   POST /api/resources/collections
 * @desc    收藏资源
 * @access  Private
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return res.status(401).json({ message: '未授权，请先登录' });
    }

    const { resourceId, collectionName, notes } = req.body;

    // 检查资源是否存在
    const resource = await Resource.findById(resourceId);
    if (!resource) {
      return res.status(404).json({ message: '资源不存在' });
    }

    // 检查是否已收藏
    const existingCollection = await ResourceCollection.findOne({
      user: userId,
      resource: resourceId
    });

    if (existingCollection) {
      return res.status(400).json({ message: '已经收藏过该资源' });
    }

    // 创建新收藏
    const collection = new ResourceCollection({
      user: userId,
      resource: resourceId,
      collectionName: collectionName || '默认收藏夹',
      notes: notes || ''
    });

    await collection.save();

    res.status(201).json({
      message: '收藏成功',
      collection
    });
  } catch (error) {
    console.error('收藏资源失败:', error);
    if (error.code === 11000) { // MongoDB 重复键错误
      return res.status(400).json({ message: '已经收藏过该资源' });
    }
    res.status(500).json({ message: '服务器错误' });
  }
});

/**
 * @route   PUT /api/resources/collections/:id
 * @desc    更新收藏信息
 * @access  Private
 */
router.put('/:id', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return res.status(401).json({ message: '未授权，请先登录' });
    }

    const { id } = req.params;
    const { collectionName, notes } = req.body;

    // 查找收藏
    const collection = await ResourceCollection.findById(id);
    if (!collection) {
      return res.status(404).json({ message: '收藏不存在' });
    }

    // 确认是用户自己的收藏
    if (collection.user.toString() !== userId) {
      return res.status(403).json({ message: '无权修改此收藏' });
    }

    // 更新收藏信息
    if (collectionName) collection.collectionName = collectionName;
    if (notes !== undefined) collection.notes = notes;

    await collection.save();

    res.json({
      message: '收藏更新成功',
      collection
    });
  } catch (error) {
    console.error('更新收藏失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

/**
 * @route   DELETE /api/resources/collections/:id
 * @desc    取消收藏资源
 * @access  Private
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return res.status(401).json({ message: '未授权，请先登录' });
    }

    const { id } = req.params;

    // 查找收藏
    const collection = await ResourceCollection.findById(id);
    if (!collection) {
      return res.status(404).json({ message: '收藏不存在' });
    }

    // 确认是用户自己的收藏
    if (collection.user.toString() !== userId) {
      return res.status(403).json({ message: '无权删除此收藏' });
    }

    // 删除收藏
    await ResourceCollection.findByIdAndDelete(id);

    res.json({ message: '收藏已删除' });
  } catch (error) {
    console.error('取消收藏失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

/**
 * @route   GET /api/resources/collections/folders
 * @desc    获取按收藏夹名称分组的收藏
 * @access  Private
 */
router.get('/folders', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return res.status(401).json({ message: '未授权，请先登录' });
    }

    // 按收藏夹名称分组，计算每个收藏夹的资源数量
    const folders = await ResourceCollection.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: '$collectionName', count: { $sum: 1 } } },
      { $project: { name: '$_id', count: 1, _id: 0 } },
      { $sort: { name: 1 } }
    ]);

    res.json({ folders });
  } catch (error) {
    console.error('获取收藏夹列表失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;
