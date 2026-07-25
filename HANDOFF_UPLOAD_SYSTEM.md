# T Bill — Handoff Document

**Date:** 2026-07-21
**Updated:** 2026-07-24
**Status:** ACTIVE — Ready to resume

---

## Project Overview
T Bill is a expense management system with roles: Admin, Accounts Head, Employee. Built with Express + SQLite (better-sqlite3) + vanilla JS frontend.

**Start server:** `npm run dev` (uses nodemon, auto-restarts)
**URL:** http://localhost:3000

---

## What Was Built (Previous Sessions)

### Generic Upload System
- **Migration:** `010_generic_attachments.js` — Added `entity_type`/`entity_id` to attachments
- **Backend:** `src/routes/attachments.js` — CRUD for polymorphic attachments
- **Compression:** `src/utils/compress.js` + `compressionQueue.js` — Async image/PDF compression

### Dashboard, Settlements, Petty Cash, Budgets, Expense Heads, Users, Reports, Audit Log
- All features fully implemented in `client/js/app.js`

---

## What Was Built (Session — 2026-07-23)

### 1. Expenses Table Enhancements
**File:** `client/js/app.js`
- **Explanation column** added between Category and Employee
- **Total row** at bottom of table showing sum of all amounts (updates with filters)
- **Edit button** (orange) — appears for admin on approved/rejected expenses only
- **Delete button** (red trash) — admin only, all statuses

**File:** `src/routes/expenses.js`
- `PATCH /api/expenses/:id` — Admin edits any expense (date, category, amount, explanation, status)
  - **IMPORTANT:** Route is defined BEFORE `/:id/approve` and `/:id/reject` to avoid route conflicts
- `DELETE /api/expenses/:id` — Admin deletes expense + attachments + notes

### 2. Edit Expense Modal
- Pre-fills all fields from existing expense
- **Status dropdown** — admin can change approved→rejected or vice versa
- Subcategory dynamically loads based on selected category

### 3. Lightbox for Images
**File:** `client/js/app.js`
- `openLightbox(url)` function — dark overlay, X button, Escape key, click-outside to close
- Applied to: expense view thumbnails, attachment modal images
- PDFs still open in new tab

### 4. Collection Feature (NEW)
**Migration:** `012_create_collections.js`
```sql
collections: id, date, bill_amount, number_of_cards, total, explanation, status, created_by, approved_by, approved_at, created_at
```

**Migration:** `013_create_settings.js`
```sql
settings: key (PK), value, updated_by, updated_at
```

**Backend:** `src/routes/collections.js`
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/collections` | GET | Any (role-filtered) | List collections |
| `/api/collections` | POST | Employee + Admin | Create (auto-calculates total) |
| `/api/collections/:id` | GET | Any | View single |
| `/api/collections/:id/approve` | PATCH | Accounts Head + Admin | Approve |
| `/api/collections/:id/reject` | PATCH | Accounts Head + Admin | Reject |
| `/api/collections/:id` | DELETE | Admin | Delete |
| `/api/collections/settings/bill-amount` | GET | Any | Get preset bill amount |
| `/api/collections/settings/bill-amount` | PATCH | Accounts Head + Admin | Set preset bill amount |

**Frontend:** `client/js/app.js`
- Sidebar nav: "Collections" added for all roles (between Expenses and Settlements)
- `renderCollections()` — Full page with filter, total row, all action buttons
- `showCollectionForm()` — Bill amount pre-filled from preset, live total calculation
- `showBillAmountSetting()` — Admin/accounts_head can set default bill amount
- Action buttons: View, Attachments (with badge), Approve, Reject, Delete

### 5. Settlements Enhancements
**File:** `client/js/app.js`
- **View button** (eye) — opens settlement details modal
- **Delete button** (trash) — admin only

**File:** `src/routes/settlements.js`
- `DELETE /api/settlements/:id` — Admin deletes settlement

### 6. Default Date on All Forms
- Added `todayStr()` helper function
- All creation forms (Expense, Collection, Settlement, Petty Cash) default to today's date
- Filter/report date fields remain empty (intentional)

---

## What Was Built (Session — 2026-07-24)

### 1. Collection File Upload Support
**File:** `src/routes/collections.js`
- Added `upload.array('files', 5)` middleware to POST `/api/collections`
- Saves attachments with `entity_type: 'collection'` + `entity_id`
- Enqueues background compression for uploaded files
- Added `path`, `upload`, `compressionQueue` imports

**File:** `client/js/app.js` — `showCollectionForm()`
- Added file input field (`<input type="file" multiple accept="image/*,.pdf">`)
- Form now uses `FormData` for multipart upload (third param `true` in `api.post`)

**File:** `client/js/app.js` — `openModal()`
- Changed `textContent` to `innerHTML` for title (to support HTML icons in modal headers)

### 2. Version History Feature (Google Sheets-style)
**File:** `src/routes/auditLog.js`
- Added `entity_id` query param filter — allows filtering by specific entity instance
- Added `accounts_head` to authorized roles (was admin-only before)

**File:** `client/index.html`
- Added version history panel container (overlay + slide-in panel) after the modal

**File:** `client/js/app.js`
- `showVersionHistory(entityType, entityId)` — Fetches audit logs, groups by month, displays timeline
- `closeVersionHistory()` — Slide-out panel with overlay, click-outside to close
- `actionColor(action)` — Color for timeline dot (blue=create, yellow=update, green=approve, red=reject, gray=delete)
- `versionActionBadge(action)` — Colored badge for action type
- `formatVersionDetail(action, details, entityType)` — Human-readable change summary (shows before→after for updates)
- Clock icon added to `viewExpense()` and `viewCollection()` modal titles

**API:** `GET /api/audit-log?entity=expense&entity_id=5` — Returns filtered audit trail

### 3. Bulk Approve for Pending Expenses
**File:** `src/routes/expenses.js`
- `POST /api/expenses/bulk-approve` — Accepts `{ ids: [1, 2, 3] }`, approves all pending expenses, logs each one
- **IMPORTANT:** Route is defined BEFORE `/:id/approve` to avoid route conflicts

**File:** `client/js/app.js`
- Checkbox column in expenses table (admin/accounts_head only)
- Header "Select All" checkbox (`#select-all-expenses`)
- "Approve Selected (N)" green button — appears when pending items checked
- `toggleSelectAllExpenses(checkbox)` — Toggles all visible checkboxes
- `updateSelectedCount()` — Updates button visibility and count
- `bulkApproveExpenses()` — Confirms then calls bulk approve API
- Each checkbox has `data-status` attribute to distinguish pending vs rejected
- `expenseRow()` updated — shows checkboxes for pending (approve) and rejected (delete) rows

