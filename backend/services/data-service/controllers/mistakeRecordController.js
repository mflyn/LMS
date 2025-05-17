const MistakeRecordService = require('../services/mistakeRecordService'); // Import the class
const { catchAsync } = require('../../../common/middleware/errorHandler');
const { AppResponse } = require('../../../common/utils/appResponse');

class MistakeRecordController {
  constructor() {
    // Service instance will be created per request via _getServiceInstance
  }

  _getServiceInstance(req) {
    if (!this.mistakeRecordService || this.mistakeRecordService.logger !== req.app.locals.logger) {
        this.mistakeRecordService = new MistakeRecordService(req.app.locals.logger);
    }
    return this.mistakeRecordService;
  }

  getStudentMistakes = catchAsync(async (req, res, next) => {
    const service = this._getServiceInstance(req);
    const { studentId } = req.params;
    const requestingUser = req.user;
    const queryParams = req.query;

    const result = await service.getMistakesByStudent(studentId, requestingUser, queryParams);
    res.status(200).json(new AppResponse(200, 'Student mistake records retrieved successfully.', result.data, null, result.pagination));
  });

  getStudentMistakesBySubject = catchAsync(async (req, res, next) => {
    const service = this._getServiceInstance(req);
    const { studentId, subjectId } = req.params;
    const requestingUser = req.user;
    const queryParams = req.query;

    const result = await service.getMistakesByStudentAndSubject(studentId, subjectId, requestingUser, queryParams);
    res.status(200).json(new AppResponse(200, 'Student mistake records for subject retrieved successfully.', result.data, null, result.pagination));
  });

  recordMistake = catchAsync(async (req, res, next) => {
    const service = this._getServiceInstance(req);
    const mistakeData = req.body;
    const requestingUser = req.user;

    const newMistake = await service.createMistakeRecord(mistakeData, requestingUser);
    
    if (req.app.locals.auditLog) {
        req.app.locals.auditLog('创建错题记录', req.user.id, {
            mistakeId: newMistake._id,
            studentId: newMistake.student,
            subjectId: newMistake.subject
        });
    }
    res.status(201).json(new AppResponse(201, 'Mistake record created successfully.', newMistake));
  });

  updateMistake = catchAsync(async (req, res, next) => {
    const service = this._getServiceInstance(req);
    const { id: mistakeId } = req.params;
    const updateData = req.body;
    const requestingUser = req.user;

    const updatedMistake = await service.updateMistakeRecord(mistakeId, updateData, requestingUser);
    
    if (req.app.locals.auditLog) {
        // Log only specific, non-sensitive identifiers or a summary of changes from service layer if available
        const auditChanges = {};
        if(updateData.status) auditChanges.status = updateData.status;
        if(updateData.resolvedDate) auditChanges.resolvedDate = updateData.resolvedDate;
        // Avoid logging full req.body like 'question', 'answer' etc. unless explicitly sanitized

        req.app.locals.auditLog('更新错题记录', req.user.id, {
            mistakeId: updatedMistake._id,
            studentId: updatedMistake.student,
            changes: auditChanges // Log a curated list of changes
        });
    }
    res.status(200).json(new AppResponse(200, 'Mistake record updated successfully.', updatedMistake));
  });

  deleteMistake = catchAsync(async (req, res, next) => {
    const service = this._getServiceInstance(req);
    const { id: mistakeId } = req.params;
    const requestingUser = req.user;
    const logger = req.app.locals.logger; // For direct use if needed before service instantiation for audit

    let studentIdForAudit = null;
    try {
      // Assuming service.getMistakeById might not be the primary way if service itself logs details or is complex
      // Or, ensure service.getMistakeById exists and is efficient
      const record = await service.getMistakeById(mistakeId, requestingUser); // Pass user for permission check if service needs it
      studentIdForAudit = record ? record.student : null;
    } catch (e) {
      logger.warn(`Could not retrieve mistake record ${mistakeId} for audit logging before deletion.`, { error: e.message });
    }

    await service.deleteMistakeRecord(mistakeId, requestingUser);
    
    if (req.app.locals.auditLog && studentIdForAudit) { 
        req.app.locals.auditLog('删除错题记录', req.user.id, {
            mistakeId: mistakeId,
            studentId: studentIdForAudit
        });
    } else if (req.app.locals.auditLog) {
        req.app.locals.auditLog('删除错题记录尝试', req.user.id, {
            mistakeId: mistakeId,
            details: 'Student ID for audit log could not be determined or record did not exist prior to delete call.'
        });
    }
    res.status(200).json(new AppResponse(200, 'Mistake record deleted successfully.'));
  });
}

module.exports = new MistakeRecordController(); 