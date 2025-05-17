const express = require('express');
const router = express.Router();
const Resource = require('../models/Resource');
const ResourceReview = require('../models/ResourceReview');

// 使用共享的中间件
const { authenticateGateway } = require('../../../common/middleware/auth');
const { catchAsync, AppError } = require('../../../common/middleware/errorHandler');
const { validate, mongoIdParamValidation, submitOrUpdateReviewValidationRules, getRecommendationsQueryValidation } = require('../../../common/middleware/requestValidator');

// /*
//  * @route   GET /api/recommendations/reviews/:resourceId
//  * @desc    获取资源评分 (功能与 routes/resources.js 中的 GET /:resourceId/reviews 重复，建议移除)
//  * @access  Private
//  */
// router.get('/reviews/:resourceId', 
//     authenticateGateway, 
//     ...mongoIdParamValidation('resourceId'), // Added for completeness if uncommented
//     validate, // Added for completeness if uncommented
//     catchAsync(async (req, res) => {
//         // ... (logic remains commented out) ...
//     })
// );

router.post('/reviews', 
    authenticateGateway, 
    submitOrUpdateReviewValidationRules(),
    validate,
    catchAsync(async (req, res) => {
        const { resource, rating, comment, isRecommended } = req.body;

        const resourceExists = await Resource.findById(resource);
        if (!resourceExists) {
            throw new AppError('评论的目标资源不存在', 404);
        }

        const existingReview = await ResourceReview.findOne({
            resource,
            reviewer: req.user.id
        });

        let savedReview;
        let message;
        let statusCode = 200;

        if (existingReview) {
            existingReview.rating = rating;
            existingReview.comment = comment === undefined ? existingReview.comment : comment;
            existingReview.isRecommended = isRecommended === undefined ? existingReview.isRecommended : isRecommended;
            savedReview = await existingReview.save();
            message = '评价已更新';
            req.app.locals.logger.info(`用户 ${req.user.id} 更新了资源 ${resource} 的评价`);
        } else {
            const newReview = new ResourceReview({
                resource,
                reviewer: req.user.id,
                rating,
                comment: comment,
                isRecommended: isRecommended
            });
            savedReview = await newReview.save();
            message = '评价已提交';
            statusCode = 201;
            req.app.locals.logger.info(`用户 ${req.user.id} 提交了资源 ${resource} 的新评价`);
        }
        
        const populatedReview = await ResourceReview.findById(savedReview._id).populate('reviewer', 'name role');
        res.status(statusCode).json({ message, review: populatedReview });
    })
);

router.get('/recommended', 
    authenticateGateway, 
    getRecommendationsQueryValidation(),
    validate,
    catchAsync(async (req, res) => {
        const { subject, grade, limit = 10 } = req.query;
        let recommendedResources = [];
        req.app.locals.logger.info(`用户 ${req.user.id} 请求推荐资源`, { subject, grade, limit });

        const highRatedResources = await ResourceReview.aggregate([
            { $group: {
                _id: '$resource',
                averageRating: { $avg: '$rating' },
                reviewCount: { $sum: 1 },
                recommendCount: { $sum: { $cond: [{ $eq: ['$isRecommended', true] }, 1, 0] } }
            }},
            { $match: {
                averageRating: { $gte: 4.0 },
                reviewCount: { $gte: 3 }
            }},
            { $sort: { averageRating: -1, recommendCount: -1 } },
            { $limit: limit }
        ]);

        if (highRatedResources.length > 0) {
            const resourceIds = highRatedResources.map(item => item._id);
            const queryConditions = { _id: { $in: resourceIds } };
            if (subject) queryConditions.subject = subject;
            if (grade) queryConditions.grade = grade;

            let resourcesFromDb = await Resource.find(queryConditions).populate('uploader', 'name role');

            recommendedResources = resourcesFromDb.map(resource => {
                const ratingInfo = highRatedResources.find(r => r._id.equals(resource._id));
                return {
                    ...resource.toObject(),
                    rating: ratingInfo ? parseFloat(ratingInfo.averageRating.toFixed(1)) : 0,
                    reviewCount: ratingInfo ? ratingInfo.reviewCount : 0
                };
            }).sort((a, b) => b.rating - a.rating);
        }

        if (recommendedResources.length < limit) {
            const additionalLimit = limit - recommendedResources.length;
            const queryConditions = {};
            if (subject) queryConditions.subject = subject;
            if (grade) queryConditions.grade = grade;
            if (recommendedResources.length > 0) {
                queryConditions._id = { $nin: recommendedResources.map(r => r._id) };
            }
            const newResources = await Resource.find(queryConditions)
                .sort({ createdAt: -1 })
                .limit(additionalLimit)
                .populate('uploader', 'name role');
            recommendedResources = [...recommendedResources, ...newResources.map(r => ({...r.toObject()}))];
        }

        req.app.locals.logger.info(`为用户 ${req.user.id} 返回 ${recommendedResources.length} 个推荐资源`);
        res.json({
            recommendedResources,
            count: recommendedResources.length
        });
    })
);

