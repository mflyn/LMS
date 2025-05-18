const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Role = require('../../../models/Role'); // Path to actual Role model
const { createUserValidationRules, updateUserValidationRules, validate } = require('../../middleware/validators/userValidators');

// Setup a minimal express app for testing validators
const app = express();
app.use(express.json());

// Test route for createUserValidationRules
app.post('/test-create-user', createUserValidationRules(), validate, (req, res) => {
  res.status(200).json({ status: 'success', message: 'Validation passed' });
});

// Test route for updateUserValidationRules
app.patch('/test-update-user', updateUserValidationRules(), validate, (req, res) => {
  res.status(200).json({ status: 'success', message: 'Validation passed' });
});

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
  // Pre-populate roles needed for validation
  await Role.create([ { name: 'student', description: 'Student' }, { name: 'teacher', description: 'Teacher' }, { name: 'admin', description: 'Admin' } ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
    // Clean up if any test modifies data, though validators shouldn't persist data.
});

describe('User Validators Unit Tests', () => {
  describe('createUserValidationRules', () => {
    const validStudentData = {
      username: 'testuser123',
      email: 'testuser@example.com',
      password: 'Password123!',
      firstName: 'Test',
      lastName: 'User',
      role: 'student',
      isActive: true,
      studentDetails: {
        studentIdNumber: 'S12345',
        grade: '10',
        studentClass: 'A'
      }
    };

    const validTeacherData = {
        username: 'teachertest',
        email: 'teacher@example.com',
        password: 'Password123!',
        firstName: 'Teacher',
        lastName: 'Test',
        role: 'teacher',
        teacherDetails: {
          teacherIdNumber: 'T98765',
          subjectsTaught: ['Math', 'Physics']
        }
      };

    it('should pass with valid student data', async () => {
      const response = await request(app).post('/test-create-user').send(validStudentData);
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
    });

    it('should pass with valid teacher data', async () => {
        const response = await request(app).post('/test-create-user').send(validTeacherData);
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
    });

    it('should fail if username is missing', async () => {
      const data = { ...validStudentData };
      delete data.username;
      const response = await request(app).post('/test-create-user').send(data);
      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ username: 'Username is required.' })
      ]));
    });

    it('should fail if email is invalid', async () => {
      const data = { ...validStudentData, email: 'invalid-email' };
      const response = await request(app).post('/test-create-user').send(data);
      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ email: 'Must be a valid email address.' })
      ]));
    });

    it('should fail if password is too short', async () => {
      const data = { ...validStudentData, password: 'Pass1!' };
      const response = await request(app).post('/test-create-user').send(data);
      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ password: 'Password must be at least 8 characters long.' })
      ]));
    });
    
    it('should fail if password does not meet complexity requirements (e.g., missing uppercase)', async () => {
      const data = { ...validStudentData, password: 'password123!' }; // Missing uppercase
      const response = await request(app).post('/test-create-user').send(data);
      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ password: 'Password must contain an uppercase letter.' })
      ]));
    });

    it('should fail if role is invalid (not in DB)', async () => {
      const data = { ...validStudentData, role: 'nonexistentrole' };
      const response = await request(app).post('/test-create-user').send(data);
      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ role: 'Invalid role specified.' })
      ]));
    });

    it('should fail if role is student but studentIdNumber is missing', async () => {
      const data = { ...validStudentData };
      delete data.studentDetails.studentIdNumber;
      const response = await request(app).post('/test-create-user').send(data);
      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ 'studentDetails.studentIdNumber': 'Student ID number is required for students.' })
      ]));
    });

    it('should fail if role is teacher but teacherIdNumber is missing', async () => {
        const data = { ...validTeacherData };
        delete data.teacherDetails.teacherIdNumber;
        const response = await request(app).post('/test-create-user').send(data);
        expect(response.status).toBe(400);
        expect(response.body.errors).toEqual(expect.arrayContaining([
          expect.objectContaining({ 'teacherDetails.teacherIdNumber': 'Teacher ID number is required for teachers.' })
        ]));
    });

    it('should fail if role is teacher but subjectsTaught is empty array', async () => {
        const data = { ...validTeacherData, teacherDetails: { ...validTeacherData.teacherDetails, subjectsTaught: []} };
        const response = await request(app).post('/test-create-user').send(data);
        expect(response.status).toBe(400);
        expect(response.body.errors).toEqual(expect.arrayContaining([
          expect.objectContaining({ 'teacherDetails.subjectsTaught': 'Subjects taught is required for teachers and must be a non-empty array.' })
        ]));
    });

    it('should fail if role is teacher but subjectsTaught contains empty string', async () => {
        const data = { ...validTeacherData, teacherDetails: { ...validTeacherData.teacherDetails, subjectsTaught: ['Math', '']} };
        const response = await request(app).post('/test-create-user').send(data);
        expect(response.status).toBe(400);
        expect(response.body.errors).toEqual(expect.arrayContaining([
          expect.objectContaining({ 'teacherDetails.subjectsTaught': 'All subjects taught must be non-empty strings.' })
        ]));
    });

    // Add more tests for other fields and conditions in createUserValidationRules
  });

  describe('updateUserValidationRules', () => {
    const validUpdateData = {
      firstName: 'UpdatedName',
      lastName: 'UpdatedLastName',
      isActive: false
    };

    it('should pass with valid optional data', async () => {
      const response = await request(app).patch('/test-update-user').send(validUpdateData);
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
    });

    it('should pass if only one valid field is provided', async () => {
      const response = await request(app).patch('/test-update-user').send({ email: 'newemail@example.com' });
      expect(response.status).toBe(200);
    });
    
    it('should fail if provided email is invalid', async () => {
        const response = await request(app).patch('/test-update-user').send({ email: 'invalid' });
        expect(response.status).toBe(400);
        expect(response.body.errors).toEqual(expect.arrayContaining([
            expect.objectContaining({ email: 'Must be a valid email address.' })
          ]));
    });

    it('should fail if provided password is weak (e.g., too short)', async () => {
        const response = await request(app).patch('/test-update-user').send({ password: 'short' });
        expect(response.status).toBe(400);
        expect(response.body.errors).toEqual(expect.arrayContaining([
            expect.objectContaining({ password: 'Password must be at least 8 characters long.' })
          ]));
    });

    it('should fail if provided role is invalid (not in DB)', async () => {
        const response = await request(app).patch('/test-update-user').send({ role: 'superduperadmin' });
        expect(response.status).toBe(400);
        expect(response.body.errors).toEqual(expect.arrayContaining([
            expect.objectContaining({ role: 'Invalid role specified.' })
          ]));
    });

    it('should pass if role is valid', async () => {
        const response = await request(app).patch('/test-update-user').send({ role: 'teacher' });
        expect(response.status).toBe(200);
    });

    it('should fail if studentDetails is provided and studentIdNumber is empty string', async () => {
        const data = { studentDetails: { studentIdNumber: ' ' } };
        const response = await request(app).patch('/test-update-user').send(data);
        expect(response.status).toBe(400);
        expect(response.body.errors).toEqual(expect.arrayContaining([
            expect.objectContaining({ 'studentDetails.studentIdNumber': 'Student ID number cannot be empty if provided in studentDetails.' })
          ]));
    });
    
    it('should pass if studentDetails is provided with valid studentIdNumber', async () => {
        const data = { studentDetails: { studentIdNumber: 'S999' } };
        const response = await request(app).patch('/test-update-user').send(data);
        expect(response.status).toBe(200);
    });

    // Add more tests for other fields and conditions in updateUserValidationRules

  });
}); 