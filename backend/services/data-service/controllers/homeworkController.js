const homeworkServiceInstance = require('../services/homeworkService');
const { catchAsync } = require('../../../common/middleware/errorHandler');
const { AppResponse } = require('../../../common/utils/appResponse');
const logger = require('../../../common/utils/logger').logger; // Import the actual logger

// Instantiate the service, or inject it if using DI
const homeworkService = new homeworkServiceInstance(logger);


const getStudentHomework = catchAsync(async (req, res, next) => {
    // Pass query parameters from req.query to the service method
    const result = await homeworkService.getHomeworkForStudent(req.params.studentId, req.user, req.query);
    // The service now returns an object with { data, pagination }
    res.status(200).json(new AppResponse(200, 'Homework retrieved successfully', result.data, null, result.pagination));
});

// assignHomework controller method is now removed as the corresponding service method was removed.
// The POST /api/homework route in routes/homework.js should also be removed.

const submitHomework = catchAsync(async (req, res, next) => {
    const homework = await homeworkService.submitStudentHomework(req.params.id, req.body, req.user);
    res.status(200).json(new AppResponse(200, 'Homework submitted successfully', homework));
});

const gradeHomework = catchAsync(async (req, res, next) => {
    const homework = await homeworkService.gradeStudentHomework(req.params.id, req.body, req.user);
    res.status(200).json(new AppResponse(200, 'Homework graded successfully', homework));
});

module.exports = {
    getStudentHomework,
    // assignHomework, // Removed
    submitHomework,
    gradeHomework,
}; 