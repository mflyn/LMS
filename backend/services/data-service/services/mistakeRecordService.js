const MistakeRecord = require('../models/MistakeRecord');
// Ensure handleDatabaseError is correctly imported if used, or rely on direct error throwing.
const { NotFoundError, ForbiddenError, BadRequestError, AppError } = require('../../../common/middleware/errorTypes'); 

class MistakeRecordService {
    constructor(logger) {
        this.logger = logger; // Injected logger
    }

    // Helper to fetch a mistake, could be used internally
    async getMistakeById(mistakeId) {
        if (!mistakeId || !mongoose.Types.ObjectId.isValid(mistakeId)) { // Added Mongoose for ObjectId validation
            throw new BadRequestError('Invalid Mistake Record ID format.');
        }
        const mistake = await MistakeRecord.findById(mistakeId);
        if (!mistake) {
            throw new NotFoundError('Mistake record not found.');
        }
        return mistake;
    }

    async getMistakesByStudent(studentId, requestingUser) {
        if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
            throw new BadRequestError('Invalid Student ID format.');
        }
        // Permission: Student can see their own. Teacher/Admin/Parent can see student's.
        if (requestingUser.role === 'student' && requestingUser.id !== studentId) {
            throw new ForbiddenError('Students can only view their own mistake records.');
        }
        // TODO: Add specific checks for parents (child linkage) and teachers (student in class).

        this.logger.info(`Fetching mistake records for student ${studentId}`, { requestingUserId: requestingUser.id, requestingUserRole: requestingUser.role });
        const mistakes = await MistakeRecord.find({ student: studentId })
            .sort({ date: -1 })
            .populate('subject', 'name'); 

        this.logger.info(`Found ${mistakes.length} mistake records for student ${studentId}.`);
        return mistakes;
    }

    async getMistakesByStudentAndSubject(studentId, subjectId, requestingUser) {
        if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
            throw new BadRequestError('Invalid Student ID format.');
        }
        if (!subjectId || !mongoose.Types.ObjectId.isValid(subjectId)) {
            throw new BadRequestError('Invalid Subject ID format.');
        }
        if (requestingUser.role === 'student' && requestingUser.id !== studentId) {
            throw new ForbiddenError('Students can only view their own mistake records.');
        }
        // TODO: Add specific checks for parents and teachers.

        this.logger.info(`Fetching mistake records for student ${studentId} and subject ${subjectId}`, { requestingUserId: requestingUser.id });
        const mistakes = await MistakeRecord.find({ student: studentId, subject: subjectId })
            .sort({ date: -1 })
            .populate('subject', 'name');

        this.logger.info(`Found ${mistakes.length} mistake records for student ${studentId}, subject ${subjectId}.`);
        return mistakes;
    }

    async createMistakeRecord(data, creatingUser) {
        const { student, subject, question, answer, correctAnswer, analysis, tags, source } = data;

        if (creatingUser.role === 'student' && creatingUser.id !== student) {
            throw new ForbiddenError('Students can only create mistake records for themselves.');
        }

        try {
            const mistakeRecord = new MistakeRecord({
                student,
                subject,
                question,
                answer,
                correctAnswer,
                analysis,
                tags,
                source,
                date: new Date(), 
                createdBy: creatingUser.id,
            });
            const savedRecord = await mistakeRecord.save();
            this.logger.info('Mistake record created successfully', { recordId: savedRecord._id, studentId: student, createdBy: creatingUser.id });
            return savedRecord;
        } catch (err) {
            this.logger.error('Error creating mistake record', { error: {name: err.name, message: err.message, stack: err.stack}, studentId: student, createdBy: creatingUser.id });
            if (err.name === 'ValidationError') { 
                 throw new BadRequestError(err.message, err.errors);
            }
            if (err.code === 11000) { // Duplicate key
                throw new AppError('Failed to create mistake record due to a duplicate entry.', 409); // 409 Conflict
            }
            throw new AppError('Failed to create mistake record due to a database issue.', 500);
        }
    }

    async updateMistakeRecord(mistakeId, updateData, requestingUser) {
        const mistakeRecord = await this.getMistakeById(mistakeId); 

        let canUpdate = false;
        if (requestingUser.id === mistakeRecord.createdBy.toString()) {
            canUpdate = true; 
        }
        if (['teacher', 'admin', 'superadmin'].includes(requestingUser.role)) {
            canUpdate = true; 
        }

        if (!canUpdate) {
            throw new ForbiddenError('You do not have permission to update this mistake record.');
        }

        // Apply updates explicitly
        const fieldsToUpdate = ['question', 'answer', 'correctAnswer', 'analysis', 'tags', 'status', 'subject', 'date'];
        fieldsToUpdate.forEach(field => {
            if (updateData.hasOwnProperty(field)) {
                mistakeRecord[field] = updateData[field];
            }
        });
        
        mistakeRecord.updatedAt = new Date();
        mistakeRecord.updatedBy = requestingUser.id;

        try {
            const updatedRecord = await mistakeRecord.save();
            this.logger.info('Mistake record updated successfully', { recordId: updatedRecord._id, updatedBy: requestingUser.id });
            return updatedRecord;
        } catch (err) {
            this.logger.error('Error updating mistake record', { error: {name: err.name, message: err.message, stack: err.stack}, recordId: mistakeId, updatedBy: requestingUser.id });
             if (err.name === 'ValidationError') {
                 throw new BadRequestError(err.message, err.errors);
            }
            throw new AppError('Failed to update mistake record due to a database issue.', 500);
        }
    }

    async deleteMistakeRecord(mistakeId, requestingUser) {
        const mistakeRecord = await this.getMistakeById(mistakeId); 

        let canDelete = false;
        if (requestingUser.id === mistakeRecord.createdBy.toString()) {
            canDelete = true; 
        }
        if (['admin', 'superadmin'].includes(requestingUser.role)) {
            canDelete = true;
        }

        if (!canDelete) {
            throw new ForbiddenError('You do not have permission to delete this mistake record.');
        }

        await MistakeRecord.findByIdAndDelete(mistakeId);
        this.logger.info('Mistake record deleted successfully', { recordId: mistakeId, deletedBy: requestingUser.id });
    }
}

// Need to import mongoose for ObjectId.isValid check
const mongoose = require('mongoose');

module.exports = MistakeRecordService; 