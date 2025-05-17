const mongoose = require('mongoose');
const MistakeRecord = require('../models/MistakeRecord');
// Ensure handleDatabaseError is correctly imported if used, or rely on direct error throwing.
const { NotFoundError, ForbiddenError, BadRequestError, AppError } = require('../../../common/middleware/errorTypes'); 

class MistakeRecordService {
    constructor(logger) {
        this.logger = logger; // Injected logger
    }

    // Helper to fetch a mistake, could be used internally
    async getMistakeById(mistakeId, requestingUser = null) {
        if (!mistakeId || !mongoose.Types.ObjectId.isValid(mistakeId)) {
            throw new BadRequestError('Invalid Mistake Record ID format.');
        }
        const mistake = await MistakeRecord.findById(mistakeId);
        if (!mistake) {
            throw new NotFoundError('Mistake record not found.');
        }

        // Optional: Add permission check if requestingUser is provided
        // For example, if only admin or owner can fetch by raw ID directly.
        // if (requestingUser) {
        //     if (requestingUser.role !== 'admin' && mistake.recordedBy.toString() !== requestingUser.id) {
        //         // Or specific logic for teachers/parents if they can access via this method
        //         throw new ForbiddenError('You do not have permission to view this specific mistake record directly.');
        //     }
        // }
        return mistake;
    }

    async getMistakesByStudent(studentId, requestingUser, queryParams = {}) {
        if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
            throw new BadRequestError('Invalid Student ID format.');
        }

        // Basic permission check
        if (requestingUser.role === 'student' && requestingUser.id !== studentId) {
            throw new ForbiddenError('Students can only view their own mistake records.');
        }
        // TODO: Add specific checks for parents (child linkage) and teachers (student in class).
        // For example:
        // if (requestingUser.role === 'parent') {
        //   const isParentOfStudent = await checkParentChildLink(requestingUser.id, studentId);
        //   if (!isParentOfStudent) throw new ForbiddenError('Parents can only view their own children\\'s mistake records.');
        // }
        // if (requestingUser.role === 'teacher') {
        //   const isTeacherOfStudent = await checkTeacherStudentLink(requestingUser.id, studentId);
        //   if (!isTeacherOfStudent) throw new ForbiddenError('Teachers can only view mistake records of students in their classes.');
        // }


        this.logger.info(`Fetching mistake records for student ${studentId}`, { requestingUserId: requestingUser.id, requestingUserRole: requestingUser.role, queryParams });
        
        const {
            page = 1,
            limit = 10,
            sortBy = 'createdAt', // Default sort by 'createdAt' from timestamps
            sortOrder = 'desc',
            status,
            tags, // Assuming tags is a comma-separated string from query
            dateFrom,
            dateTo
        } = queryParams;

        const query = { student: studentId };

        if (status) query.status = status;
        if (tags) query.tags = { $in: tags.split(',').map(tag => tag.trim()) };
        if (dateFrom || dateTo) {
            query.createdAt = {}; // Use createdAt from timestamps
            if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
            if (dateTo) query.createdAt.$lte = new Date(dateTo);
        }
        
        const sortOptions = {};
        if (['createdAt', 'resolvedDate', 'status'].includes(sortBy)) {
            sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
        } else {
            sortOptions['createdAt'] = -1; // Default sort
        }

        const totalRecords = await MistakeRecord.countDocuments(query);
        const mistakes = await MistakeRecord.find(query)
            .sort(sortOptions)
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('subject', 'name code') // Populate subject with name and code
            .lean(); // Use .lean() for performance if not modifying docs

