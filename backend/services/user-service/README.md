# User Service

Current family-growth responsibility: parent auth, families, children, child PIN login and child profile media references.

Older user-service README content described broad school user administration, teacher/admin management and third-party login. Those are not part of the accepted Task 1-7 family-growth baseline.

## Current Family MVP Surface

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/child-pin-login`
- `POST /api/auth/change-password`
- `POST /api/families`
- `GET /api/families/me`
- `PATCH /api/families/:familyId`
- `POST /api/children`
- `GET /api/children`
- `GET /api/children/:childId`
- `PATCH /api/children/:childId`
- `POST /api/children/:childId/pin`

Family and child routes use signed gateway identity and derive authorization from the authenticated identity and stored ownership.

## Current Family Models and Services

- shared `backend/common/models/User.js`
- shared `backend/common/models/Family.js`
- `controllers/familyController.js`
- `services/childAvatarMediaService.js`
- `services/childProfilePatch.js`

Child PINs are stored as salted hashes. PIN reset increments child token version so old child tokens are rejected.

## Legacy Surface Still Present

- `routes/student.js`
- `routes/user.js`
- old student/user controllers and tests

These remain for school-era compatibility and are not family MVP UI requirements.

## Tests

```bash
npm test --prefix backend/services/user-service -- --runInBand family children childMediaReferences
```

Family regression also runs this service through:

```bash
npm run test:family-regression
```
