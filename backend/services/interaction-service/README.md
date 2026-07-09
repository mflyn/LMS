# Interaction Service

This service is retained for legacy school-system compatibility. Task 1-7 family-growth baselines do not require it.

## Current Legacy Surface

The service contains routes and models for:

- messages
- announcements
- meetings
- video meetings

Gateway and deployment manifests may still include `interaction-service` so the old school-oriented surface can be started when needed.

## Family MVP Status

Family MVP Task 1-7 explicitly pauses meetings, announcements, group chat and complex message flows. New parent-child feedback or child self-reflection work must first define:

- product requirement
- API contract
- authorization model
- frontend route/state behavior
- regression gate

Until then, this service must not be treated as a required dependency for minimal family-growth demos or gates.

## Dependencies

The current package uses Express, Mongoose, JWT, CORS, dotenv and Winston. It does not implement the full WebRTC/Redis operational design described in older boilerplate.
