const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ResourceCollection = require('../models/ResourceCollection');
const Resource = require('../models/Resource');

const { authenticateGateway } = require('../../../common/middleware/auth');
const { catchAsync, AppError } = require('../../../common/middleware/errorHandler');
const { validate, mongoIdParamValidation, collectResourceValidationRules, updateCollectionValidationRules } = require('../../../common/middleware/requestValidator');

/**
 * @route   GET /api/resources/collections
 * @desc    获取用户的收藏列表
 * @access  Private
 */
router.get('/', 
    authenticateGateway,
    catchAsync(async (req, res) => {
        const userId = req.user.id;

        const collections = await ResourceCollection.find({ user: userId })
            .populate('resource')
            .sort({ createdAt: -1 });

        res.status(200).json({ collections });
    })
);

/**
 * @route   GET /api/resources/collections/check/:resourceId
 * @desc    检查资源是否已被收藏
 * @access  Private
 */
router.get('/check/:resourceId',
    authenticateGateway,
    ...mongoIdParamValidation('resourceId'),
    validate,
    catchAsync(async (req, res) => {
        const userId = req.user.id;
        const { resourceId } = req.params;

        const resourceExists = await Resource.findById(resourceId);
        if (!resourceExists) {
            throw new AppError('资源不存在', 404);
        }

        const isCollected = await ResourceCollection.exists({
            user: userId,
            resource: resourceId
        });

        res.status(200).json({ isCollected: !!isCollected });
    })
);

/**
 * @route   POST /api/resources/collections
 * @desc    收藏资源
 * @access  Private
 */
router.post('/',
    authenticateGateway,
    collectResourceValidationRules(),
    validate,
    catchAsync(async (req, res) => {
        const userId = req.user.id;
        const { resourceId, collectionName, notes } = req.body;

        const resource = await Resource.findById(resourceId);
        if (!resource) {
            throw new AppError('资源不存在', 404);
        }

        const existingCollection = await ResourceCollection.findOne({
            user: userId,
            resource: resourceId
        });
        if (existingCollection) {
            throw new AppError('已经收藏过该资源', 400);
        }

        const collection = new ResourceCollection({
            user: userId,
            resource: resourceId,
            collectionName: collectionName,
            notes: notes
        });

        try {
            await collection.save();
        } catch (error) {
            if (error.code === 11000) {
                throw new AppError('已经收藏过该资源 (index violation)', 400);
            }
            throw error;
        }
        
        const populatedCollection = await ResourceCollection.findById(collection._id).populate('resource');

        res.status(201).json({
            message: '收藏成功',
            collection: populatedCollection
        });
    })
);

/**
 * @route   PUT /api/resources/collections/:id
 * @desc    更新收藏信息
 * @access  Private
 */
router.put('/:id',
    authenticateGateway,
    updateCollectionValidationRules(),
    validate,
    catchAsync(async (req, res) => {
        const userId = req.user.id;
        const { id } = req.params;
        const { collectionName, notes } = req.body;

        const collection = await ResourceCollection.findById(id);
        if (!collection) {
            throw new AppError('收藏记录不存在', 404);
        }

        if (collection.user.toString() !== userId) {
            throw new AppError('无权修改此收藏', 403);
        }

        if (collectionName !== undefined) collection.collectionName = collectionName;
        if (notes !== undefined) collection.notes = notes;

        await collection.save();
        
        const populatedCollection = await ResourceCollection.findById(collection._id).populate('resource');

        res.status(200).json({
            message: '收藏更新成功',
            collection: populatedCollection
        });
    })
);

/**
 * @route   DELETE /api/resources/collections/:id
 * @desc    取消收藏资源
 * @access  Private
 */
router.delete('/:id',
    authenticateGateway,
    ...mongoIdParamValidation('id'),
    validate,
    catchAsync(async (req, res) => {
        const userId = req.user.id;
        const { id } = req.params;

        const collection = await ResourceCollection.findById(id);
        if (!collection) {
            throw new AppError('收藏记录不存在', 404);
        }

        if (collection.user.toString() !== userId) {
            throw new AppError('无权删除此收藏', 403);
        }

        await ResourceCollection.findByIdAndDelete(id);

        res.status(200).json({ message: '收藏已删除' });
    })
);

/**
 * @route   GET /api/resources/collections/folders
 * @desc    获取按收藏夹名称分组的收藏
 * @access  Private
 */
router.get('/folders',
    authenticateGateway,
    catchAsync(async (req, res) => {
        const userId = req.user.id;

        const folders = await ResourceCollection.aggregate([
            { $match: { user: new mongoose.Types.ObjectId(userId) } },
            { $group: { _id: '$collectionName', count: { $sum: 1 } } },
            { $project: { name: '$_id', count: 1, _id: 0 } },
            { $sort: { name: 1 } }
        ]);

        res.status(200).json({ folders });
    })
);

module.exports = router;
