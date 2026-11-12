# Submission Overview — Ajaia Docs

## Included Deliverables
- **Source Code (`src/`, `firestore.rules`, `firebase.json`, `package.json`):** Full-stack React 18 + TypeScript + TipTap + Firebase Auth/Firestore/Hosting application.
- **`README.md`:** Local setup, Firebase configuration, supported file formats/limits, and test/build commands.
- **`ARCHITECTURE.md`:** Product prioritization, data model decisions, security boundaries, and next-step roadmap.
- **`AI_WORKFLOW.md`:** AI tools used, acceleration areas, bugs/choices changed or rejected, and verification workflow.
- **`WALKTHROUGH_SCRIPT.md`:** Structured shot list for the 3–5 minute video walkthrough.
- **`WALKTHROUGH_VIDEO_URL.txt`:** Text file containing the unlisted Loom / YouTube walkthrough URL (update after recording).
- **`examples/sample-brief.md`:** Sample Markdown file ready to test the **Import File** workflow.

---

## Live Deployment & Test Credentials
- **Live Product URL:** https://ajaia-546dd.web.app
- **Walkthrough Video URL:** *(Paste your unlisted Loom / YouTube link in `WALKTHROUGH_VIDEO_URL.txt` and in the assessment form)*
- **Seeded Reviewer Accounts** (Password for all: `AjaiaDemo2026!`):
  - `alice@ajaia.dev` — **Alice Chen** (Product Lead)
  - `bob@ajaia.dev` — **Bob Patel** (Staff Engineer)
  - `carol@ajaia.dev` — **Carol Diaz** (Design Partner)

> Reviewers can sign in with one click on the login screen or switch between accounts anytime using the top-right account menu.

---

## Status Summary

### What Is Working End-to-End
- **Authentication & Demo Switching:** Firebase Email/Password sign-up/sign-in plus one-click seeded accounts (`alice@ajaia.dev`, `bob@ajaia.dev`, `carol@ajaia.dev`) that auto-provision starter owned and shared documents on first login.
- **Document Creation, Renaming & Rich-Text Editing:** TipTap editor supporting Headings (`H1`–`H3`), Bold, Italic, Underline, Strikethrough, Inline Code, Bulleted & Numbered lists, Blockquotes, Undo/Redo, word count, inline rename, debounced auto-save (`750ms`), and `Ctrl/Cmd+S` manual save.
- **Dual File Upload Workflows:**
  1. Import `.txt`, `.md`, and `.docx` (max 5 MB) into new sanitized editable documents.
  2. Attach `.txt`, `.md`, `.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`, and `.docx` files (max 500 KB, up to 10/doc) with preview, download, and delete.
- **Sharing & Access Control:** Owner / Editor / Viewer roles, distinct **Owned by me** and **Shared with me** sections, role updates/revocation, and Firestore Security Rules enforcement (`firestore.rules`).
- **Live Firebase Deployment (`https://ajaia-546dd.web.app`):** Firebase Auth (Email/Password), Cloud Firestore, Firestore Security Rules, and Firebase Hosting are deployed and active.
- **Automated Tests:** Vitest suite covering file import/sanitization, validation bounds, permission logic, and Dashboard ownership UI separation (`npm test`: 4 files / 14 tests passing).

### Deliberate Scope Cuts / Incomplete
- **Walkthrough Video Recording:** To be recorded and linked in `WALKTHROUGH_VIDEO_URL.txt` using `WALKTHROUGH_SCRIPT.md`.
- **Simultaneous Character-Level Co-Editing (CRDT):** Real-time updates sync via Firestore `onSnapshot` with a conflict reload banner rather than multiplayer CRDT cursors.
- **Large Binary Attachments (>500 KB):** Intentionally capped at 500 KB inside Firestore subcollections so the app runs 100% free on Firebase Spark tier without Blaze Cloud Storage.

### What I Would Build Next (2–4 Hours)
1. Migrate attachments to **Firebase Cloud Storage** signed URLs to lift the 500 KB attachment limit.
2. Add **Yjs CRDT** collaborative editing and presence cursors.
3. Add **version history snapshots** and **PDF / Markdown export**.
4. Add **Firebase Emulator Rules Unit Tests** in CI to verify every `firestore.rules` path automatically.
