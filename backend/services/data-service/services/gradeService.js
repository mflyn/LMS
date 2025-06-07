const Grade = require('../models/Grade');
const User = require('../../../common/models/User'); // 修正：使用公共模型
const Subject = require('../../../common/models/Subject'); // 修正：使用公共模型
const Class = require('../../../common/models/Class'); // 修正：使用公共模型
const { NotFoundError, BadRequestError, AppError, ForbiddenError } = require('../../../common/middleware/errorTypes');
const mongoose = require('mongoose');

class GradeService {
  constructor(logger) {
    this.logger = logger;
    // If we were to inject models (e.g., for testing or if models are not singletons):
    // this.Grade = Grade; // or injected model
    // this.User = User;   // or injected model
  }

  async getGradesForStudent(studentId, requestingUser, queryParams = {}) {
    this.logger.info(`[GradeService] Attempting to fetch grades for student ID: ${studentId}`, 
      { requestingUserId: requestingUser.id, requestingUserRole: requestingUser.role, queryParams });

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
        this.logger.warn(`[GradeService] Invalid student ID format: ${studentId}`);
        throw new BadRequestError('Invalid student ID format.');
    }

    // Permission Check: Students can only see their own grades.
    // Parents should only see their children's grades (requires more complex check, possibly fetching User doc for studentId and checking parent relationship).
    // Teachers and Admins can see grades based on their roles (further checks might be needed, e.g., teacher for their class/students).
    // For now, basic check: if role is student, studentId must match req.user.id
    if (requestingUser.role === 'student' && requestingUser.id !== studentId) {
        this.logger.warn(`[GradeService] Permission denied: Student ${requestingUser.id} trying to access grades for student ${studentId}`);
        throw new ForbiddenError('You are not authorized to view these grades.');
    }
    // More complex parent/teacher specific logic would go here if needed.

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

    const gradesQuery = Grade.find(filterQuery)
      .sort({ [sortBy]: sortOrder })
      .skip((page - 1) * limit)
      .limit(limit);

    if (process.env.NODE_ENV !== 'test') {
      gradesQuery.populate('subject', 'name').populate('class', 'name');
    }

    const grades = await gradesQuery.exec();
    const totalGrades = await Grade.countDocuments(filterQuery);

