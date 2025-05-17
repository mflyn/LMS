const mistakeRecordServiceInstance = require('../services/mistakeRecordService');
const { catchAsync } = require('../../../common/middleware/errorHandler');
const { AppResponse } = require('../../../common/utils/appResponse');
const logger = require('../../../common/utils/logger').logger; // Import the actual logger

const mistakeRecordService = new mistakeRecordServiceInstance(logger); // Instantiate with logger

const getStudentMistakes = catchAsync(async (req, res, next) => {
    const mistakes = await mistakeRecordService.getMistakesByStudent(req.params.studentId, req.user);
    res.status(200).json(new AppResponse(200, 'Student mistake records retrieved successfully.', mistakes));
});

const getStudentMistakesBySubject = catchAsync(async (req, res, next) => {
    const mistakes = await mistakeRecordService.getMistakesByStudentAndSubject(req.params.studentId, req.params.subjectId, req.user);
    res.status(200).json(new AppResponse(200, 'Student mistake records for subject retrieved successfully.', mistakes));
});

const recordMistake = catchAsync(async (req, res, next) => {
    const newMistake = await mistakeRecordService.createMistakeRecord(req.body, req.user);
    // Audit log can be triggered from service or by subscribing to an event
    if (req.app.locals.auditLog) {
        req.app.locals.auditLog('创建错题记录', req.user.id, {
            mistakeId: newMistake._id,
            studentId: newMistake.student,
            subjectId: newMistake.subject
        });
    }
    res.status(201).json(new AppResponse(201, 'Mistake record created successfully.', newMistake));
});

const updateMistake = catchAsync(async (req, res, next) => {
    const updatedMistake = await mistakeRecordService.updateMistakeRecord(req.params.id, req.body, req.user);
    if (req.app.locals.auditLog) {
        req.app.locals.auditLog('更新错题记录', req.user.id, {
            mistakeId: updatedMistake._id,
            studentId: updatedMistake.student,
            changes: req.body // Be cautious logging full req.body if it contains sensitive data not part of the update
        });
    }
    res.status(200).json(new AppResponse(200, 'Mistake record updated successfully.', updatedMistake));
});

const deleteMistake = catchAsync(async (req, res, next) => {
    const mistakeId = req.params.id; // Capture before deletion for audit log
    // Try to get studentId before deleting. This might fail if record is already gone or for other reasons.
    let studentIdForAudit = null;
    try {
      const record = await mistakeRecordService.getMistakeById(mistakeId); // Use service method to get record
      studentIdForAudit = record ? record.student : null;
    } catch (e) {
      logger.warn(`Could not retrieve mistake record ${mistakeId} for audit logging before deletion.`, { error: e.message });
    }

    await mistakeRecordService.deleteMistakeRecord(mistakeId, req.user);
    
    if (req.app.locals.auditLog && studentIdForAudit) { 
        req.app.locals.auditLog('删除错题记录', req.user.id, {
            mistakeId: mistakeId,
            studentId: studentIdForAudit
        });
    } else if (req.app.locals.auditLog) {
        req.app.locals.auditLog('删除错题记录尝试', req.user.id, {
            mistakeId: mistakeId,
            details: 'Student ID could not be determined for audit log.'
        });
    }
    res.status(200).json(new AppResponse(200, 'Mistake record deleted successfully.'));
});

module.exports = {
    getStudentMistakes,
    getStudentMistakesBySubject,
    recordMistake,
    updateMistake,
    deleteMistake,
}; 