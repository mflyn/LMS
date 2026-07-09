# Resource Service

Current family-growth responsibility: private media upload, signed content access and media reference tracking.

This service still contains legacy learning-resource routes and uploaded test fixtures. The Task 1-7 family baseline uses the private media and internal media-reference surfaces. Older README content about Elasticsearch, Redis ranking, broad resource recommendation and S3/MinIO storage is not the current family MVP contract.

## Current Family MVP Surface

- `POST /api/media`
- `GET /api/media/:mediaId/access`
- `GET /api/media/:mediaId/content`
- `DELETE /api/media/:mediaId`
- `POST /api/internal/media/references/prepare`
- `POST /api/internal/media/references/commit`
- `POST /api/internal/media/references/unbind`

Public content reads require signed access tokens. Internal media-reference commands require a separate service credential.

## Current Family Models and Services

- `models/MediaAsset.js`
- `models/MediaReference.js`
- `models/FamilyUser.js`
- `services/mediaService.js`
- `services/mediaReferenceService.js`
- `services/privateMediaStore.js`
- `services/mediaCleanupService.js`
- `services/mongoTransaction.js`

The current private media store is filesystem-backed for the repository implementation. Production object storage is not wired in this baseline.

## Legacy Surface Still Present

- `routes/resources.js`
- `routes/resource.js`
- `routes/recommendations.js`
- `routes/collections.js`
- `models/Resource.js`, `ResourceCollection.js`, `ResourceReview.js`

These are compatibility surfaces and are not the family MVP acceptance path.

## Dependencies

Runtime dependencies are Express, Mongoose, Multer, Sharp, CORS and dotenv. There is no Elasticsearch, Redis or MinIO/S3 client dependency in `package.json`.

## Tests

```bash
npm test --prefix backend/services/resource-service -- --runInBand familyMedia familyMediaPrivacy mediaReferences mediaCleanup task6Startup
```

Family regression also runs this service through:

```bash
npm run test:family-regression
```
