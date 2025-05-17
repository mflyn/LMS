const GradeService = require('../services/gradeService');
const { catchAsync } = require('../../../common/middleware/errorHandler');
// Import specific error types if controller needs to throw them directly for pre-service checks
const { BadRequestError } = require('../../../common/middleware/errorTypes'); 
const mongoose = require('mongoose'); // For ObjectId validation if needed directly in controller

class GradeController {

  getStudentGrades = catchAsync(async (req, res, next) => {
    const logger = req.app.locals.logger;
    const { studentId } = req.params;
    const requestingUser = req.user; // Assumes authenticateJWT middleware populates req.user

    logger.info(`[GradeController] Request to fetch grades for student ID: ${studentId}`);

    // Basic validation in controller, more complex in service or via middleware
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return next(new BadRequestError('Invalid student ID format provided.'));
    }

    const grades = await GradeService.getGradesForStudent(studentId, requestingUser, logger);
    
    // GradeService might return empty array if no grades found, not necessarily an error.
    // If an error (like NotFoundError for student not existing at all) is desired for no grades,
    // GradeService should throw that error.
    res.status(200).json({
      status: 'success',
      results: grades.length,
      data: { grades },
    });
  });

  getClassGrades = catchAsync(async (req, res, next) => {
    const logger = req.app.locals.logger;
    const { classId } = req.params;
    const requestingUser = req.user;

    logger.info(`[GradeController] Request to fetch grades for class ID: ${classId}`);
    if (!mongoose.Types.ObjectId.isValid(classId)) {
        return next(new BadRequestError('Invalid class ID format provided.'));
    }

    const grades = await GradeService.getGradesForClass(classId, requestingUser, logger);
    res.status(200).json({
      status: 'success',
      results: grades.length,
      data: { grades },
    });
  });

  createGrade = catchAsync(async (req, res, next) => {
    const logger = req.app.locals.logger;
    const gradeData = req.body;
    const requestingUser = req.user;

    logger.info('[GradeController] Request to create new grade', { gradeData });
    
    // Input validation for gradeData should be primarily handled by validation middleware.
    // Minimal checks can be here if necessary, but service layer will also validate.

    const newGrade = await GradeService.createGrade(gradeData, requestingUser, logger);
    
    logger.info('[GradeController] Grade created successfully', { gradeId: newGrade._id });
    res.status(201).json({
      status: 'success',
      message: 'Grade created successfully',
      data: { grade: newGrade },
    });
  });

  batchCreateGrades = catchAsync(async (req, res, next) => {
    const logger = req.app.locals.logger;
    const { grades: gradesData } = req.body; // Assuming body is { grades: [...] }
    const requestingUser = req.user;

    logger.info(`[GradeController] Request to batch create grades. Count: ${gradesData ? gradesData.length : 0}`);

    if (!gradesData || !Array.isArray(gradesData) || gradesData.length === 0) {
      return next(new BadRequestError('Request body must contain a non-empty array of grades.'));
    }

    const result = await GradeService.batchCreateGrades(gradesData, requestingUser, logger);

    logger.info(`[GradeController] Batch grade creation processed. ${result.length} grades potentially inserted.`);
    res.status(201).json({
      status: 'success',
      message: `Successfully processed batch grade creation. ${result.length} grades were inserted.`,
      // data: { result } // The result from insertMany can be large, decide if it needs to be returned
      // Or more specific: data: { insertedCount: result.length, insertedIds: result.map(g => g._id) } 
      data: { insertedCount: result.length }
    });
  });
}

module.exports = new GradeController(); 