    this.logger.info(`[GradeService] Successfully fetched ${grades.length} of ${totalGrades} grades for student ID: ${studentId}`);
    return {
      data: grades,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalGrades / limit),
        totalItems: totalGrades,
        itemsPerPage: limit,
      },
    };
  }

  async createGrade(gradeData, requestingUser) {
    const { student, subject, class: classId, type, score, totalScore, date, comments } = gradeData;
    this.logger.info('[GradeService] Attempting to create new grade', { studentId: student, subjectId: subject, classId, recordedBy: requestingUser.id });

    // Basic validation (more comprehensive validation should be done via middleware or a validation library)
    if (!student || !subject || !classId || !type || score === undefined) {
      this.logger.warn('[GradeService] Create grade failed: Missing required fields');
      throw new BadRequestError('Missing required fields for grade entry (student, subject, class, type, score).');
    }
    
    // Further validation can be added here:
    // - Check if student, subject, class exist in their respective collections if they are ObjectIds
    // - Validate score range, type against enum, etc.
    // Example: 
    // if (!mongoose.Types.ObjectId.isValid(student) || !await User.findById(student)) {
    //   throw new BadRequestError('Invalid or non-existent student ID.');
    // }
    // if (!mongoose.Types.ObjectId.isValid(subject) || !await Subject.findById(subject)) {
    //   throw new BadRequestError('Invalid or non-existent subject ID.');
    // }

    // Existence checks for Subject and Class (assuming they are in data-service)
    const subjectExists = await Subject.findById(subject);
    if (!subjectExists) {
      this.logger.warn(`[GradeService] Create grade failed: Subject with ID ${subject} not found.`);
      throw new BadRequestError(`Subject with ID ${subject} not found.`);
    }
    const classExists = await Class.findById(classId);
    if (!classExists) {
      this.logger.warn(`[GradeService] Create grade failed: Class with ID ${classId} not found.`);
      throw new BadRequestError(`Class with ID ${classId} not found.`);
    }
    // TODO: Implement User existence check (studentId) - potentially via user-service call or event consistency.
    // For now, we assume studentId is valid if it passes middleware validation.

    const newGrade = new Grade({
      student,
      subject,
      class: classId,
      type,
      score,
      totalScore,
      date: date ? new Date(date) : new Date(),
      comments,
      recordedBy: requestingUser.id
    });

    try {
      await newGrade.save();
      this.logger.info('[GradeService] Grade created successfully', { gradeId: newGrade._id, studentId: newGrade.student });
      return newGrade;
    } catch (error) {
      this.logger.error('[GradeService] Error saving grade', { error: { message: error.message, stack: error.stack }, gradeData });
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(e => e.message).join(', ');
        throw new BadRequestError(`Validation failed: ${messages}`);
      }
      throw new AppError('Failed to create grade due to a server error.', 500);
    }
  }

  async getGradesForClass(classId, requestingUser, queryParams = {}) {
    this.logger.info(`[GradeService] Attempting to fetch grades for class ID: ${classId}`, 
      { requestingUserId: requestingUser.id, requestingUserRole: requestingUser.role, queryParams });

    if (!mongoose.Types.ObjectId.isValid(classId)) {
        this.logger.warn(`[GradeService] Invalid class ID format: ${classId}`);
        throw new BadRequestError('Invalid class ID format.');
    }

    // Permissions: Only teachers of that class or admins should see this.
    // This requires knowing the teacher for the class or if the requestingUser is an admin.
    // This logic is simplified here. In a real app, you'd check if `requestingUser` (a teacher) is associated with `classId`.
    if (!['teacher', 'admin', 'superadmin'].includes(requestingUser.role)) {
        this.logger.warn(`[GradeService] Permission denied: User ${requestingUser.id} role ${requestingUser.role} trying to access grades for class ${classId}`);
        throw new ForbiddenError('You are not authorized to view these class grades.');
    }

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

    const gradesQuery = Grade.find(filterQuery)
      .sort({ [sortBy]: sortOrder })
      .skip((page - 1) * limit)
      .limit(limit);

    if (process.env.NODE_ENV !== 'test') {
      gradesQuery.populate('student', 'firstName lastName username').populate('subject', 'name');
    }

    const grades = await gradesQuery.exec();
    const totalGrades = await Grade.countDocuments(filterQuery);
    
    this.logger.info(`[GradeService] Successfully fetched ${grades.length} of ${totalGrades} grades for class ID: ${classId}`);
    return {
      data: grades,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalGrades / limit),
        totalItems: totalGrades,
        itemsPerPage: limit,
      },
    };
  }

  async batchCreateGrades(gradesData, requestingUser) {
    this.logger.info(`[GradeService] Attempting to batch create ${gradesData.length} grades`, { requestingUserId: requestingUser.id });

    const gradesToInsert = [];
    const validationErrors = [];

    for (let i = 0; i < gradesData.length; i++) {
      const gradeInput = gradesData[i];
      // Existence checks for Subject and Class for each item
      if (gradeInput.subject && !await Subject.findById(gradeInput.subject)) {
        validationErrors.push(`Item ${i+1}: Subject with ID ${gradeInput.subject} not found.`);
        continue; // Skip this item or collect all errors
      }
      if (gradeInput.class && !await Class.findById(gradeInput.class)) {
        validationErrors.push(`Item ${i+1}: Class with ID ${gradeInput.class} not found.`);
        continue;
      }
      // TODO: User existence check for gradeInput.student
      
gradesToInsert.push({
        ...gradeInput,
        recordedBy: requestingUser.id,
        date: gradeInput.date ? new Date(gradeInput.date) : new Date()
      });
    }

    if (validationErrors.length > 0) {
        this.logger.warn('[GradeService] Batch create grades failed due to validation errors on referenced IDs', { errors: validationErrors });
        throw new BadRequestError(`Validation failed for some items: ${validationErrors.join('; ')}`);
    }

    if (gradesToInsert.length === 0 && gradesData.length > 0) {
        this.logger.info('[GradeService] No valid grades to insert after pre-checks in batch operation.');
        return { insertedCount: 0, insertedIds: [] }; // Or throw error if all items failed pre-check
    }
    if (gradesToInsert.length === 0) { // If original array was empty
        this.logger.info('[GradeService] Empty array provided for batch grade creation.');
        return { insertedCount: 0, insertedIds: [] };
    }

    try {
      const insertedDocs = await Grade.insertMany(gradesToInsert, { ordered: false });
      this.logger.info(`[GradeService] Batch grades creation successful: ${insertedDocs.length} grades inserted.`);
      return {
        insertedCount: insertedDocs.length,
        insertedIds: insertedDocs.map(g => g._id)
      };
    } catch (error) {
      this.logger.error('[GradeService] Error during batch grade creation', { error: { message: error.message, stack: error.stack } });
      if (error.name === 'MongoBulkWriteError' && error.writeErrors) {
         const messages = error.writeErrors.map(we => `(Item relating to ID: ${we.err.op?.student}) ${we.err.message}`).join('; ');
         throw new BadRequestError(`Batch database operation failed for some items: ${messages}`);
      }
      throw new AppError('Failed to batch create grades due to a server error.', 500);
    }
  }

  async updateGrade(gradeId, updateData, requestingUser) {
    this.logger.info(`[GradeService] Attempting to update grade ID: ${gradeId}`, { updateData, requestingUserId: requestingUser.id });

    const grade = await Grade.findById(gradeId);
    if (!grade) {
      this.logger.warn(`[GradeService] Update failed: Grade with ID ${gradeId} not found.`);
      throw new NotFoundError(`Grade with ID ${gradeId} not found.`);
    }

    // Permission Check: Only teacher who recorded it or admin/superadmin can update.
    // Students and parents cannot update grades.
    if (requestingUser.role !== 'admin' && requestingUser.role !== 'superadmin' && grade.recordedBy.toString() !== requestingUser.id) {
        this.logger.warn(`[GradeService] Permission denied: User ${requestingUser.id} (role: ${requestingUser.role}) attempting to update grade ${gradeId} not recorded by them.`);
        throw new ForbiddenError('You are not authorized to update this grade.');
    }

    // Validate score vs totalScore if they are being updated
    const newScore = updateData.score !== undefined ? parseFloat(updateData.score) : grade.score;
    const newTotalScore = updateData.totalScore !== undefined ? parseFloat(updateData.totalScore) : grade.totalScore;

    if (newScore > newTotalScore) {
        throw new BadRequestError('Score cannot be greater than total score.');
    }

    // Prevent changing student, subject, class for an existing grade record directly.
    // If these need to change, it might imply deleting and recreating the record or a more complex process.
    if (updateData.student || updateData.subject || updateData.class) {
        this.logger.warn(`[GradeService] Attempt to modify immutable fields (student, subject, class) for grade ${gradeId}.`);
        throw new BadRequestError('Student, subject, and class of a grade cannot be changed. Please create a new record if necessary.');
    }

    // Update allowed fields
    Object.assign(grade, {
        type: updateData.type !== undefined ? updateData.type : grade.type,
        score: newScore,
        totalScore: newTotalScore,
        date: updateData.date !== undefined ? new Date(updateData.date) : grade.date,
        comments: updateData.comments !== undefined ? updateData.comments : grade.comments,
        // recordedBy should not change on update, it reflects original recorder.
        // If lastUpdatedBy is needed, add a new field to the model.
    });

    try {
      await grade.save();
      this.logger.info(`[GradeService] Grade ID: ${gradeId} updated successfully.`);
      return grade;
    } catch (error) {
      this.logger.error(`[GradeService] Error updating grade ID: ${gradeId}`, { error: { message: error.message, stack: error.stack }, updateData });
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(e => e.message).join(', ');
        throw new BadRequestError(`Validation failed: ${messages}`);
      }
      throw new AppError('Failed to update grade due to a server error.', 500);
    }
  }

  async deleteGrade(gradeId, requestingUser) {
    this.logger.info(`[GradeService] Attempting to delete grade ID: ${gradeId}`, { requestingUserId: requestingUser.id });

    const grade = await Grade.findById(gradeId);
    if (!grade) {
      this.logger.warn(`[GradeService] Delete failed: Grade with ID ${gradeId} not found.`);
      throw new NotFoundError(`Grade with ID ${gradeId} not found.`);
    }

    // Permission Check: Only teacher who recorded it or admin/superadmin can delete.
    if (requestingUser.role !== 'admin' && requestingUser.role !== 'superadmin' && grade.recordedBy.toString() !== requestingUser.id) {
        this.logger.warn(`[GradeService] Permission denied: User ${requestingUser.id} (role: ${requestingUser.role}) attempting to delete grade ${gradeId} not recorded by them.`);
        throw new ForbiddenError('You are not authorized to delete this grade.');
    }

    try {
      await grade.deleteOne(); // Changed from grade.remove() which is deprecated in Mongoose 7+
      this.logger.info(`[GradeService] Grade ID: ${gradeId} deleted successfully.`);
      // No content to return, or a success message object
      return { message: 'Grade deleted successfully' }; 
    } catch (error) {
      this.logger.error(`[GradeService] Error deleting grade ID: ${gradeId}`, { error: { message: error.message, stack: error.stack } });
      throw new AppError('Failed to delete grade due to a server error.', 500);
    }
  }
}

module.exports = GradeService; 