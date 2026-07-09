# Analytics Service

Current family-growth responsibility: academic mistakes and deterministic weekly reports.

This README reflects the current repository state. Older descriptions of TensorFlow.js, ML prediction, class analytics, AI recommendations and rich dashboard analytics are legacy/school-oriented ideas and are not part of the Task 1-7 family-growth baseline.

## Current Family MVP Surface

- `POST /api/family-mistakes`
- `GET /api/family-mistakes`
- `GET /api/family-mistakes/:mistakeId`
- `PATCH /api/family-mistakes/:mistakeId`
- `GET /api/weekly-reports`
- `PATCH /api/weekly-reports/:reportId/feedback`

The family routes use signed gateway identity and enforce family/child ownership in the route/service layer.

## Current Family Models and Services

- `models/FamilyMistake.js`
- `models/FamilyMistakeStateEvent.js`
- `models/WeeklyReport.js`
- `services/familyMistakeMediaService.js`
- `services/familyMistakePatch.js`
- `services/weeklyReportService.js`

Weekly reports are deterministic aggregations over family data. They are not AI reports.

## Legacy Surface Still Present

The service still contains school-era analytics routes and models, including trends, behavior, progress, reports, long-term trends and performance records. They are retained for compatibility and legacy tests, but they are not part of the accepted family MVP UI.

## Dependencies

Runtime dependencies are Express, Mongoose, Socket.IO, CORS, dotenv and Winston. There is no TensorFlow.js or ML library dependency in `package.json`.

## Tests

```bash
npm test --prefix backend/services/analytics-service -- --runInBand familyMistakes weeklyReports task6Startup
```

Family regression also runs this service through the root command:

```bash
npm run test:family-regression
```
