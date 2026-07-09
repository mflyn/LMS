# Data Service

This service is a legacy school-oriented data-entry service. It is not part of the accepted Task 1-7 family-growth MVP path.

## Current Legacy Surface

The service still contains routes and controllers for:

- grades
- homework records
- mistake records
- class performance

These are mounted by `routes/index.js` and backed by local Mongoose models and validators.

## Family MVP Status

Family-growth data is owned by the bounded services:

- child/family data: `user-service`
- growth tasks: `homework-service`
- growth logs, knowledge points, stars and rewards: `progress-service`
- mistakes and weekly reports: `analytics-service`
- private media: `resource-service`
- reminders: `notification-service`

Do not route new family MVP data through `data-service` without an approved architecture change.

## Dependencies

The current `package.json` uses Express, Mongoose, Joi and related middleware. The old README references MySQL, Redis, email and SMS-style future work; those are not current implemented dependencies for the family baseline.
