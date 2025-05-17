const Grade = require('../models/Grade');
const User = require('../models/User'); // Assuming User model might be needed for validation or enrichment, adjust path if different
const Subject = require('../models/Subject'); // Assuming Subject model might be needed, adjust path
const { NotFoundError, BadRequestError, AppError, ForbiddenError } = require('../../../common/middleware/errorTypes');
const mongoose = require('mongoose');

class GradeService {
  constructor() {
    // If we were to inject models (e.g., for testing or if models are not singletons):
    // this.Grade = Grade; // or injected model
    // this.User = User;   // or injected model
  }

  async getGradesForStudent(studentId, requestingUser, logger) {
    logger.info(`[GradeService] Attempting to fetch grades for student ID: ${studentId}`, { requestingUserId: requestingUser.id, requestingUserRole: requestingUser.role });

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
        logger.warn(`[GradeService] Invalid student ID format: ${studentId}`);
        throw new BadRequestError('Invalid student ID format.');
    }

    // Permission Check: Students can only see their own grades.
    // Parents should only see their children's grades (requires more complex check, possibly fetching User doc for studentId and checking parent relationship).
    // Teachers and Admins can see grades based on their roles (further checks might be needed, e.g., teacher for their class/students).
    // For now, basic check: if role is student, studentId must match req.user.id
    if (requestingUser.role === 'student' && requestingUser.id !== studentId) {
        logger.warn(`[GradeService] Permission denied: Student ${requestingUser.id} trying to access grades for student ${studentId}`);
        throw new ForbiddenError('You are not authorized to view these grades.');
    }
    // More complex parent/teacher specific logic would go here if needed.

    let gradesQuery = Grade.find({ student: studentId }).sort({ date: -1 });

    // In a real application, NODE_ENV check for populate might be handled by a query builder or more robust config
    if (process.env.NODE_ENV !== 'test') {
      gradesQuery = gradesQuery.populate('subject', 'name syllabus'); // Populate more if needed
                               // .populate('class', 'name'); // If class is a ref
    }

    const grades = await gradesQuery.exec();

    if (!grades || grades.length === 0) {
      logger.info(`[GradeService] No grades found for student ID: ${studentId}`);
      // Depending on requirements, this might not be an error but an empty result.
      // throw new NotFoundError('No grades found for this student.');
    }

    logger.info(`[GradeService] Successfully fetched ${grades.length} grades for student ID: ${studentId}`);
    return grades;
  }

  async createGrade(gradeData, Gbs_insert_location_map_strackingUser, logger) {
    const { student, subject, class: classId, type, score, totalScore, date, comments } = gradeData;
    logger.info('[GradeService] Attempting to create new grade', { studentId: student, subjectId: subject, classId });

    // Basic validation (more comprehensive validation should be done via middleware or a validation library)
    if (!student || !subject || !classId || !type || score === undefined) {
      logger.warn('[GradeService] Create grade failed: Missing required fields');
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

    const newGrade = new Grade({
      student,
      subject,
      class: classId,
      type,
      score,
      totalScore,
      date: date || Date.now(),
      comments,
      recordedBy: trackingUser.id // Assuming trackingUser has an id field
    });

    try {
      await newGrade.save();
      logger.info('[GradeService] Grade created successfully', { gradeId: newGrade._id, studentId: newGrade.student });
      
      // Optionally populate fields before returning if needed by controller
      // await newGrade.populate('student', 'name').populate('subject', 'name').execPopulate();
      return newGrade;
    } catch (error) {
      logger.error('[GradeService] Error saving grade', { error: error.message, stack: error.stack, gradeData });
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(e => e.message).join(', ');
        throw new BadRequestError(`Validation failed: ${messages}`);
      }
      throw new AppError('Failed to create grade due to a server error.', 500);
    }
  }

  // Placeholder for getClassGrades
  async getGradesForClass(classId, requestingUser, logger) {
    logger.info(`[GradeService] Attempting to fetch grades for class ID: ${classId}`, { requestingUserId: requestingUser.id });
    if (!mongoose.Types.ObjectId.isValid(classId)) {
        logger.warn(`[GradeService] Invalid class ID format: ${classId}`);
        throw new BadRequestError('Invalid class ID format.');
    }

    // Permissions: Only teachers of that class or admins should see this.
    // This requires knowing the teacher for the class or if the requestingUser is an admin.
    // This logic is simplified here. In a real app, you'd check if `requestingUser` (a teacher) is associated with `classId`.
    if (!['teacher', 'admin'].includes(requestingUser.role)) {
        logger.warn(`[GradeService] Permission denied: User ${requestingUser.id} role ${requestingUser.role} trying to access grades for class ${classId}`);
        throw new ForbiddenError('You are not authorized to view these class grades.');
    }

    let gradesQuery = Grade.find({ class: classId }).sort({ date: -1 });
    if (process.env.NODE_ENV !== 'test') {
      gradesQuery = gradesQuery.populate('student', 'name username') // Populate student details
                               .populate('subject', 'name');     // Populate subject details
    }
    const grades = await gradesQuery.exec();
    logger.info(`[GradeService] Successfully fetched ${grades.length} grades for class ID: ${classId}`);
    return grades;
  }

  // Placeholder for batchCreateGrades
  async batchCreateGrades(gradesData, requestingUser, logger) {
    logger.info(`[GradeService] Attempting to batch create ${gradesData.length} grades`, { requestingUserId: requestingUser.id });

    if (!Array.isArray(gradesData) || gradesData.length === 0) {
      logger.warn('[GradeService] Batch create grades failed: Invalid or empty data array');
      throw new BadRequestError('Grades data must be a non-empty array.');
    }

    const gradesToInsert = gradesData.map(grade => {
      // Basic validation for each grade object
      if (!grade.student || !grade.subject || !grade.class || !grade.type || grade.score === undefined) {
        logger.warn('[GradeService] Batch create grades failed: Missing required fields in one of the grade objects', { grade });
        throw new BadRequestError('Each grade object must have student, subject, class, type, and score.');
      }
      return {
        ...grade,
        recordedBy: requestingUser.id,
        date: grade.date || Date.now()
      };
    });

    try {
      const result = await Grade.insertMany(gradesToInsert, { ordered: false }); // ordered:false to attempt all inserts
      logger.info(`[GradeService] Batch grades creation successful: ${result.length} grades inserted.`);
      return result;
    } catch (error) {
      logger.error('[GradeService] Error during batch grade creation', { error: error.message, stack: error.stack });
      // Mongoose insertMany with ordered:false might still throw an error if ALL operations fail 
      // or if there's a different kind of error (e.g. connection issue).
      // If some succeed and some fail with validation, it might return a result object with errors.
      // This error handling might need to be more nuanced depending on exact behavior of insertMany with validation errors.
      if (error.name === 'MongoBulkWriteError' && error.writeErrors) {
         const validationErrors = error.writeErrors.map(we => we.err.message).join('; ');
         throw new BadRequestError(`Batch validation failed: ${validationErrors}`);
      }
      throw new AppError('Failed to batch create grades due to a server error.', 500);
    }
  }

}

module.exports = new GradeService(); 