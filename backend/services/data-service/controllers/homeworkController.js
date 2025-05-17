const homeworkServiceInstance = require('../services/homeworkService');
const { catchAsync } = require('../../../common/middleware/errorHandler');
const { AppResponse } = require('../../../common/utils/appResponse');
const logger = require('../../../common/utils/logger').logger; // Import the actual logger

// Instantiate the service, or inject it if using DI
const homeworkService = new homeworkServiceInstance(logger);


const getStudentHomework = catchAsync(async (req, res, next) => {
    const homework = await homeworkService.getHomeworkForStudent(req.params.studentId, req.user);
    res.status(200).json(new AppResponse(200, 'Homework retrieved successfully', homework));
});

const assignHomework = catchAsync(async (req, res, next) => {
    // req.body should contain studentIds directly now, not classId
    const result = await homeworkService.assignHomeworkToStudents(req.body, req.user);
    res.status(201).json(new AppResponse(201, `Successfully assigned homework to ${result.length} student(s)`, result));
});

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
    assignHomework,
    submitHomework,
    gradeHomework,
}; 