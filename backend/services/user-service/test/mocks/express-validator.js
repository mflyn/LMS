/**
 * express-validator 模拟模块
 */

const { body, validationResult } = require('express-validator');

// 模拟 body 验证器
const mockBody = (field) => {
  return {
    isEmail: jest.fn().mockReturnThis(),
    isLength: jest.fn().mockReturnThis(),
    isAlphanumeric: jest.fn().mockReturnThis(),
    isStrongPassword: jest.fn().mockReturnThis(),
    matches: jest.fn().mockReturnThis(),
    notEmpty: jest.fn().mockReturnThis(),
    withMessage: jest.fn().mockReturnThis(),
    custom: jest.fn().mockReturnThis(),
    normalizeEmail: jest.fn().mockReturnThis(),
    trim: jest.fn().mockReturnThis(),
    escape: jest.fn().mockReturnThis()
  };
};

// 模拟 validationResult
const mockValidationResult = (req) => {
  return {
    isEmpty: jest.fn().mockReturnValue(true),
    array: jest.fn().mockReturnValue([]),
    formatWith: jest.fn().mockReturnThis(),
    throw: jest.fn()
  };
};

module.exports = {
  body: jest.fn().mockImplementation(mockBody),
  validationResult: jest.fn().mockImplementation(mockValidationResult),
  check: jest.fn().mockImplementation(mockBody),
  param: jest.fn().mockImplementation(mockBody),
  query: jest.fn().mockImplementation(mockBody)
};
