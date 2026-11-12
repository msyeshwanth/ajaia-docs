# 3–5 Minute Walkthrough Video Script

Use this shot list to record a crisp 3.5–4.5 minute Loom / YouTube walkthrough once deployed:

## 0:00 – 0:45 | Problem Framing & Live Workspace Overview
- Open the **Live URL** and show the landing screen.
- Briefly state the goal: *"Build the strongest, production-minded collaborative document editor within the timebox, prioritizing rich editing reliability, real server-enforced sharing, and dual file workflows."*
- Click **Alice Chen (`alice@ajaia.dev`)** to sign in.
- Point out the clean separation between **Owned by me** and **Shared with me** and the **Cloud Firestore** status badge.

## 0:45 – 1:45 | Document Creation, Rich-Text Editing & Persistence
- Click **New Document** (or open *Q4 Internal Workspace Launch Brief*), rename the title inline, and demonstrate:
  - Headings (`H1`, `H2`, `H3`), **Bold**, *Italic*, <u>Underline</u>, bulleted and numbered lists.
  - Show the `Unsaved changes` → `Saving…` → `Saved` indicator.
- Hit **Browser Refresh (`F5`)** to prove Firestore persistence preserves both title and rich-text formatting.

## 1:45 – 2:35 | File Upload Workflows (Import + Attachments)
- Return to **Docs**, click **Import File**, and drag in a sample `.md` or `.docx` file (point out the UI note showing supported types `.txt`, `.md`, `.docx` and 5 MB limit). Show it opening immediately as a formatted, editable document.
- Open the **Attachments** drawer inside the editor, attach a small image or text file (note the 500 KB Spark-tier limit), and demonstrate **Preview** and **Download**.

## 2:35 – 3:35 | Sharing & Role-Based Access Control
- Click **Share**, explain **Owner** vs **Editor** vs **Viewer**, and add/toggle `bob@ajaia.dev` (Editor) and `carol@ajaia.dev` (Viewer).
- Use the top-right **Account Switcher** to switch to **Bob Patel**:
  - Show the document now appears under **Shared with me** with the `Shared · Editor` badge and can be edited.
- Switch to **Carol Diaz**:
  - Show `Shared · Viewer`, the disabled formatting toolbar, disabled title input, and read-only attachments banner — enforced by both UI and `firestore.rules`.

## 3:35 – 4:30 | Tradeoffs, Architecture & AI-Native Workflow
- Briefly summarize key tradeoffs from `ARCHITECTURE.md`:
  - Why TipTap + DOMPurify over raw `contentEditable`.
  - Why Spark-tier Firestore attachments (500 KB cap) instead of paid Blaze Cloud Storage, and why `onSnapshot` + conflict banner instead of CRDT co-editing for this 4–6h scope.
- Highlight 2 concrete examples from `AI_WORKFLOW.md`:
  - How AI accelerated scaffolding and Vitest coverage, **and** two real bugs caught through engineering judgment (Firestore security rule query-matching on `sharedEmails` and TipTap `useEditor` closure staleness on auto-save).
