# AI-Native Workflow Note

## 1. AI Tools Used
- **Antigravity (AI Coding Assistant):** Used for architecture scoping, TypeScript/React component scaffolding, Firestore Security Rules drafting, Vitest unit/component test generation, and documentation structuring.
- **Firebase MCP Server:** Used to inspect environment state and configure/deploy Firebase services cleanly from the workspace.

---

## 2. Where AI Materially Sped Up Execution
- **Rapid Stack & Tradeoff Scoping:** Compressed initial planning by evaluating Spark-plan constraints (avoiding Blaze-only Cloud Functions/Storage while preserving real backend access control).
- **Boilerplate & UI Velocity:** Generated the Vite + TypeScript + TipTap toolbar, Share/Import modals, Attachment preview drawer, and clean CSS design system rapidly, freeing time for edge-case hardening and testing.
- **Test Coverage Generation:** Drafted thorough Vitest cases for file sanitization, size/extension validation, permission transitions, and Dashboard role rendering (`src/lib/__tests__/*`, `src/components/__tests__/*`).

---

## 3. AI-Generated Output I Changed, Caught, or Rejected
Applying engineering judgment rather than accepting first-pass AI output caught several concrete bugs before deployment:

1. **Rejected Raw `contentEditable` & Unsafe HTML Injection:**
   - *Initial option:* Simple `contentEditable` div with `document.execCommand`.
   - *Decision:* Replaced with **TipTap (ProseMirror)** plus **DOMPurify** sanitization on imported `.md` and `.docx` payloads to avoid browser formatting inconsistencies and XSS risks from uploaded files.
2. **Caught Firestore Security Rule Query Mismatch:**
   - *Bug in first draft:* Checking `userEmail() in resource.data.editorEmails || userEmail() in resource.data.viewerEmails` in the `read` rule while querying `where('sharedEmails', 'array-contains', email)`.
   - *Fix:* Firestore's static query validator requires the query filter to match the `read` rule expression directly. Updated `canReadDoc` to check `userEmail() in data.sharedEmails` while keeping `editorEmails` enforced on `update` and attachment writes.
3. **Caught React / TipTap Closure Staleness in Auto-Save:**
   - *Bug in first draft:* TipTap's `useEditor({ onUpdate })` captures the initial callback closure on mount, when `docRecord` is still `null`, which would silently no-op debounced auto-save.
   - *Fix:* Routed `onUpdate` through `persistRef.current`, `canEditRef.current`, and `titleDraftRef.current` so debounced saves always persist the latest document ID and title.
4. **Prevented Editor Cursor Jumps on Own-Save Snapshot Echoes:**
   - *Bug in first draft:* Re-calling `editor.commands.setContent(...)` whenever Firestore `onSnapshot` fired after a save would reset the user's cursor position.
   - *Fix:* Added an equality check (`docRecord.contentHtml === editor.getHTML() && docRecord.title === titleDraftRef.current`) to ignore redundant echo snapshots, plus a dirty-state conflict banner when another collaborator edits concurrently.
5. **Removed Composite Index Failure Risk:**
   - *Change:* Removed Firestore `orderBy('updatedAt', 'desc')` from `where(...)` queries and sorted returned snapshots client-side so fresh Firebase deployments never fail with missing-index runtime errors.
6. **Caught Concurrency Race in First-Login Demo Seeding During Live QA:**
   - *Bug caught in live testing:* `onAuthStateChanged` and `signInDemoAccount` raced on initial signup, creating duplicate starter documents in Firestore.
   - *Fix:* Added an in-memory per-UID seeding lock (`seedingInFlight`) plus deterministic document IDs (`starter-${uid}-${index}`) so starter provisioning is idempotent.

---

## 4. How I Verified Correctness, UX Quality, and Reliability
- **Static & Build Verification:** Ran strict TypeScript typechecking (`tsc -b`) and production bundling (`vite build`).
- **Automated Tests:** Executed `vitest run` covering file parsing/XSS sanitization, validation limits, role/sharing state transitions, and Dashboard ownership separation.
- **End-to-End Flow Testing:** Verified account switching (`Alice` → `Bob` Editor → `Carol` Viewer), document creation/renaming/persistence across browser reload, `.md`/`.txt`/`.docx` import, attachment upload/preview/download, and read-only Viewer enforcement.
