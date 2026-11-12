# Architecture & Product Prioritization Note

## 1. Product Strategy & Scope Decisions

Given the 4–6 hour constraint, I prioritized **depth on the core collaborative document loop** (editing reliability, real access control, and clean file handling) over breadth (e.g., CRDT multiplayer cursors, nested folder trees, or comment threads).

### What Was Prioritized
1. **Predictable Rich-Text Editing (`TipTap` / ProseMirror):** Raw `contentEditable` produces inconsistent DOM markup across browsers and breaks easily on lists/headings. Using TipTap gives clean schema-backed nodes, keyboard shortcuts (`Ctrl+B`, `Ctrl+I`, `Ctrl+U`, `# ` Markdown triggers), and reliable HTML + JSON persistence.
2. **Real Server-Enforced Sharing (`Firestore Security Rules`):** Instead of faking permissions only in React state, `firestore.rules` enforces that:
   - Only the owner (`ownerUid`) can share, unshare, or delete a document.
   - Editors (`editorEmails`) can update document content, title, and attachments, **but cannot modify `ownerUid` or sharing lists**.
   - Viewers (`viewerEmails`) can read documents and download/preview attachments, **but all writes are rejected by Firestore**.
3. **Zero-Friction Reviewer Testing:** Reviewers can sign up normally or use three one-click demo accounts (`alice@ajaia.dev`, `bob@ajaia.dev`, `carol@ajaia.dev`) that auto-provision on first click and seed starter owned/shared docs once.
4. **Dual File Workflows on the Free Tier:** Supporting both `.txt`/`.md`/`.docx` conversion into editable documents and document-level attachments without requiring a paid Firebase Blaze billing plan.

### What Was Intentionally Deprioritized
- **Character-by-character CRDT / OT co-editing (Yjs / Hocuspocus):** Replaced with Firestore `onSnapshot` live updates plus a conflict-safe dirty-state guard (`Reload Latest` prompt if a remote collaborator saves while local typing is dirty).
- **Firebase Cloud Storage / Cloud Functions:** New Cloud Storage buckets and Cloud Functions v2 require a Blaze (pay-as-you-go) plan. Keeping the backend 100% Spark-tier (`Auth + Firestore + Hosting`) satisfies the "no paid dependencies for reviewers" constraint.
- **Folder hierarchies, version history, and PDF export:** Deferred to keep the UI focused and testable within the timebox.

---

## 2. System Architecture

```text
React 18 + TypeScript (Vite SPA)
 ├── AuthView / AccountSwitcher ──► Firebase Auth (Email/Password + Demo Auto-Provision)
 ├── DashboardView              ──► repository.ts (Owned + Shared real-time queries)
 ├── EditorView (TipTap)        ──► Debounced Auto-Save + Remote Conflict Guard
 ├── ImportModal                ──► mammoth (.docx) + marked (.md) + DOMPurify
 └── AttachmentsPanel           ──► Base64 chunk encoder + Firestore subcollection
                                         │
                                         ▼
                           Cloud Firestore + firestore.rules
                     ├── users/{uid}
                     └── documents/{docId}
                           └── attachments/{attachmentId}
```

### Key Data Model Decisions
1. **Denormalized Role Arrays for Index-Free Queries:**
   Each `documents/{docId}` document stores `sharedEmails: string[]`, `editorEmails: string[]`, `viewerEmails: string[]`, and `sharedEntries: ShareEntry[]`.
   - **Why:** Firestore's security rule query validator statically verifies that a query satisfies the `read` rule. Querying `where('sharedEmails', 'array-contains', userEmail)` directly matches `userEmail() in resource.data.sharedEmails` in `firestore.rules`, and sorting client-side avoids fragile composite index setup errors on fresh deployments.
2. **Email-Based Sharing Prior to Recipient Sign-Up:**
   Because sharing targets an email (`bob@ajaia.dev`), the owner can grant access before the recipient has ever logged in, and Firestore rules verify `request.auth.token.email.lower()` against `editorEmails`/`sharedEmails` once they authenticate.
3. **Serialized `contentJson` + `contentHtml`:**
   Storing TipTap's ProseMirror JSON as a serialized string alongside sanitized `contentHtml` and `plainTextPreview` prevents hitting Firestore's nested-map depth limits while enabling fast dashboard snippets and lossless editor reload.
4. **Repository Abstraction (`Firebase` + `Local Sandbox` Fallback):**
   `src/lib/repository.ts` runs against Cloud Firestore when `VITE_FIREBASE_*` variables are configured, and falls back to `localStorage` with identical permission and validation checks when run locally without `.env`.

---

## 3. Security & Validation Boundaries
- **XSS Prevention:** All imported `.md` (via `marked`) and `.docx` (via `mammoth`) HTML passes through `DOMPurify` with forbidden `<script>`, `<style>`, `<iframe>`, and inline event-handler attributes stripped before persistence or rendering.
- **Upload Constraints:**
  - Document imports: `.txt`, `.md`, `.docx` up to **5 MB**.
  - Attachments: allowed extensions up to **500 KB** (`512,000` bytes) and **10 attachments** per document, enforced both client-side (`src/lib/validation.ts`) and in `firestore.rules` (`sizeBytes <= 512000`, `base64Data.size() <= 720000`) to stay safely under Firestore's 1 MiB document ceiling.

---

## 4. What I Would Build Next (With 2–4 Additional Hours)
1. **Firebase Cloud Storage Migration for Attachments:** Move attachment binaries out of Firestore subcollections into signed Cloud Storage objects (removing the 500 KB cap) when Blaze billing is available.
2. **Sub-document Yjs CRDT Sync:** Integrate `y-prosemirror` + a WebSocket/Firestore provider for true multi-cursor real-time editing without last-write-wins conflicts.
3. **Document Version Snapshots & Export:** Add periodic immutable snapshots under `documents/{docId}/versions` plus `.md` / `.docx` / print-to-PDF export.
4. **Firebase Emulator CI Suite:** Add `@firebase/rules-unit-testing` in CI to assert every `firestore.rules` allow/deny path against the local Firestore emulator.
