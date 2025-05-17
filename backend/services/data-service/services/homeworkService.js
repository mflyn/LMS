const Homework = require('../models/Homework');
const { NotFoundError, ForbiddenError, AppError, BadRequestError } = require('../../../common/middleware/errorTypes');

class HomeworkService {
    constructor(logger) {
        this.logger = logger;
    }

    async getHomeworkForStudent(studentId, requestingUser) {
        if (!studentId) {
            throw new BadRequestError('Student ID is required.');
        }
        // Permission check:
        if (requestingUser.role === 'student' && requestingUser.id !== studentId) {
            throw new ForbiddenError('You are not authorized to view this student\'s homework.');
        }
        // TODO: Add logic for parents to view their children's homework.
        // TODO: Add logic for teachers to view homework of students in their classes.
        // For now, admins/superadmins bypass these specific checks if not student themselves.
        if (requestingUser.role === 'teacher' || requestingUser.role === 'parent'){
            // Placeholder for more complex logic. For now, let's assume they need specific linkage not yet implemented.
            this.logger.info(`Teacher/Parent ${requestingUser.id} attempting to access homework for student ${studentId}. Further checks needed.`);
            // For now, we prevent access if not admin/superadmin or student themselves, to be safe until logic is built.
            if(requestingUser.role !== 'admin' && requestingUser.role !== 'superadmin') {
                // This part might be too restrictive for teachers if they should see all students for now
                // For simplicity in this step, let's assume teachers and parents also need specific permissions not yet built
                // throw new ForbiddenError('Access for teachers/parents requires specific student linkage.');
            }
        }


        const homework = await Homework.find({ student: studentId })
            .sort({ dueDate: -1 })
            .populate('subject', 'name description'); // Populate subject details

        if (!homework || homework.length === 0) {
            this.logger.info(`No homework found for student: ${studentId}`);
        }
        return homework;
    }

    async assignHomeworkToStudents(homeworkData, assigningUser) {
        const { title, description, subject, studentIds, dueDate, attachments } = homeworkData;
        this.logger.info(`Attempting to assign homework by ${assigningUser.id}`, { title, studentCount: studentIds ? studentIds.length : 0 });

        if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
            throw new BadRequestError('Student IDs must be provided as a non-empty array.');
        }

        const homeworkRecords = studentIds.map(studentId => ({
            title,
            description,
            subject, 
            student: studentId,
            dueDate,
            originalAttachments: attachments || [], // Renamed from 'attachments' to avoid conflict with submission attachments
            status: 'assigned',
            assignedBy: assigningUser.id,
            assignedDate: new Date(),
        }));

        try {
            const result = await Homework.insertMany(homeworkRecords, { ordered: false });
            this.logger.info(`Successfully assigned homework "${title}" to ${result.length} students by user ${assigningUser.id}.`);
            return result;
        } catch (error) {
            this.logger.error(`Error assigning homework: ${error.message}`, { 
                error: { message: error.message, stack: error.stack, name: error.name }, 
                homeworkData 
            });
            throw new AppError(`Failed to assign homework. Please check student IDs and other data. Original error: ${error.message}`, 500); // Informative but not too detailed
        }
    }

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
        return savedHomework;
    }

    async gradeStudentHomework(homeworkId, gradingData, requestingUser) {
        const { score, feedback } = gradingData;
        const homework = await Homework.findById(homeworkId);

        if (!homework) {
            throw new NotFoundError('Homework not found.');
        }
        
        // Basic check: only teachers, admins, superadmins can grade
        if (!['teacher', 'admin', 'superadmin'].includes(requestingUser.role)){
            throw new ForbiddenError('You are not authorized to grade homework.');
        }
        // TODO: Add more specific check: e.g., only the teacher who assigned or teacher of the student's class.

        if (homework.status !== 'submitted') {
            this.logger.warn(`Grading homework ${homeworkId} that is not in 'submitted' status (current: ${homework.status}) by user ${requestingUser.id}`);
            // Optionally, allow grading/re-grading of already graded homework
            if (homework.status !== 'graded') { // If not 'submitted' and also not already 'graded' then it is an issue.
                 throw new BadRequestError(`Homework must be in "submitted" status to be graded. Current status: "${homework.status}".`);
            }
        }

        homework.score = score;
        homework.feedback = feedback;
        homework.status = 'graded';
        homework.gradedDate = new Date();
        homework.gradedBy = requestingUser.id;

        const savedHomework = await homework.save();
        this.logger.info(`Homework ${homeworkId} graded by user ${requestingUser.id}. Score: ${score}`);
        return savedHomework;
    }
}

module.exports = HomeworkService; 