### 4. Bulk Delete for Rejected Expenses
**File:** `src/routes/expenses.js`
- `POST /api/expenses/bulk-delete` — Accepts `{ ids: [1, 2, 3] }`, deletes all rejected expenses + attachments + notes, logs each deletion
- **IMPORTANT:** Route is defined BEFORE `/:id` (single DELETE) to avoid route conflicts

**File:** `client/js/app.js`
- "Delete Selected (N)" red button — appears when rejected items checked
- `bulkDeleteExpenses()` — Confirms then calls bulk delete API
- `updateSelectedCount()` handles both approve and delete counts independently

---

## Key Architecture Notes

### Route Ordering (CRITICAL)
In `src/routes/expenses.js`, routes MUST be in this order:
1. `POST /` (create)
2. `GET /` (list)
3. **`PATCH /:id`** (edit) — MUST be before /:id/approve and /:id/reject
4. `GET /:id` (view)
5. **`POST /bulk-approve`** — MUST be before /:id/approve
6. **`POST /bulk-delete`** — MUST be before /:id (single delete)
7. `PATCH /:id/approve`
8. `PATCH /:id/reject`
9. `DELETE /:id`
10. `POST /:id/notes`
11. `GET /:id/notes`

### Database Schema Notes
- `expenses` table does NOT have `updated_at` column — don't use it in UPDATE queries
- `expenses` table HAS `approved_by` and `approved_at` columns
- `audit_log` table stores all changes: action, entity, entity_id, details (JSON), performed_by, created_at

### Frontend Patterns
- `fmt(n)` — Format currency with ৳ symbol
- `fmtDate(d)` — Format date as "23 Jul 2026"
- `todayStr()` — Returns YYYY-MM-DD for today
- `statusBadge(s)` — Colored badge for status
- `attBadge(entityType, entityId, canUpload)` — Paperclip icon with count
- `openLightbox(url)` — Image overlay viewer
- `openModal(title, bodyHtml)` / `closeModal()` — Generic modal (title supports HTML)
- `showVersionHistory(entityType, entityId)` — Slide-in version history panel
- `toggleSelectAllExpenses(cb)` / `updateSelectedCount()` — Bulk selection helpers

---

## Files Modified This Session

| File | Changes |
|------|---------|
| `src/routes/expenses.js` | Added PATCH /:id, DELETE /:id, POST /bulk-approve, POST /bulk-delete, fixed route order |
| `src/routes/collections.js` | Added file upload support (multer + attachments + compression) |
| `src/routes/auditLog.js` | Added entity_id filter, added accounts_head auth |
| `src/routes/settlements.js` | Added DELETE /:id |
| `src/index.js` | Registered collection routes |
| `src/db/migrations/012_create_collections.js` | **NEW** |
| `src/db/migrations/013_create_settings.js` | **NEW** |
| `client/index.html` | Added version history panel container |
| `client/js/app.js` | Collection file upload, openModal innerHTML, version history panel, clock icons, checkbox selection, bulk approve/delete buttons, all related functions |

---

## Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@tbill.com | admin123 |
| Accounts Head | nargis@tbill.com | pass123 |
| Employee | rahim@tbill.com | pass123 |
| Employee | karim@tbill.com | pass123 |
| Employee | fatima@tbill.com | pass123 |

---

## How to Resume
1. Open terminal, `cd "C:\Users\OMAR\Desktop\T Bill"`
2. Run `npm run dev` — server starts at http://localhost:3000
3. Open new MiMoCode session, say: "Continue the T Bill project. Read HANDOFF_UPLOAD_SYSTEM.md"
4. Migrations already applied — DB is up to date

---

## Potential Next Steps
- Add bulk export for collections (CSV)
- Add collection totals to dashboard
- Add edit functionality for settlements (like expenses have)
- Add employee profile page enhancements
- Mobile responsive improvements
- Add login/auth audit logging (currently not logged)
- Add petty cash audit logging
- Add user management audit logging
