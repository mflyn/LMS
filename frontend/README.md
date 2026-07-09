# Frontend Workspace

This workspace currently contains the legacy/school-oriented web client under `frontend/web`. The family-growth MVP frontend has not been accepted yet; Task 8 must first replace the visible shell and navigation with the family parent shell described in `docs/superpowers/specs/2026-07-09-family-growth-task8-task11-frontend-design.md`.

## Current Layout

```text
frontend/
├── README.md
├── tests/
└── web/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    ├── public/
    └── src/
        ├── App.js
        ├── components/
        ├── config/
        ├── contexts/
        ├── hooks/
        ├── pages/
        ├── stores/
        ├── types/
        └── utils/
```

## Current Web Stack

- React 18 with `react-scripts`.
- React Router 6.
- Ant Design 5.
- Zustand stores.
- Axios and Socket.IO client dependencies.

The existing `frontend/web/src/config/menuConfig.js` still contains school-era menu entries such as courses, classes, grades, teacher/admin sections and home-school communication. Those entries are not part of the family MVP acceptance baseline.

## Useful Commands

Run these from `frontend/web`:

```bash
npm install
npm start
npm test
npm run build
```

## Family MVP Frontend Direction

- Task 8: parent web shell, family setup redirect, selected-child context and route guards.
- Task 9: parent MVP pages over the approved family API.
- Task 10: child PIN login and simplified child routes.
- Task 11: full browser E2E family-growth acceptance flow.

Do not add new family UI to the old teacher/admin navigation. Build or migrate into the family shell first.
