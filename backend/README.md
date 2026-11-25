# HVA–NQ52 | Backend 0.1.0 (development)

Standalone Google Apps Script + private Google Sheets + Firebase Authentication (email/password).
This is not EDOS and must never use EDOS spreadsheet IDs, web-app URLs, login tokens, or Router.

## 1. Setup (school administrator)
1. Create a **new private Google spreadsheet**, accessible only to the authorized administrators. Do not import real data into any public GitHub repository.
2. Create a **new standalone Apps Script project**; copy 00_CORE.gs, 01_ROUTER.gs, 02_WORKFLOW.gs into it. Use the V8 runtime, timezone Asia/Ho_Chi_Minh.
3. Create a separate Firebase project for NQ52. Enable email/password authentication and provision accounts through the Firebase console or a trusted administrative process. Disable self-service account creation where supported; the NQ52 allowlist also blocks unprovisioned identities. Configure abuse protections and Firebase password policy (at least 12 characters recommended). No passwords are written to Sheets.
4. Apps Script → Project Settings → Script Properties: set NQ52_SHEET_ID to the new spreadsheet ID and NQ52_FIREBASE_KEY to the Firebase Web API key for this project. Do not publish properties, user records or secrets to GitHub.
5. Run setupNQ52() once as owner and authorize required scopes. It creates seven worksheets; re-running validates headers without deleting records.
6. Provision approved users in NQ52_USERS. Each row must have a unique id, unique username (case-insensitive), verified email, exact Firebase UID, name, unit, group (CBQL / GV / NV), comma-separated roles, active=TRUE and mustChange=TRUE for temporary passwords. Keep role assignments subject to the principal's approval. Roles are independent from group: TTCM, BGH, DECIDER, HISTORY_ADMIN. Ordinary users may leave roles blank. Never assign roles merely from a displayed job title. CBQL review authority remains intentionally disabled until confirmed. Passwords and recovery details must be communicated privately.
7. Deploy a **test Web App** (execute as owner; access setting determined by school/Workspace policy). The GET endpoint is a public health/version check only. All private operations use JSON POST. If anonymous Web App access is used, review rate limits, abuse risks and permissions; do not expose the service to real users before security review.
8. Validate redirect/CORS and account flow from the actual GitHub Pages origin. Do not use JSONP, GET credentials, or no-cors opaque responses as an authentication workaround. If cross-origin access is unreliable, use Apps Script HtmlService on its own origin or an approved secure reverse proxy. Frontend integration is a separate step.
9. Use test accounts and synthetic tasks only. Before actual deployment, review security, backup/recovery, policy, role mapping, expiry/revocation, privacy, quotas and production logging.

## 2. API (POST JSON)
Example shape: {"action":"listTasks","token":"SESSION_TOKEN","month":"2026-11"}
Responses: {"ok":true,"data":...} or {"ok":false,"code":"..."}.
HTTP status is not the business outcome; inspect ok. Never place credentials or tokens in URLs. No action uses client-provided actor/role.

| Action | Required additional fields / behavior |
|---|---|
| login | username, password; returns session token and user |
| changePassword | token, oldPassword, newPassword; revokes sessions, requires login again |
| logout | token |
| me | token |
| listPeople | token; authorized target scope |
| listTasks | token, month |
| assignTask | token, userId, month, category A/B/C, title, deliverable, acceptance, deadline YYYY-MM-DD; optional milestone, retro, source |
| acceptTask | token, id |
| saveTaskResult | token, id, resultStatus COMPLETED/PARTIAL/NOT_COMPLETED, description; optional evidence |
| listReports | token, month |
| saveReportDraft | token, month, strength, weakness, solution; optional proposedClass, additionalWork, sourceNote |
| submitReport | token, id; task snapshot, locks self-editing |
| reviewReport | token, id, comment, proposedClass, reason; keeps self-report and review history |
| listMeetings | token, month; scoped |
| createMeetingDraft | token, month, date, mode DIRECT/ONLINE/HYBRID, venue, title, agenda, participants (user IDs) |
| listHistory | token, month |
| importHistory | token, userId, month, source, reference, classification; optional note; unverified import only |
| getMonthlySummary | token, month; active-user counts and manager proposals, not final quota |

Class codes: HTXSNV, HTTNV, HTNV, KHTNV. These are self/manager proposals or imported original results, not automated official decisions.

## 3. Required tests (not executed in Apps Script yet)
- Unauthenticated access, unknown user, disabled account, UID mismatch, wrong password, throttling, expired/revoked token.
- First login: other APIs reject PASSWORD_CHANGE_REQUIRED; password change revokes prior sessions; login again with new password.
- GV cannot assign tasks or read another GV's records. TTCM cannot manage outside own unit or self-review. BGH cannot review CBQL in this version. Non-authorized meeting participant cannot access meeting drafts.
- Task duplicate, wrong deadline month, historical task without source; task acceptance and result; submission blocked until task results complete or source note is recorded for a report without assigned tasks.
- After report submission: cannot overwrite self-report or task result; manager review history retained. Historical import marked unverified, not recomputed.
- Formula-like text in Sheets, malformed JSON, oversized reports, concurrent writes, quotas, interrupted writes, restart/backup, CORS and production audit checks.
- Verify all operations target ONLY the newly configured NQ52 spreadsheet.

## 4. Deliberately not implemented yet
Official QD32 scoring, policy versions/eligibility, quota limits and rounding, authority for CBQL, final classification/appeal, post-review amendments and end-of-month updates, historical verification, official Excel export, notification, Google Meet, QR attendance and meeting minutes. Must verify legal documents and school decisions before enabling. The legacy CuocHop.html still calls EDOS; do not link it as an operational NQ52 page.
Seven worksheets are a starter schema; official forms, richer history and storage schema will need migration. Sheets is not a transactional database: writes and audit append can fail independently. Add idempotency, recovery, pagination, persistent abuse controls, secure session lifecycle/cleanup and privacy review before production.
Do not store user tokens in localStorage. Restrict sharing of private spreadsheet, backups and evidence; revoke access promptly when accounts change. No real credentials or staff data are included.
