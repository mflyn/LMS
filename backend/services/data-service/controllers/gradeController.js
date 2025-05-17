const GradeService = require('../services/gradeService');
const { catchAsync } = require('../../../common/middleware/errorHandler');
const { AppResponse } = require('../../../common/utils/appResponse'); // For consistent responses

class GradeController {
  constructor() {
    // Service instances can be created per request or be singletons managed elsewhere
    // For simplicity here, creating per request or assuming middleware might attach it.
    // If service needs logger from app.locals, it must be instantiated where req is available.
  }

  // Helper to get service instance with logger, assuming this controller is instantiated per request or has access to req
  _getServiceInstance(req) {
    if (!this.gradeService || this.gradeService.logger !== req.app.locals.logger) {
        // Pass logger from app.locals to the service constructor
        this.gradeService = new GradeService(req.app.locals.logger);
    }
    return this.gradeService;
  }

  getStudentGrades = catchAsync(async (req, res, next) => {
    const gradeService = this._getServiceInstance(req);
    const { studentId } = req.params;
    const requestingUser = req.user;
    const queryParams = req.query; // Pass query params for filtering/pagination

    // Controller no longer logs directly, service does.
    // Controller no longer does studentId format check, middleware does.

    const result = await gradeService.getGradesForStudent(studentId, requestingUser, queryParams);
    
    // Assuming GradeService returns an object like { data: grades, pagination: {...} }
    res.status(200).json(new AppResponse(200, 'Student grades retrieved successfully', result.data, null, result.pagination));
  });

  getClassGrades = catchAsync(async (req, res, next) => {
    const gradeService = this._getServiceInstance(req);
    const { classId } = req.params;
    const requestingUser = req.user;
    const queryParams = req.query; // Pass query params for filtering/pagination

    const result = await gradeService.getGradesForClass(classId, requestingUser, queryParams);

    // Assuming GradeService returns an object like { data: grades, pagination: {...} }
    res.status(200).json(new AppResponse(200, 'Class grades retrieved successfully', result.data, null, result.pagination));
  });

  createGrade = catchAsync(async (req, res, next) => {
    const gradeService = this._getServiceInstance(req);
    const gradeData = req.body;
    const requestingUser = req.user;
    
    const newGrade = await gradeService.createGrade(gradeData, requestingUser);
    
    res.status(201).json(new AppResponse(201, 'Grade created successfully', newGrade));
  });

  batchCreateGrades = catchAsync(async (req, res, next) => {
    const gradeService = this._getServiceInstance(req);
    const gradesData = req.body; // Expect req.body to be the array of grades directly
    const requestingUser = req.user;

    const result = await gradeService.batchCreateGrades(gradesData, requestingUser);

    res.status(201).json(new AppResponse(201, `Successfully processed batch grade creation. ${result.insertedCount} grades were inserted.`, { insertedCount: result.insertedCount, insertedIds: result.insertedIds } ));
  });

  updateGrade = catchAsync(async (req, res, next) => {
    const gradeService = this._getServiceInstance(req);
    const { id: gradeId } = req.params;
    const updateData = req.body;
    const requestingUser = req.user;
    const updatedGrade = await gradeService.updateGrade(gradeId, updateData, requestingUser);
    res.status(200).json(new AppResponse(200, 'Grade updated successfully', updatedGrade));
  });

  deleteGrade = catchAsync(async (req, res, next) => {
    const gradeService = this._getServiceInstance(req);
    const { id: gradeId } = req.params;
    const requestingUser = req.user;
    const result = await gradeService.deleteGrade(gradeId, requestingUser);
    res.status(200).json(new AppResponse(200, result.message || 'Grade deleted successfully')); // Or use 204 No Content
  });
}

module.exports = new GradeController(); 