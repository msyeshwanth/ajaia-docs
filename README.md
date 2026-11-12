# Ajaia Docs — Lightweight Collaborative Document Editor

A focused, full-stack collaborative document workspace built with **React + TypeScript + TipTap + Firebase (Auth, Cloud Firestore, Hosting)**.

---

## Live Demo & Test Accounts

- **Live URL:** https://ajaia-546dd.web.app
- **Seeded One-Click Demo Accounts** (password for all: `AjaiaDemo2026!`):
  - `alice@ajaia.dev` — **Alice Chen** (Product Lead)
  - `bob@ajaia.dev` — **Bob Patel** (Staff Engineer)
  - `carol@ajaia.dev` — **Carol Diaz** (Design Partner)

> Reviewers can either sign in from the landing screen using the one-click demo buttons or use the **Quick Switch Demo Account** menu in the top-right header to verify **Owned by me** vs. **Shared with me** and **Editor** vs. **Viewer** permissions across accounts.

---

## Core Capabilities

1. **Document Creation & Rich-Text Editing (`TipTap` / ProseMirror)**
   - Create blank documents, rename inline from dashboard or editor header, delete owned documents, and reopen via persistent hash URLs (`#/doc/<id>`).
   - Formatting toolbar: **Paragraph / H1 / H2 / H3**, **Bold**, **Italic**, **Underline**, **Strikethrough**, **Inline Code**, **Bulleted List**, **Numbered List**, **Blockquote**, **Undo / Redo**, and **Clear Formatting**.
   - Debounced auto-save (`750ms`), manual **Save** (`Ctrl/Cmd + S`), live save status indicator (`Saved`, `Saving…`, `Unsaved changes`, `Save error`), and word counter.

2. **File Upload Workflows (Import & Attachments)**
   - **Import as Editable Document:** Upload `.txt`, `.md`, or `.docx` (max **5 MB**) via drag-and-drop or file picker. Parsed client-side (`marked` for Markdown, `mammoth` for `.docx`) and sanitized with `DOMPurify` before saving to Firestore.
   - **Document Attachments:** Attach supporting files (`.txt`, `.md`, `.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.docx`, max **500 KB per file**, up to **10 files per document**) in the document's **Attachments** drawer. Supports preview (images & text/Markdown), download, and deletion (Owner/Editor only).

3. **Sharing & Access Control**
   - Explicit ownership (`ownerUid`) and email-based sharing (`Editor` or `Viewer`).
   - Clear visual separation between **Owned by me** and **Shared with me** documents, with role badges (`Owned`, `Shared · Editor`, `Shared · Viewer`).
   - Enforced in both the React UI (read-only toolbar/inputs for Viewers, owner-only Share/Delete) and backend **Firestore Security Rules** (`firestore.rules`).

4. **Persistence & Resilience**
   - Backed by **Firebase Auth + Cloud Firestore** with real-time `onSnapshot` listeners.
   - When `.env` Firebase credentials are omitted locally, the app automatically falls back to a **Local Sandbox** (`localStorage`) mode (clearly badged in the header) so evaluators can still run and test locally without provisioning a Firebase project first.

---

## Supported File Types & Limits

| Workflow | Supported Formats | Size / Count Limits | Notes |
| --- | --- | --- | --- |
| **Import to Editable Doc** | `.txt`, `.md`, `.docx` | Max **5 MB** per file | Converted to sanitized rich HTML |
| **Document Attachments** | `.txt`, `.md`, `.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.docx` | Max **500 KB** per file, **10 files** per doc | Stored in Firestore subcollection (`Spark` free-tier safe) |

---

## Local Setup & Run Instructions

### Prerequisites
- **Node.js 20+** and **npm 10+**

### 1. Install dependencies
```bash
npm install
```

### 2. Configure Firebase (Optional for Local Sandbox, Required for Cloud Mode)
Copy `.env.example` to `.env` and fill in your Firebase Web App config:
```bash
cp .env.example .env
```
In your Firebase project console:
1. Enable **Authentication → Email/Password**.
2. Create a **Cloud Firestore** database and deploy `firestore.rules`:
   ```bash
   npx firebase-tools deploy --only firestore:rules
   ```

> **Zero-config local evaluation:** If `.env` is omitted, the app runs in **Local Sandbox** mode using browser `localStorage` with identical validation and permission rules.

### 3. Start local dev server
```bash
npm run dev
```

### 4. Run automated tests & production build
```bash
npm test
npm run build
```

### 5. Deploy to Firebase Hosting
```bash
npm run build
npx firebase-tools deploy --only firestore:rules,hosting
```
