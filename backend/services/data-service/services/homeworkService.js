const Homework = require('../models/Homework');
const { NotFoundError, ForbiddenError, AppError, BadRequestError } = require('../../../common/middleware/errorTypes');

class HomeworkService {
    constructor(logger) {
        this.logger = logger;
    }

    async getHomeworkForStudent(studentId, requestingUser, queryParams = {}) {
        if (!studentId) {
            throw new BadRequestError('Student ID is required.');
        }

        const query = { student: studentId };
        if (queryParams.status) query.status = queryParams.status;
        if (queryParams.subject) query.subject = queryParams.subject;

        // Permission check:
        // Student can only view their own homework
        if (requestingUser.role === 'student' && requestingUser.id !== studentId) {
            throw new ForbiddenError('You are not authorized to view this student\'s homework.');
        }
        // Parent can view their children's homework - (requires children linkage in User model)
        if (requestingUser.role === 'parent') {
            // Assuming requestingUser.children is an array of student IDs
            if (!requestingUser.children || !requestingUser.children.includes(studentId)) {
                throw new ForbiddenError('You are not authorized to view this student\'s homework.');
            }
            this.logger.info(`Parent ${requestingUser.id} accessing homework for child ${studentId}`);
        }
        // Teacher can view homework of students (e.g., in their classes) - (requires class/student linkage)
        if (requestingUser.role === 'teacher') {
            // This logic needs to be more specific, e.g., checking if studentId is in one of the teacher's classes.
            // For now, let's assume a teacher can see any student homework if explicitly requested (controller should limit studentId if needed)
            // Or, if a specific classId is part of the query, filter by that.
            this.logger.info(`Teacher ${requestingUser.id} accessing homework for student ${studentId}. Ensure proper class/student linkage for authorization.`);
            // Add class-based filtering here if applicable and classId is available from queryParams or teacher's profile
        }
        // Admins/Superadmins have broader access, usually no specific student-linkage check here unless for auditing.

        const limit = parseInt(queryParams.limit, 10) || 10;
        const page = parseInt(queryParams.page, 10) || 1;
        const sortBy = queryParams.sortBy || 'dueDate';
        const sortOrder = queryParams.sortOrder === 'asc' ? 1 : -1;

        const homeworkRecords = await Homework.find(query)
            .sort({ [sortBy]: sortOrder })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('subject', 'name description'); 
            // Consider populating assignmentId details from homework-service if an internal call/cache is available in future.

        const totalRecords = await Homework.countDocuments(query);
        
        this.logger.info(`Retrieved ${homeworkRecords.length} homework records for student: ${studentId}`);
        return {
            data: homeworkRecords,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalRecords / limit),
                totalItems: totalRecords,
                itemsPerPage: limit
            }
        };
    }

    // assignHomeworkToStudents method is now removed.
    // The creation of student-specific homework records will be handled by an event consumer
    // listening to events from homework-service (e.g., 'homework.assigned').

    async submitStudentHomework(homeworkId, submissionData, requestingUser) {
        const { content, submissionAttachments } = submissionData;
        const homework = await Homework.findById(homeworkId);

        if (!homework) {
            throw new NotFoundError('Homework not found.');
        }
        if (homework.student.toString() !== requestingUser.id) {
            throw new ForbiddenError('You can only submit your own homework.');
        }
        if (homework.status !== 'assigned' && homework.status !== 'resubmitted') {
             throw new BadRequestError(`Homework cannot be submitted as it is currently in "${homework.status}" status.`);
        }

        homework.content = content;
        homework.submissionAttachments = submissionAttachments || [];
        homework.status = 'submitted';
        homework.submittedDate = new Date();

        const savedHomework = await homework.save();
        this.logger.info(`Homework ${homeworkId} submitted by student ${requestingUser.id}.`);
        // TODO: Potentially emit an event 'homework.submitted' if other services need to react.
        return savedHomework;
    }

    async gradeStudentHomework(homeworkId, gradingData, requestingUser) {
        const { score, feedback, status, totalScore } = gradingData; // Allow updating totalScore if applicable
        const homework = await Homework.findById(homeworkId);

        if (!homework) {
            throw new NotFoundError('Homework not found.');
        }
        
        if (!['teacher', 'admin', 'superadmin'].includes(requestingUser.role)){
            throw new ForbiddenError('You are not authorized to grade homework.');
        }
        // TODO: Add more specific check: e.g., only teacher of the student's class, or teacher who is linked to the original assignment.
        // This might involve checking homework.assignmentId and cross-referencing with teacher's assignments in homework-service (potentially via API call or replicated data).

        // Allow grading if status is 'submitted' or if it's already 'graded' (re-grading)
        if (homework.status !== 'submitted' && homework.status !== 'graded') {
            this.logger.warn(`Grading homework ${homeworkId} that is not in 'submitted' or 'graded' status (current: ${homework.status}) by user ${requestingUser.id}`);
            throw new BadRequestError(`Homework must be in "submitted" or "graded" status to be graded. Current status: "${homework.status}".`);
        }

        if (score !== undefined) homework.score = score;
        if (feedback !== undefined) homework.feedback = feedback;
        if (status && ['graded', 'resubmitted'].includes(status)) {
            homework.status = status; // Teacher can set to graded or request resubmission
        } else if (score !== undefined) { // If score is provided, but no valid status, default to graded
            homework.status = 'graded';
        }
        // Update totalScore if provided in gradingData, this allows flexibility if not set initially
        if (totalScore !== undefined) homework.totalScore = totalScore; 

        homework.gradedDate = new Date();
        homework.gradedBy = requestingUser.id;

        const savedHomework = await homework.save();
        this.logger.info(`Homework ${homeworkId} graded by user ${requestingUser.id}. Score: ${score}, Status: ${homework.status}`);
        // TODO: Potentially emit an event 'homework.graded' if other services need to react (e.g., notification-service, progress-service).
        return savedHomework;
    }
}

module.exports = HomeworkService; 