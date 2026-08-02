# Version History

## Version 1.1.0 (Current)

### Security Enhancements
1. Added `helmet` middleware for robust HTTP security headers (HSTS, X-Frame-Options, CSP, etc.)
2. Implemented `express-rate-limit` on `/api/login` and `/api/register` (5 req / 15 min per IP)

### Database & ORM
1. Implemented soft deletes on `users` and `project_topics` tables via `is_deleted` boolean column
2. `deleteUser()` and `deleteProjectTopic()` now perform UPDATE instead of DELETE
3. All query methods filter out soft-deleted records automatically

### Frontend Architecture
1. Created global `ErrorBoundary` component wrapping the entire app — unhandled errors now show a styled fallback UI instead of a white screen
2. Added optimistic UI updates to Topic Approval page (approve/reject) using TanStack Query `onMutate` with automatic rollback on failure

### Documentation
1. Updated `Fixes_required.md` with completed items and 20+ new improvement suggestions across 7 categories

## Version 1.0.1

### Database Schema Updates
1. Fixed duplicate users table definition in `shared/schema.ts`
2. Added proper foreign key references between tables
3. Updated schema types and relationships
4. Implemented proper table constraints and relationships

### Storage Layer Improvements
1. Replaced raw SQL queries with Drizzle ORM query builder in `server/storage/index.ts`
2. Updated storage functions to use proper table references
3. Implemented type-safe queries using Drizzle
4. Added proper error handling and return types

### UI/UX Enhancements
1. Updated Student Groups page layout and styling
   - Added MainLayout component integration
   - Improved card styling and consistency
   - Enhanced form layouts and input handling
   - Added proper loading states and error handling
   - Implemented proper spacing and typography

2. Added Group Information Feature
   - Implemented "Group Info" button for users not in groups
   - Added dialog showing available groups
   - Included detailed group information display:
     * Group name and description
     * Member count
     * Current members with profile pictures
     * Full names and enrollment numbers
     * Project mentor details

### General Improvements
1. Enhanced error handling across the application
2. Improved type safety with TypeScript
3. Updated component styling for consistency
4. Added proper loading states throughout the application

## Planned Features
1. Enhanced group collaboration tools
2. Advanced project tracking features
3. Improved notification system
4. Real-time updates for group activities

## Known Issues
- None reported in current version

## Dependencies
- Node.js (v18 or higher)
- PostgreSQL
- Yarn package manager
- React + Vite
- Drizzle ORM
- Express.js
- TypeScript
- Tailwind CSS 