router.get('/personalized', 
    authenticateGateway, 
    getRecommendationsQueryValidation(),
    validate,
    catchAsync(async (req, res) => {
        const userId = req.user.id;
        const { limit = 10, subject: querySubject, grade: queryGrade } = req.query;
        req.app.locals.logger.info(`用户 ${userId} 请求个性化推荐资源`, { limit, subject: querySubject, grade: queryGrade });

        const userReviews = await ResourceReview.find({ reviewer: userId });

        if (userReviews.length === 0) {
            req.app.locals.logger.info(`用户 ${userId} 没有评价记录，将使用普通推荐代替重定向`);
            // Construct URL for a client-side redirect or to fetch general recommendations directly
            // This avoids a server-side redirect which might be complex with API gateways/auth
            let fallbackUrl = `/api/recommendations/recommended?limit=${limit}`;
            if (querySubject) fallbackUrl += `&subject=${encodeURIComponent(querySubject)}`;
            if (queryGrade) fallbackUrl += `&grade=${encodeURIComponent(queryGrade)}`;

            return res.status(200).json({
                message: '没有足够的评价记录，请参考普通推荐',
                fallbackRecommendationUrl: fallbackUrl, // Suggest client to call this URL
                personalizedResources: [],
                count: 0
            });
        }

        const userPreferences = { subjects: {}, types: {}, grades: {} };
        const reviewedResourceIds = userReviews.map(review => review.resource);
        const reviewedResources = await Resource.find({ _id: { $in: reviewedResourceIds } });
        const reviewMap = userReviews.reduce((map, review) => {
            map[review.resource.toString()] = review.rating;
            return map;
        }, {});

        reviewedResources.forEach(resource => {
            const rating = reviewMap[resource._id.toString()] || 3;
            const weight = Math.max(0.1, rating / 5);

            if (resource.subject) userPreferences.subjects[resource.subject] = (userPreferences.subjects[resource.subject] || 0) + weight;
            if (resource.type) userPreferences.types[resource.type] = (userPreferences.types[resource.type] || 0) + weight;
            if (resource.grade) userPreferences.grades[resource.grade] = (userPreferences.grades[resource.grade] || 0) + weight;
        });

        const getTopPreference = (prefs) => Object.keys(prefs).sort((a, b) => prefs[b] - prefs[a])[0];
        
        const preferredSubject = getTopPreference(userPreferences.subjects);
        const preferredType = getTopPreference(userPreferences.types);
        const preferredGrade = getTopPreference(userPreferences.grades);

        let personalizedQuery = {};
        if (preferredSubject) personalizedQuery.subject = preferredSubject;
        if (preferredType) personalizedQuery.type = preferredType; 
        if (preferredGrade) personalizedQuery.grade = preferredGrade;

        if (querySubject) personalizedQuery.subject = querySubject;
        if (queryGrade) personalizedQuery.grade = queryGrade;
        
        if (reviewedResourceIds.length > 0) {
            personalizedQuery._id = { $nin: reviewedResourceIds };
        }

        let personalizedResources = [];
        if (Object.keys(personalizedQuery).length > (reviewedResourceIds.length > 0 ? 1 : 0) ) {
             personalizedResources = await Resource.find(personalizedQuery)
                .sort({ averageRating: -1, createdAt: -1 })
                .limit(limit)
                .populate('uploader', 'name role');
        }
       
        if (personalizedResources.length < limit) {
            const generalLimit = limit - personalizedResources.length;
            const generalExcludeIds = [...reviewedResourceIds, ...personalizedResources.map(r => r._id)];
            
            let generalQuery = {};
            if (querySubject) generalQuery.subject = querySubject;
            if (queryGrade) generalQuery.grade = queryGrade;
            if (generalExcludeIds.length > 0) {
                 generalQuery._id = { $nin: generalExcludeIds };
            }

            const generalResources = await Resource.find(generalQuery)
                .sort({ averageRating: -1, downloads: -1, createdAt: -1 })
                .limit(generalLimit)
                .populate('uploader', 'name role');
            personalizedResources = [...personalizedResources, ...generalResources];
        }

        req.app.locals.logger.info(`为用户 ${userId} 返回 ${personalizedResources.length} 个个性化推荐资源`);
        res.json({
            personalizedResources,
            count: personalizedResources.length,
            preferences: process.env.NODE_ENV !== 'production' ? userPreferences : undefined
        });
    })
);

module.exports = router;