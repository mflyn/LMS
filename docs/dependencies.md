# Project Dependencies Documentation

This document lists all dependencies required for the project, including both production and development dependencies.

## Core Dependencies (Production)

These dependencies are required in the production environment:

| Dependency | Version | Purpose |
|------------|---------|---------|
| express | ^4.18.2 | Web application framework |
| mongoose | ^8.5.1 | MongoDB object modeling tool |
| bcryptjs | ^3.0.2 | Password encryption |
| jsonwebtoken | ^9.0.2 | JWT authentication |
| dotenv | ^16.5.0 | Environment variable management |
| cors | ^2.8.5 | Cross-Origin Resource Sharing |
| helmet | ^8.1.0 | Secure HTTP headers |
| express-rate-limit | ^7.5.0 | API request limiting |
| xss-clean | ^0.1.4 | XSS attack protection |
| hpp | ^0.2.3 | HTTP Parameter Pollution protection |
| express-session | ^1.18.1 | Session management |
| connect-mongo | ^5.1.0 | MongoDB session store |
| uuid | ^11.1.0 | Unique ID generation |
| winston | ^3.17.0 | Logging |
| winston-daily-rotate-file | ^5.0.0 | Log file rotation |
| multer | ^1.4.5-lts.2 | File upload handling |
| password-validator | ^5.3.0 | Password strength validation |
| sanitize-html | ^2.15.0 | HTML content sanitization |
| amqplib | ^0.10.8 | RabbitMQ client |
| express-validator | ^7.2.1 | Request data validation |

## Development Dependencies

These dependencies are only used in the development environment:

| Dependency | Version | Purpose |
|------------|---------|---------|
| jest | ^29.7.0 | JavaScript testing framework |
| supertest | ^7.1.0 | HTTP testing |
| mongodb-memory-server | ^10.1.4 | In-memory MongoDB server (for testing) |
| nodemon | ^3.1.4 | Development hot-reloading |
| eslint | ^9.8.0 | Code quality checking |
| jest-junit | ^16.0.0 | Jest test report generation |
| @types/k6 | ^1.0.2 | K6 performance testing type definitions |
| k6 | ^0.0.0 | Performance testing tool |

## Installation

You can install all production dependencies with the following command:

```bash
npm install express mongoose bcryptjs jsonwebtoken dotenv cors helmet express-rate-limit xss-clean hpp express-session connect-mongo uuid winston winston-daily-rotate-file multer password-validator sanitize-html amqplib express-validator
```

Install development dependencies:

```bash
npm install --save-dev jest supertest mongodb-memory-server nodemon eslint jest-junit @types/k6 k6
```

## Dependency Details

### Web Framework and API
- **express**: Node.js web application framework for building APIs and web applications
- **cors**: Enable Cross-Origin Resource Sharing, allowing frontend to access API from different domains
- **helmet**: Enhance application security by setting various HTTP headers
- **express-rate-limit**: Limit API request frequency to prevent abuse
- **hpp**: Prevent HTTP Parameter Pollution attacks
- **express-validator**: Validate and sanitize request data

### Database
- **mongoose**: MongoDB Object Data Modeling (ODM) to simplify MongoDB operations
- **connect-mongo**: Store Express sessions in MongoDB

### Authentication and Security
- **bcryptjs**: Password hashing and encryption
- **jsonwebtoken**: Generate and verify JWT tokens
- **express-session**: Session management
- **password-validator**: Password strength validation
- **xss-clean**: Prevent XSS attacks
- **sanitize-html**: Sanitize HTML content to prevent XSS attacks

### File Handling
- **multer**: Handle file uploads

### Logging and Monitoring
- **winston**: Logging library
- **winston-daily-rotate-file**: Log file rotation to prevent single log files from growing too large

### Utilities
- **dotenv**: Load environment variables from .env file
- **uuid**: Generate unique identifiers
- **amqplib**: RabbitMQ client for message queuing

### Testing
- **jest**: JavaScript testing framework
- **supertest**: HTTP testing library for API testing
- **mongodb-memory-server**: In-memory MongoDB server for testing
- **jest-junit**: Generate JUnit format test reports

### Development Tools
- **nodemon**: Watch for file changes and automatically restart server
- **eslint**: Code quality checking tool
- **k6**: Performance testing tool

## Mock Modules for Testing Environment

To simulate dependencies in the testing environment, we've created the following mock modules:

- bcrypt mock
- jsonwebtoken mock
- mongoose mock
- express mock
- express-session mock
- connect-mongo mock
- winston mock
- dotenv mock
- etc.

These mock modules are located in the `backend/services/user-service/test/mocks/` directory and are used to replace real dependencies in the testing environment to improve test speed and reliability.
