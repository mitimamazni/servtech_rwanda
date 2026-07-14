# ServTech Rwanda: Predefence Pack
Testing plan + code walkthrough, based on the actual codebase in `servtech_rwanda-main`.

---

## 1. What the system actually is (in plain terms)

A React (Vite) frontend + Express/Node backend + PostgreSQL app for onboarding and KYC-checking clients for a betting/service business in Rwanda. Three roles: **admin**, **agent**, **client**. Core loop:

1. Someone registers (self-service with ID-photo OCR, or agent-assisted).
2. The system checks the ID against a seeded `id_records` table, runs age/identity rules, and runs **simulated** KYC checks (face-match score, document-authenticity score, sanctions/PEP list match), these are clearly labelled `MOCK` in `server/utils/mockScreening.js` and are deterministic (hashed from the input, not random), so a real screening API could be swapped in later without changing the interface.
3. Automation rules (`workflowEngine.js`) react to registration/review events, auto-escalation, multi-step approval chains for high-risk cases, outbound webhooks.
4. Everything is logged to `audit_logs` for compliance with Rwanda's data-protection law.
5. Admin dashboards expose analytics, security monitoring (login attempts, IP blocking, 2FA via `speakeasy`/TOTP), and communications (templated email/SMS logging).

**Important thing to say out loud at your predefence, unprompted, before an examiner catches it**: the face-match, document-authenticity, and sanctions/PEP screening are **mocked**, the code says so directly in comments (`utils/mockScreening.js`). Volunteering this yourself reads as engineering maturity ("I built the interface a real provider like AWS Rekognition/ComplyAdvantage would plug into, and simulated it for the demo because live KYC vendor access wasn't feasible for a student project"). Being asked "wait, is this real?" and backpedaling reads badly. Same logic applies to the seeded `id_records` registry standing in for a live NIDA API, the README already frames this correctly, reuse that framing.

---

## 2. Architecture at a glance

```
client/  (React + Vite + Tailwind, hosted on Netlify/Vercel)
  src/pages/        → one file per screen (Login, Landing, ClientSelfRegister,
                       AgentSelfRegister, ManualClientRegister, AdminDashboard,
                       AgentDashboard, AuditLog, AnalyticsDashboard,
                       SecurityMonitoring, SecuritySettings, WorkflowAutomation,
                       Communications, AgentsPage, AgentDetail, ClientActivity,
                       ClientResubmit)
  src/components/   → Captcha, SelfieCapture, TermsModal, Navbar, Skeleton, Logo
  src/utils/        → ocr.js (Tesseract.js), idValidation.js, registrationDraft.js
  src/context/      → AuthContext.jsx (JWT held in memory/localStorage, role-based routing)

server/  (Express, hosted on Render)
  routes/        → auth, registration, client, agents, audit, analytics,
                   security, automation, communication
  controllers/   → one per route file, holds the business logic
  utils/         → captcha.js, kyc.js, mockScreening.js, workflowEngine.js,
                   webhooks.js, email.js, notify.js
  middleware/    → auth (JWT verify + role check), ipBlock
  config/        → db.js (pg Pool), schema.sql, seed.sql, migration_v2..v10.sql,
                   mock_sanctions_list.json
```

Data flows: browser → Netlify/Vercel (static React) → REST calls to Render (`VITE_API_URL`) → Express → PostgreSQL on Supabase. OCR runs **in the browser** (Tesseract.js) specifically so raw ID photos never touch the server, this is a real, defensible design decision, not padding: worth stating in your defence as a privacy/bandwidth choice.

Database has grown across 9 migrations (`migration_v2.sql`…`migration_v10.sql`) on top of the base `schema.sql`. Key tables: `users`, `id_records`, `clients`, `audit_logs`, `login_attempts`, `blocked_ips`, `automation_rules`, `workflow_execution_log`, `escalation_rules`/`escalation_log`, `approval_chains`/`approval_chain_steps`/`approval_decisions`, `webhook_integrations`/`webhook_delivery_log`, `message_templates`/`message_log`.

**Security measures actually implemented** (verified in code, not just claimed): bcrypt password hashing, JWT auth (8h expiry) via `middleware/auth.js`, `helmet()`, gzip `compression()`, global rate limit (100 req/15min) plus a stricter login limiter (20/15min, and, as of this period's fix, `skipSuccessfulRequests: true` so only *failed* logins count, so one bad actor on a shared IP/NAT can't lock out everyone else on it), CORS allow-list, `trust proxy` set correctly for Render's reverse proxy so `req.ip` is real, an `ipBlock` middleware backed by a `blocked_ips` table, and TOTP-based 2FA (`speakeasy`) with enable/confirm/verify/disable endpoints in `authController.js`.

---

## 3. Testing plan for the deployed site

