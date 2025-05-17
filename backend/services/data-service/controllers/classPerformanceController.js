const classPerformanceServiceInstance = require('../services/classPerformanceService');
const { catchAsync } = require('../../../common/middleware/errorHandler');
const { AppResponse } = require('../../../common/utils/appResponse');
const logger = require('../../../common/utils/logger').logger;

const classPerformanceService = new classPerformanceServiceInstance(logger);

const getStudentPerformance = catchAsync(async (req, res, next) => {
    const performances = await classPerformanceService.getPerformanceForStudent(req.params.studentId, req.user);
    res.status(200).json(new AppResponse(200, 'Student performance records retrieved successfully', performances));
});

const getClassPerformance = catchAsync(async (req, res, next) => {
    const performances = await classPerformanceService.getPerformanceForClass(req.params.classId, req.user);
    res.status(200).json(new AppResponse(200, 'Class performance records retrieved successfully', performances));
});

const recordPerformance = catchAsync(async (req, res, next) => {
    const newPerformance = await classPerformanceService.recordStudentPerformance(req.body, req.user);
    res.status(201).json(new AppResponse(201, 'Class performance recorded successfully', newPerformance));
});

const updatePerformance = catchAsync(async (req, res, next) => {
    const updatedPerformance = await classPerformanceService.updateStudentPerformance(req.params.id, req.body, req.user);
    res.status(200).json(new AppResponse(200, 'Class performance updated successfully', updatedPerformance));
});

const deletePerformance = catchAsync(async (req, res, next) => {
    await classPerformanceService.deleteStudentPerformance(req.params.id, req.user);
    res.status(200).json(new AppResponse(200, 'Class performance deleted successfully'));
});

module.exports = {
    getStudentPerformance,
    getClassPerformance,
    recordPerformance,
    updatePerformance,
    deletePerformance,
}; 