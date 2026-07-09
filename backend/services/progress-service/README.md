# Progress Service

Current family-growth responsibility: growth logs, knowledge points, star ledger and rewards.

Older progress-service README content described course progress, class reports, Redis caching and learning-path recommendations. Those are legacy/school-oriented concepts and are not the current family-growth baseline.

## Current Family MVP Surface

- `POST /api/growth-logs`
- `GET /api/growth-logs`
- `PATCH /api/growth-logs/:logId`
- `POST /api/knowledge-points`
- `GET /api/knowledge-points`
- `PATCH /api/knowledge-points/:knowledgePointId`
- `POST /api/internal/stars/award`
- `POST /api/rewards`
- `GET /api/rewards`
- `PATCH /api/rewards/:rewardId/redeem`

Family routes use signed gateway identity. Internal star award uses a separate service credential.

## Current Family Models and Services

- `models/GrowthLog.js`
- `models/KnowledgePoint.js`
- `models/KnowledgePointMasteryEvent.js`
- `models/StarLedgerEntry.js`
- `models/StarLedgerGuard.js`
- `models/Reward.js`
- `services/growthAccess.js`
- `services/starLedgerService.js`

Reward redemption requires a transaction-capable MongoDB replica set; startup rejects standalone or non-writable topologies for this capability.

## Legacy Surface Still Present

- `models/Progress.js`
- `models/Report.js`
- `routes/progress.js`
- `routes/reports.js`

These remain for legacy compatibility and tests.

## Tests

```bash
npm test --prefix backend/services/progress-service -- --runInBand growthLogs knowledgePoints rewards internalStars startup
```

Family regression also runs this service through:

```bash
npm run test:family-regression
```