You didn't give me the live URL, so this plan is written generically, swap in your actual Netlify/Vercel frontend URL and Render backend URL. Do this as a checklist the night before / morning of; each item is something an examiner is likely to probe.

### 3.1 Pre-flight (5 min)
- [ ] Open the frontend URL cold (no cache) and confirm it loads, Render free tier has ~30s cold-start, so hit the backend health check (`GET /`) first to "wake" it before the live demo, or you'll sit in silence in front of your panel.
- [ ] Confirm `/debug/ip` on the backend returns your real IP, not an internal proxy IP (confirms `trust proxy` is working, relevant if you get asked about the IP-blocking feature).
- [ ] Have the demo login credentials ready: `admin@servtech.rw` / agent account / a test client account, all with known passwords (re-verify `migration_v2.sql` fixed the seeded password hash before you rely on it).

### 3.2 Core registration flow
- [ ] **Self-service registration with OCR**: upload a clear ID photo, confirm OCR pre-fills name/ID number/DOB reasonably (expect ~85-90% accuracy, have a backup ID photo that OCRs cleanly, since a bad scan live is a common demo failure).
- [ ] Deliberately submit a **blurry/rotated** photo to show the correction step working (turns a potential embarrassment into a demonstrated feature).
- [ ] Confirm progress auto-saves mid-form: fill in half the form, refresh the tab, confirm it resumes (and confirm the ID photo itself is *not* restored, that's a deliberate security choice, mention it if asked).
- [ ] Accept Terms & Conditions, confirm the acceptance timestamp/version is recorded against the client (check via Admin → client detail, or audit log).
- [ ] Submit a **matched** ID (one seeded in `id_records`) → confirm instant "verified" status.
- [ ] Submit an **unmatched** ID → confirm "pending" status and that it shows under manual review.
- [ ] **Age rules**: try a seeded under-18 ID → confirm it's blocked outright. Try a seeded over-80 self-service ID → confirm it's redirected/rejected with `status = 'rejected'` and shows under the Rejected filter. Try an over-80 **agent-assisted** registration → confirm the in-person identity-confirmation checkbox is required and gates submission.
- [ ] **Agent-assisted registration**: log in as agent, enter an ID number, confirm auto-fill from the registry.
- [ ] CAPTCHA: confirm it's enforced on both client self-registration and login (this was a fixed bug, mismatched CAPTCHA endpoint, worth explicitly re-testing since it's called out as a recent fix).

### 3.3 KYC / screening layer
- [ ] Trigger the selfie-capture step (`SelfieCapture.jsx`) and confirm a face-match "score" is produced and stored, know that this is the mocked/deterministic scorer, and be ready to explain why (see §1).
- [ ] Submit a name that matches an entry in `mock_sanctions_list.json` → confirm it gets flagged and routed to manual review / approval chain, not auto-verified.
- [ ] Confirm a flagged/high-risk case actually requires the configured approval chain (multiple sign-offs) before it can move to verified, try approving with a single reviewer account and confirm it's blocked until the chain is satisfied.

