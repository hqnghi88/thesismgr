# Ledger: taskzen-project

- Goal: Start both backend and frontend services.
- Constraints/Assumptions:
    - Backend uses Node.js/Express and Mongoose (needs MongoDB).
    - Frontend uses Vite.
    - No `.env` files visible in `taskzen-backend` or `taskzen-frontend`.
- Key decisions:
    - Use `npm start` for backend.
    - Use `npm run dev` for frontend.
- State:
    - Done: Project exploration.
    - Now: Installing dependencies in both backend and frontend.
    - Next: Create .env files if needed and start services.
- Open questions:
    - Is there a MongoDB instance running or a `MONGO_URI` available?
- Working set:
    - `taskzen-backend/server.js`
    - `taskzen-backend/package.json`
    - `taskzen-frontend/package.json`