        this.logger.info(`Found ${mistakes.length} mistake records for student ${studentId}. Total: ${totalRecords}`);
        return {
            data: mistakes,
            pagination: {
                total: totalRecords,
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
                pages: Math.ceil(totalRecords / limit)
            }
        };
    }

    async getMistakesByStudentAndSubject(studentId, subjectId, requestingUser, queryParams = {}) {
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

        this.logger.info(`Fetching mistake records for student ${studentId} and subject ${subjectId}`, { requestingUserId: requestingUser.id, queryParams });
        
        const {
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            status,
            tags,
            dateFrom,
            dateTo
        } = queryParams;

        const query = { student: studentId, subject: subjectId };

        if (status) query.status = status;
        if (tags) query.tags = { $in: tags.split(',').map(tag => tag.trim()) };
        if (dateFrom || dateTo) {
            query.createdAt = {};
            if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
            if (dateTo) query.createdAt.$lte = new Date(dateTo);
        }

        const sortOptions = {};
        if (['createdAt', 'resolvedDate', 'status'].includes(sortBy)) {
            sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
        } else {
            sortOptions['createdAt'] = -1;
        }

        const totalRecords = await MistakeRecord.countDocuments(query);
        const mistakes = await MistakeRecord.find(query)
            .sort(sortOptions)
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('subject', 'name code')
            .lean();

        this.logger.info(`Found ${mistakes.length} mistake records for student ${studentId}, subject ${subjectId}. Total: ${totalRecords}`);
        return {
            data: mistakes,
            pagination: {
                total: totalRecords,
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
                pages: Math.ceil(totalRecords / limit)
            }
        };
    }

    async createMistakeRecord(data, creatingUser) {
        // studentId is expected in data, not creatingUser.id for student field unless student is creating for self
        const { student, subject, question, answer, correctAnswer, analysis, tags, source, status } = data;

        if (!student || !mongoose.Types.ObjectId.isValid(student)) {
            throw new BadRequestError('Valid student ID is required.');
        }
        if (!subject || !mongoose.Types.ObjectId.isValid(subject)) {
            throw new BadRequestError('Valid subject ID is required.');
        }


        if (creatingUser.role === 'student' && creatingUser.id !== student) {
            throw new ForbiddenError('Students can only create mistake records for themselves.');
        }
        // Teachers/Admins can create for any student (assuming student ID is provided in data)

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
                status: status || 'unresolved', // Default status if not provided
                recordedBy: creatingUser.id,
                // 'createdAt' and 'updatedAt' are handled by timestamps: true in the model
            });
            const savedRecord = await mistakeRecord.save();
            this.logger.info('Mistake record created successfully', { recordId: savedRecord._id, studentId: student, recordedBy: creatingUser.id });
            return savedRecord;
        } catch (err) {
            this.logger.error('Error creating mistake record', { error: {name: err.name, message: err.message, stack: err.stack}, studentId: student, recordedBy: creatingUser.id });
            if (err.name === 'ValidationError') { 
                 throw new BadRequestError(err.message, err.errors);
            }
            if (err.code === 11000) { // Duplicate key
                // TODO: Parse the duplicate key error to provide a more specific message if possible
                // For example, if there's a unique index on (student, question, subject)
                throw new AppError('Failed to create mistake record due to a duplicate entry (e.g., same question for student and subject).', 409); // 409 Conflict
            }
            // Consider using a generic database error handler if one exists in common middleware
            throw new AppError('Failed to create mistake record due to a database issue.', 500);
        }
    }

    async updateMistakeRecord(mistakeId, updateData, requestingUser) {
        const mistakeRecord = await this.getMistakeById(mistakeId); // this.getMistakeById already throws NotFoundError

        let canUpdate = false;
        // Owner can update
        if (requestingUser.id === mistakeRecord.recordedBy.toString()) {
            canUpdate = true; 
        }
        // Teachers can update records of students (need further logic for "their" students)
        // Admins/Superadmins can update
        if (['teacher', 'admin', 'superadmin'].includes(requestingUser.role)) {
            // TODO: For 'teacher', add check if mistakeRecord.student is one of their students
            canUpdate = true; 
        }

        if (!canUpdate) {
            throw new ForbiddenError('You do not have permission to update this mistake record.');
        }

        // Define fields that are allowed to be updated
        const allowedUpdates = ['question', 'answer', 'correctAnswer', 'analysis', 'tags', 'status', 'source', 'resolvedDate'];
        
        Object.keys(updateData).forEach(key => {
            if (allowedUpdates.includes(key)) {
                // Special handling for resolvedDate if status is changing to 'resolved'
                if (key === 'status' && updateData[key] === 'resolved' && !updateData.resolvedDate) {
                    mistakeRecord.resolvedDate = new Date();
                } else if (key === 'resolvedDate' && updateData[key] === null) { // Allow clearing resolvedDate
                    mistakeRecord.resolvedDate = null;
                }
                mistakeRecord[key] = updateData[key];
            }
        });
        
        // `updatedAt` is handled by timestamps: true
        mistakeRecord.updatedBy = requestingUser.id; // Set who updated it

        try {
            const updatedRecord = await mistakeRecord.save();
            this.logger.info('Mistake record updated successfully', { recordId: updatedRecord._id, updatedBy: requestingUser.id });
            return updatedRecord;
        } catch (err) {
            this.logger.error('Error updating mistake record', { error: {name: err.name, message: err.message, stack: err.stack}, recordId: mistakeId, updatedBy: requestingUser.id });
             if (err.name === 'ValidationError') {
                 throw new BadRequestError(err.message, err.errors);
            }
            // Consider using a generic database error handler
            throw new AppError('Failed to update mistake record due to a database issue.', 500);
        }
    }

    async deleteMistakeRecord(mistakeId, requestingUser) {
        const mistakeRecord = await this.getMistakeById(mistakeId); 

        let canDelete = false;
        // Owner can delete
        if (requestingUser.id === mistakeRecord.recordedBy.toString()) {
            canDelete = true; 
        }
        // Admins/Superadmins can delete
        if (['admin', 'superadmin'].includes(requestingUser.role)) {
            canDelete = true;
        }
        // TODO: Teachers might be able to delete records of their students, needs specific business rule
        // if (requestingUser.role === 'teacher') {
        //    const isTeacherOfStudent = await checkTeacherStudentLink(requestingUser.id, mistakeRecord.student.toString());
        //    if (isTeacherOfStudent) canDelete = true;
        // }


        if (!canDelete) {
            throw new ForbiddenError('You do not have permission to delete this mistake record.');
        }

        // Instead of findByIdAndDelete, use instance.deleteOne() if you have the document
        await mistakeRecord.deleteOne(); 
        // Or: await MistakeRecord.findByIdAndDelete(mistakeId); // if you prefer static method

        this.logger.info('Mistake record deleted successfully', { recordId: mistakeId, deletedBy: requestingUser.id });
        // No return value needed for delete typically, or return a confirmation object
    }
}

// const mongoose = require('mongoose'); // Already moved to top

module.exports = MistakeRecordService; 