### 3.4 Admin/agent dashboards
- [ ] Dashboard stats (total/verified/pending/today) match what you just created in the flows above, do the registration tests *before* checking dashboard counts, and check counts before/after so you have a concrete before→after number to show.
- [ ] Client table: search, filter, pagination.
- [ ] Bulk actions: select multiple clients, validate/reject/activate/deactivate in one action, then CSV-export the selection and open the CSV to confirm it's not corrupted.
- [ ] Validate/reject a pending client with a rejection reason; confirm the reason is stored and visible on the client detail / resubmission flow.
- [ ] Client resubmission: as the client (or via the agent view), resubmit a rejected application, confirm the loop closes properly (this is one of the anomaly-detection checks the report mentions, "clients caught in repeated resubmission loops", so don't loop it more than twice on stage).
- [ ] Agent self-registration (`/agent-signup`): submit a new agent application, confirm it's `pending` and can't log in yet; approve it from Agent Management or `/admin/agent/:id`, then confirm that agent can now log in.
- [ ] Agent viewing a client they registered at `/agent/client/:id/activity`, confirm this no longer 403s (this was a fixed bug, explicitly re-test it).
- [ ] Activity timeline on a client profile: confirm registration, review decisions, messages, and automation actions all appear in one chronological feed.

### 3.5 Workflow automation
- [ ] Open the visual/drag-and-drop rule designer, confirm existing rules render correctly.
- [ ] Change a rule's threshold (e.g. minimum face-match confidence) from the in-app settings panel, trigger the corresponding event, confirm the new threshold is actually applied (not cached from before the edit, restart nothing, just re-trigger).
- [ ] Escalation rule: if feasible in your test window, set a short time limit, leave a case pending past it, confirm an escalation fires and the responsible role gets notified (email, check `utils/email.js`'s configured provider actually sends in the deployed environment, since email delivery is a common thing that "works locally, silently fails in prod" due to missing env vars).
- [ ] Webhook: if you have a webhook endpoint configured (e.g. a webhook.site test URL), trigger an automation event and confirm the delivery log records it, show the delivery log, not just "trust me it fired."

### 3.6 Security module
- [ ] Log in with a wrong password repeatedly on one account, confirm the failed-attempt counter climbs and a legitimate second account on the same network is unaffected (this is the specific bug that was fixed, demonstrating it directly rebuts "did you actually fix this or just say you did").
- [ ] Try to block a private/reserved IP (e.g. `10.x.x.x` or `127.0.0.1`) from Security Monitoring → confirm it's refused.
- [ ] Try to block your own current admin IP → confirm it's refused.
- [ ] Block a real test IP → confirm it requires explicit confirmation, and that it auto-expires (check the expiry field/timestamp rather than waiting for it to elapse on stage).
- [ ] Enable 2FA on the admin account (`enable2FA` → scan/enter TOTP code → `confirm2FA`), log out, log back in, confirm the app now demands the 6-digit code before issuing a session. Then disable it again so you're not locked out mid-defence.

### 3.7 Resilience / negative testing (the questions examiners actually ask)
- [ ] Kill your wifi mid-registration submit, confirm the frontend shows an error rather than a blank/frozen screen.
- [ ] Load Security Monitoring, Communications, and Workflow Automation with one of their data sources deliberately failing (e.g. temporarily break one endpoint, or just note this was already tested and fixed this period per the progress report), confirm each panel fails independently rather than blanking the whole page.
- [ ] Try accessing an admin-only route (`/api/audit-logs`, `/api/users`) as a logged-in agent → confirm 403, not data leakage.
- [ ] Try accessing any authenticated route with no token / expired token → confirm 401, not a crash.
- [ ] SQL-injection smoke test on a search/filter field (e.g. `' OR '1'='1` in the client search box) → confirm it's treated as a literal string, not executed (all queries are parameterised per the README, verify, don't just assert).
- [ ] Upload a non-image file where an ID photo is expected → confirm it's rejected by file-type validation, not silently accepted or crashing OCR.
- [ ] Upload an oversized image → confirm the 8MB body limit / upload validation rejects it cleanly.

### 3.8 What to explicitly *not* over-claim
- Say "simulated/mocked" for face-match, document authenticity, and sanctions/PEP screening, don't call these "AI-powered" or "real-time verified against government records" unprompted.
- Say "seeded registry" for the ID lookup, not "connected to NIDA."
- If asked about scale: be upfront that this has been tested by real users at prototype scale, not load-tested for production traffic (the README says so directly, repeat that framing rather than improvising a number).

---

## 4. Likely predefence questions and where the answer lives in code

| Likely question | Where to point |
|---|---|
| "How do you prevent a fake/stolen ID from being verified?" | `id_records` match + age/year-consistency check (ID's encoded birth year vs entered DOB) in registration controller; mocked document-authenticity score as the stand-in for a real forensics vendor |
| "What happens to the photo after OCR?" | Nothing, OCR runs client-side in the browser (Tesseract.js), photo is never uploaded/stored; explicitly excluded from the auto-saved draft too |
| "How do you stop one bad actor from locking out other users?" | `skipSuccessfulRequests: true` on the login rate limiter, in `server/index.js` |
| "Why can't an admin block their own IP or a private range?" | `ipBlock` middleware / `securityController.blockIp`, explicit guards, this period's hardening work |
| "How is 2FA implemented?" | `speakeasy` TOTP, `authController.js` (`enable2FA`, `confirm2FA`, `verify2FA`, disable) |
| "What's actually mocked vs real?" | `server/utils/mockScreening.js`, the file header itself documents this |
| "How would you swap in a real NIDA/screening API?" | Same interface, different implementation, `mockScreening.js` and the `id_records` query are both designed as drop-in-replaceable per the README's Architecture Decisions section |
| "How do high-risk cases get extra scrutiny?" | `approval_chains` / `approval_chain_steps` / `approval_decisions` tables + `workflowEngine.js`'s `getActiveApprovalChain` |
| "How do you know a fix actually worked, not just 'looks fixed'?" | Point to the specific re-test in §3.4/§3.6 above rather than the progress-report prose alone |

---

## 5. One honest caveat about this pack

I built this from your actual code (routes, controllers, migrations, schema) rather than only your progress report, the two mostly agree, but I flagged the two places (mock KYC scoring, seeded ID registry) where the report's language ("automated face-match," "verified against... registry") could be misread by an examiner as "connected to a real system" if you don't clarify it yourself first. Everything else in the report, CAPTCHA fix, login-limiter fix, IP-block hardening, agent-client 403 fix, independent dashboard failure handling, is backed up by what's actually in the code, not just asserted.
