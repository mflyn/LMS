const ClassPerformanceService = require('../services/classPerformanceService');
const { catchAsync } = require('../../../common/middleware/errorHandler');
const { AppResponse } = require('../../../common/utils/appResponse');

class ClassPerformanceController {
  constructor() {
    // Service instance will be created per request via _getServiceInstance
  }

  _getServiceInstance(req) {
    // Pass logger from app.locals to the service constructor
    // Create new instance per request or manage as a singleton if appropriate for your app structure.
    // For consistency with GradeController, creating new instance with req-specific logger.
    if (!this.classPerformanceService || this.classPerformanceService.logger !== req.app.locals.logger) {
        this.classPerformanceService = new ClassPerformanceService(req.app.locals.logger);
    }
    return this.classPerformanceService;
  }

  getStudentPerformance = catchAsync(async (req, res, next) => {
    const service = this._getServiceInstance(req);
    const { studentId } = req.params;
    const requestingUser = req.user;
    const queryParams = req.query; // Pass query params

    const result = await service.getPerformanceForStudent(studentId, requestingUser, queryParams);
    // Assuming service returns { data: [...], pagination: {...} }
    res.status(200).json(new AppResponse(200, 'Student performance records retrieved successfully', result.data, null, result.pagination));
  });

  getClassPerformance = catchAsync(async (req, res, next) => {
    const service = this._getServiceInstance(req);
    const { classId } = req.params;
    const requestingUser = req.user;
    const queryParams = req.query; // Pass query params

    const result = await service.getPerformanceForClass(classId, requestingUser, queryParams);
    // Assuming service returns { data: [...], pagination: {...} }
    res.status(200).json(new AppResponse(200, 'Class performance records retrieved successfully', result.data, null, result.pagination));
  });

  recordPerformance = catchAsync(async (req, res, next) => {
    const service = this._getServiceInstance(req);
    const performanceData = req.body;
    const requestingUser = req.user;

    const newPerformance = await service.recordStudentPerformance(performanceData, requestingUser);
    res.status(201).json(new AppResponse(201, 'Class performance recorded successfully', newPerformance));
  });

  updatePerformance = catchAsync(async (req, res, next) => {
    const service = this._getServiceInstance(req);
    const { id: performanceId } = req.params;
    const updateData = req.body;
    const requestingUser = req.user;

    const updatedPerformance = await service.updateStudentPerformance(performanceId, updateData, requestingUser);
    res.status(200).json(new AppResponse(200, 'Class performance updated successfully', updatedPerformance));
  });

  deletePerformance = catchAsync(async (req, res, next) => {
    const service = this._getServiceInstance(req);
    const { id: performanceId } = req.params;
    const requestingUser = req.user;

    await service.deleteStudentPerformance(performanceId, requestingUser);
    res.status(200).json(new AppResponse(200, 'Class performance deleted successfully'));
  });
}

module.exports = new ClassPerformanceController(); 