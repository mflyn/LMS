# Homework Service

Current family-growth responsibility: five-dimension growth tasks.

This service still has legacy school homework routes, but the Task 1-7 family baseline uses `GrowthTask` and `/api/growth-tasks`. Older README content about teacher assignment workflows, MinIO homework storage, online grading and rich homework templates is not the current family MVP contract.

## Current Family MVP Surface

- `POST /api/growth-tasks`
- `GET /api/growth-tasks`
- `GET /api/growth-tasks/:taskId`
- `PATCH /api/growth-tasks/:taskId`
- `PATCH /api/growth-tasks/:taskId/complete`
- `PATCH /api/growth-tasks/:taskId/confirm`
- `DELETE /api/growth-tasks/:taskId`

The growth-task routes use signed gateway identity. Parent and child actions are authorized by role and resource ownership.

## Current Family Models and Services

- `models/GrowthTask.js`
- `services/growthTaskPatch.js`
- `services/growthTaskAttachmentMediaService.js`
- `services/starAwardClient.js`

Task confirmation calls the progress service through the internal star-award command. Attachment handling uses the resource-service media reference contract; it does not use MinIO.

## Legacy Surface Still Present

- `routes/homework.js`
- `models/Homework.js`
- RabbitMQ event publishing around legacy homework events

These remain for compatibility. They are not required for the family-growth MVP flow unless a later task explicitly reactivates them.

## Dependencies

Runtime dependencies include Express, Mongoose, JSON Web Token, Axios, amqplib and Winston. There is no MinIO/S3 client dependency in `package.json`.

## Tests

```bash
npm test --prefix backend/services/homework-service -- --runInBand growthTasks growthTaskMediaReferences starAwardClient
```

Family regression also runs this service through:

```bash
npm run test:family-regression
```
