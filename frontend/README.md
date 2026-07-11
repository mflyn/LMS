# Frontend Workspace

`frontend/web` contains the accepted family-growth parent and child Web clients. The
legacy school tests remain isolated from the default family test entry point; school
navigation is not part of either family shell.

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

The parent application uses `/app/*`; the child application uses `/child/*`. Parent
and child sessions, providers, route guards, navigation, and API clients are isolated.
The child client derives its identity from the validated child session and does not
accept a caller-selected sibling ID.

## Useful Commands

Run these from `frontend/web`:

```bash
npm ci
npm start
npm run test:ci
npm run build
```

Run the legacy school tests only when explicitly maintaining that baseline:

```bash
npm run test:legacy
```

## Family MVP Baseline

- Task 8 delivered the parent shell, family setup redirect, selected-child context,
  and parent route guard.
- Task 9 delivered all seven parent workflows over the approved public API.
- Task 10 delivered child PIN login, child-only routes, Today and task completion,
  mistake review, achievements, profile, logout, and responsive navigation.
- Task 11 remains responsible for the automated cross-role browser E2E flow.

New family UI must remain inside the appropriate parent or child shell and preserve
the session/API boundary between them.
