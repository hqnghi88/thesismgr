# Ledger: thesis-mgr

- Goal: Restructure the template into a Thesis CMS with automatic jury timeslot planning.
- Constraints/Assumptions:
    - Backend: Express/Mongoose.
    - Frontend: React/Vite.
    - Features: Thesis tracking, Jury assignment, Auto-scheduling.
- Key decisions:
    - Replace Task model with Thesis, Jury, and Schedule models.
    - Implement a scheduling algorithm for jury timeslots.
    - Jury structure: Student, Supervisor, 1 Principal (Prof), 1 Examinator (Prof).
- State:
    - Done:
        - MongoDB/Docker/Backend/Frontend environment setup.
        - Restructured models to support Thesis and specific Jury roles.
        - Implemented auto-planning algorithm with role-based jury assignment.
        - Restarted all services (Docker, Backend, Frontend).
    - Now:
        - Services are back up and healthy.


    - Next:
        - Implementation of Thesis, Jury, and Schedule models.
        - Update controllers to handle thesis management.
- Open questions:
    - What are the constraints for auto-planning? (e.g., Professor availability, room limits, specific days).
- Working set:
    - `backend/models/Thesis.js`
    - `backend/models/Jury.js`
    - `backend/models/Schedule.js`
    - `backend/models/User.js`
