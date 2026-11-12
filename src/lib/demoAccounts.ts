import type { DemoAccount } from '../types/document';

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: 'alice',
    name: 'Alice Chen',
    roleLabel: 'Product Lead',
    email: 'alice@ajaia.dev',
    password: 'AjaiaDemo2026!',
    avatarColor: '#2563eb',
  },
  {
    id: 'bob',
    name: 'Bob Patel',
    roleLabel: 'Staff Engineer',
    email: 'bob@ajaia.dev',
    password: 'AjaiaDemo2026!',
    avatarColor: '#059669',
  },
  {
    id: 'carol',
    name: 'Carol Diaz',
    roleLabel: 'Design Partner',
    email: 'carol@ajaia.dev',
    password: 'AjaiaDemo2026!',
    avatarColor: '#7c3aed',
  },
];

export interface StarterDocSeed {
  title: string;
  contentHtml: string;
  shares: Array<{ email: string; role: 'editor' | 'viewer' }>;
}

export function getStarterDocsForEmail(email: string): StarterDocSeed[] {
  const normalized = email.trim().toLowerCase();

  if (normalized === 'alice@ajaia.dev') {
    return [
      {
        title: 'Q4 Internal Workspace Launch Brief',
        contentHtml: `
          <h1>Q4 Internal Workspace Launch Brief</h1>
          <p>Welcome to <strong>Ajaia Docs</strong> — a lightweight, collaborative document workspace built for fast team alignment.</p>
          <h2>Core Capabilities Demonstrated</h2>
          <ul>
            <li><strong>Rich-Text Authoring:</strong> Support for headings, <em>italic</em>, <u>underline</u>, bold text, and nested lists.</li>
            <li><strong>File Workflows:</strong> Import <code>.txt</code>, <code>.md</code>, or <code>.docx</code> files directly into editable documents, or attach supporting reference files.</li>
            <li><strong>Role-Based Sharing:</strong> Share documents with teammates as <em>Editor</em> or <em>Viewer</em> with server-enforced access rules.</li>
          </ul>
          <h2>Next Steps for Reviewers</h2>
          <ol>
            <li>Edit this document as Alice, or open the <strong>Share</strong> modal to inspect collaborator roles.</li>
            <li>Switch to <strong>Bob Patel</strong> (Editor) to verify shared editing access, or <strong>Carol Diaz</strong> (Viewer) to confirm read-only enforcement.</li>
            <li>Use <strong>Import File</strong> on the dashboard or <strong>Attach File</strong> inside the right-side panel.</li>
          </ol>
        `.trim(),
        shares: [
          { email: 'bob@ajaia.dev', role: 'editor' },
          { email: 'carol@ajaia.dev', role: 'viewer' },
        ],
      },
      {
        title: 'Weekly Team Sync Notes (Private Draft)',
        contentHtml: `
          <h2>Weekly Sync Agenda</h2>
          <p>This document is <u>private to Alice</u> by default. Click <strong>Share</strong> in the top bar to grant Bob or Carol access.</p>
          <ul>
            <li>Review milestone scope and deliberate tradeoffs</li>
            <li>Verify Firestore persistence across full page refreshes</li>
            <li>Record 3–5 minute product walkthrough</li>
          </ul>
        `.trim(),
        shares: [],
      },
    ];
  }

  if (normalized === 'bob@ajaia.dev') {
    return [
      {
        title: 'Engineering Architecture & Security Notes',
        contentHtml: `
          <h1>Engineering Architecture &amp; Security Notes</h1>
          <p>Owned by <strong>Bob Patel</strong> and shared with Alice in <em>Viewer</em> mode.</p>
          <h2>Key Tradeoffs</h2>
          <ul>
            <li>TipTap (ProseMirror) over raw <code>contentEditable</code> for predictable serialization and cross-browser editing.</li>
            <li>Firestore Security Rules enforce owner/editor/viewer permissions on every read, write, and attachment operation.</li>
          </ul>
        `.trim(),
        shares: [{ email: 'alice@ajaia.dev', role: 'viewer' }],
      },
    ];
  }

  return [
    {
      title: 'Getting Started with Ajaia Docs',
      contentHtml: `
        <h1>Welcome to Ajaia Docs</h1>
        <p>Start typing here, format with the toolbar above, or attach supporting files in the panel on the right.</p>
        <ul>
          <li>Use headings (<strong>H1</strong>, <strong>H2</strong>, <strong>H3</strong>) to structure specs</li>
          <li>Share with <code>alice@ajaia.dev</code> or <code>bob@ajaia.dev</code> to test collaboration</li>
        </ul>
      `.trim(),
      shares: [],
    },
  ];
}
