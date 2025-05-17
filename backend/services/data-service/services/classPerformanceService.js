const ClassPerformance = require('../models/ClassPerformance');
const { NotFoundError, ForbiddenError, BadRequestError, AppError } = require('../../../common/middleware/errorTypes');

class ClassPerformanceService {
    constructor(logger) {
        this.logger = logger;
    }

    async getPerformanceForStudent(studentId, requestingUser) {
        if (!studentId) {
            throw new BadRequestError('Student ID is required.');
        }
        // Permission check
        if (requestingUser.role === 'student' && requestingUser.id !== studentId) {
            throw new ForbiddenError('You are not authorized to view this student\'s performance records.');
        }
        // TODO: Add logic for parents to view their children\'s records.
        // TODO: Add logic for teachers to view records of students in their classes.
        // Admins/Superadmins can bypass these if not student themselves.

        const performances = await ClassPerformance.find({ student: studentId })
            .sort({ date: -1 })
            .populate('recordedBy', 'username name') // Assuming 'username' or 'name' exists on User model
            .populate('student', 'username name'); // Populate student details for context if needed

        this.logger.info(`Retrieved ${performances.length} performance records for student ${studentId} by user ${requestingUser.id}`);
        return performances;
    }

    async getPerformanceForClass(classId, requestingUser) {
        if (!classId) {
            throw new BadRequestError('Class ID is required.');
        }
        // Teachers, Admins, Superadmins can view class performance
        // No specific check against req.user.classId here, as teachers might oversee multiple classes.
        // checkRole in router already limits this to teacher/admin/superadmin.

        const performances = await ClassPerformance.find({ class: classId }) // Ensure 'class' field exists in model
            .sort({ date: -1 })
            .populate('student', 'username name')
            .populate('recordedBy', 'username name');
        this.logger.info(`Retrieved ${performances.length} performance records for class ${classId} by user ${requestingUser.id}`);
        return performances;
    }

    async recordStudentPerformance(performanceData, recordingUser) {
        const { student, class: classId, type, description, date, score } = performanceData; // Added score

        // 'class' is a reserved keyword, ensure model field is different e.g., 'studentClass' or 'classRef'
        // For this example, assuming model uses 'class' as field name based on original route
        const newPerformance = new ClassPerformance({
            student,
            class: classId, // student's class ID
            type,
            description,
            score, // Added score
            date: date || new Date(),
            recordedBy: recordingUser.id
        });

        const savedPerformance = await newPerformance.save();
        this.logger.info(`New class performance record ${savedPerformance._id} created for student ${student} by user ${recordingUser.id}.`);
        return savedPerformance;
    }

    async updateStudentPerformance(performanceId, updateData, requestingUser) {
        const { type, description, score, date } = updateData; // Added score and date
        const performance = await ClassPerformance.findById(performanceId);

        if (!performance) {
            throw new NotFoundError('Performance record not found.');
        }

        // Authorization: Only the teacher who recorded (or admin/superadmin) can update.
        // This can be more granular, e.g. any teacher of that class.
        if (performance.recordedBy.toString() !== requestingUser.id && 
            !['admin', 'superadmin'].includes(requestingUser.role)) {
            throw new ForbiddenError('You are not authorized to update this performance record.');
        }
        
        // Explicitly update fields if they are provided in updateData
        if (type !== undefined) performance.type = type;
        if (description !== undefined) performance.description = description;
        if (score !== undefined) performance.score = score;
        if (date !== undefined) performance.date = date;
        
        // Ensure updatedAt is set if your schema doesn't do it automatically
        // performance.updatedAt = new Date(); 

        const updatedPerformance = await performance.save();
        this.logger.info(`Performance record ${performanceId} updated by user ${requestingUser.id}.`);
        return updatedPerformance;
    }

    async deleteStudentPerformance(performanceId, requestingUser) {
        const performance = await ClassPerformance.findById(performanceId);

        if (!performance) {
            throw new NotFoundError('Performance record not found.');
        }
        // Authorization: Similar to update, or stricter.
        if (performance.recordedBy.toString() !== requestingUser.id && 
            !['admin', 'superadmin'].includes(requestingUser.role)) {
            throw new ForbiddenError('You are not authorized to delete this performance record.');
        }

        await ClassPerformance.findByIdAndDelete(performanceId);
        this.logger.info(`Performance record ${performanceId} deleted by user ${requestingUser.id}.`);
        // No specific return needed for delete, or return the deleted object if useful.
    }
}

module.exports = ClassPerformanceService; 