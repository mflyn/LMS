const ClassPerformance = require('../models/ClassPerformance');
const Subject = require('../models/Subject'); // Assuming Subject model is available
const Class = require('../models/Class');   // Assuming Class model is available
const { NotFoundError, ForbiddenError, BadRequestError, AppError } = require('../../../common/middleware/errorTypes');
// mongoose import might not be strictly needed here if all ObjectId checks are done by middleware/validators

class ClassPerformanceService {
    constructor(logger) {
        this.logger = logger;
    }

    async getPerformanceForStudent(studentId, requestingUser, queryParams = {}) {
        this.logger.info(`[ClassPerformanceService] Getting performance for student ${studentId}`, { requestingUserId: requestingUser.id, queryParams });
        
        // Permission check
        if (requestingUser.role === 'student' && requestingUser.id !== studentId) {
            this.logger.warn(`[ClassPerformanceService] Forbidden: Student ${requestingUser.id} viewing student ${studentId} performance.`);
            throw new ForbiddenError('You are not authorized to view this student\'s performance records.');
        }
        // TODO: Implement parent/teacher specific access logic.

        const filterQuery = { student: studentId };
        if (queryParams.subject) filterQuery.subject = queryParams.subject;
        if (queryParams.type) filterQuery.type = queryParams.type;
        if (queryParams.dateFrom || queryParams.dateTo) {
            filterQuery.date = {};
            if (queryParams.dateFrom) filterQuery.date.$gte = new Date(queryParams.dateFrom);
            if (queryParams.dateTo) filterQuery.date.$lte = new Date(queryParams.dateTo);
        }

        const limit = parseInt(queryParams.limit, 10) || 10;
        const page = parseInt(queryParams.page, 10) || 1;
        const sortBy = queryParams.sortBy || 'date';
        const sortOrder = queryParams.sortOrder === 'asc' ? 1 : -1;

        const performancesQuery = ClassPerformance.find(filterQuery)
            .populate('recordedBy', 'username name')
            .populate('subject', 'name') // Populate subject
            .populate('class', 'name')   // Populate class
            .sort({ [sortBy]: sortOrder })
            .skip((page - 1) * limit)
            .limit(limit);
        
        const performances = await performancesQuery.exec();
        const totalPerformances = await ClassPerformance.countDocuments(filterQuery);

        this.logger.info(`[ClassPerformanceService] Retrieved ${performances.length} of ${totalPerformances} for student ${studentId}.`);
        return {
            data: performances,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalPerformances / limit),
                totalItems: totalPerformances,
                itemsPerPage: limit
            }
        };
    }

    async getPerformanceForClass(classId, requestingUser, queryParams = {}) {
        this.logger.info(`[ClassPerformanceService] Getting performance for class ${classId}`, { requestingUserId: requestingUser.id, queryParams });
        // Basic role check is done by router, more granular (e.g. teacher is for *this* class) can be here.
        // TODO: Implement specific teacher-class linkage check if necessary.

        const filterQuery = { class: classId };
        if (queryParams.subject) filterQuery.subject = queryParams.subject;
        if (queryParams.type) filterQuery.type = queryParams.type;
        if (queryParams.dateFrom || queryParams.dateTo) {
            filterQuery.date = {};
            if (queryParams.dateFrom) filterQuery.date.$gte = new Date(queryParams.dateFrom);
            if (queryParams.dateTo) filterQuery.date.$lte = new Date(queryParams.dateTo);
        }

        const limit = parseInt(queryParams.limit, 10) || 10;
        const page = parseInt(queryParams.page, 10) || 1;
        const sortBy = queryParams.sortBy || 'date';
        const sortOrder = queryParams.sortOrder === 'asc' ? 1 : -1;

        const performancesQuery = ClassPerformance.find(filterQuery)
            .populate('student', 'username name')
            .populate('recordedBy', 'username name')
            .populate('subject', 'name')
            .sort({ [sortBy]: sortOrder })
            .skip((page - 1) * limit)
            .limit(limit);

        const performances = await performancesQuery.exec();
        const totalPerformances = await ClassPerformance.countDocuments(filterQuery);
        
        this.logger.info(`[ClassPerformanceService] Retrieved ${performances.length} of ${totalPerformances} for class ${classId}.`);
        return {
            data: performances,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalPerformances / limit),
                totalItems: totalPerformances,
                itemsPerPage: limit
            }
        };
    }

    async recordStudentPerformance(performanceData, recordingUser) {
        const { student, class: classId, subject, type, comments, date, score } = performanceData; // Using 'comments', added 'subject'
        this.logger.info('[ClassPerformanceService] Recording performance', { studentId: student, classId, subjectId: subject, recordedBy: recordingUser.id });

        // Existence checks
        const subjectExists = await Subject.findById(subject);
        if (!subjectExists) throw new BadRequestError(`Subject with ID ${subject} not found.`);
        const classExists = await Class.findById(classId);
        if (!classExists) throw new BadRequestError(`Class with ID ${classId} not found.`);
        // TODO: User (student) existence check - inter-service call or event consistency

        const newPerformance = new ClassPerformance({
            student,
            class: classId,
            subject, // Added subject
            type,
            comments,
            score, // score is now correctly passed
            date: date ? new Date(date) : new Date(),
            recordedBy: recordingUser.id
        });

        try {
            const savedPerformance = await newPerformance.save(); // This will trigger model's conditional validation for comments
            this.logger.info(`[ClassPerformanceService] Performance record ${savedPerformance._id} created.`);
            return savedPerformance;
        } catch (error) {
            this.logger.error('[ClassPerformanceService] Error recording performance', { error: { message: error.message, stack: error.stack }, performanceData });
            if (error.name === 'ValidationError') {
                throw new BadRequestError(`Validation failed: ${Object.values(error.errors).map(e => e.message).join(', ')}`);
            }
            throw new AppError('Failed to record performance due to a server error.', 500);
        }
    }

    async updateStudentPerformance(performanceId, updateData, requestingUser) {
        this.logger.info(`[ClassPerformanceService] Updating performance ${performanceId}`, { updateData, requestingUserId: requestingUser.id });
        const performance = await ClassPerformance.findById(performanceId);

        if (!performance) {
            throw new NotFoundError('Performance record not found.');
        }

        if (performance.recordedBy.toString() !== requestingUser.id && 
            !['admin', 'superadmin'].includes(requestingUser.role)) {
            this.logger.warn(`[ClassPerformanceService] Forbidden: User ${requestingUser.id} updating performance ${performanceId} not recorded by them.`);
            throw new ForbiddenError('You are not authorized to update this performance record.');
        }
        
        // Fields like student, class, subject are generally not updatable for a performance record.
        // If they are in updateData, ignore or throw error.
        const forbiddenUpdateFields = ['student', 'class', 'subject', 'recordedBy'];
        for (const field of forbiddenUpdateFields) {
            if (updateData.hasOwnProperty(field)) {
                this.logger.warn(`[ClassPerformanceService] Attempt to update restricted field '${field}' on performance ${performanceId}.`);
                throw new BadRequestError(`Field '${field}' cannot be updated.`);
            }
        }

        // Apply updatable fields
        if (updateData.type !== undefined) performance.type = updateData.type;
        if (updateData.comments !== undefined) performance.comments = updateData.comments; // Using 'comments'
        if (updateData.score !== undefined) performance.score = updateData.score; // score is now handled
        if (updateData.date !== undefined) performance.date = new Date(updateData.date);

        try {
            const updatedPerformance = await performance.save(); // Model validation (e.g. score/comment presence) will run here
            this.logger.info(`[ClassPerformanceService] Performance record ${performanceId} updated.`);
            return updatedPerformance;
        } catch (error) {
            this.logger.error(`[ClassPerformanceService] Error updating performance ${performanceId}`, { error: { message: error.message, stack: error.stack }, updateData });
            if (error.name === 'ValidationError') {
                throw new BadRequestError(`Validation failed: ${Object.values(error.errors).map(e => e.message).join(', ')}`);
            }
            throw new AppError('Failed to update performance due to a server error.', 500);
        }
    }

    async deleteStudentPerformance(performanceId, requestingUser) {
        this.logger.info(`[ClassPerformanceService] Deleting performance ${performanceId}`, { requestingUserId: requestingUser.id });
        const performance = await ClassPerformance.findById(performanceId);

        if (!performance) {
            throw new NotFoundError('Performance record not found.');
        }
        if (performance.recordedBy.toString() !== requestingUser.id && 
            !['admin', 'superadmin'].includes(requestingUser.role)) {
            this.logger.warn(`[ClassPerformanceService] Forbidden: User ${requestingUser.id} deleting performance ${performanceId} not recorded by them.`);
            throw new ForbiddenError('You are not authorized to delete this performance record.');
        }

        try {
            await ClassPerformance.findByIdAndDelete(performanceId);
            this.logger.info(`[ClassPerformanceService] Performance record ${performanceId} deleted.`);
            return { message: 'Performance record deleted successfully' };
        } catch (error) {
            this.logger.error(`[ClassPerformanceService] Error deleting performance ${performanceId}`, { error: { message: error.message, stack: error.stack } });
            throw new AppError('Failed to delete performance due to a server error.', 500);
        }
    }
}

module.exports = ClassPerformanceService; 