import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AppUser, DocRecord } from '../../types/document';
import { DashboardView } from '../DashboardView';

const alice: AppUser = { uid: 'u-alice', email: 'alice@ajaia.dev', displayName: 'Alice Chen' };

const ownedDoc: DocRecord = {
  id: 'owned-1',
  title: 'Alice Owned Brief',
  contentHtml: '<p>Owned content</p>',
  contentJson: '',
  plainTextPreview: 'Owned content',
  ownerUid: alice.uid,
  ownerEmail: alice.email,
  ownerName: alice.displayName,
  sharedEmails: ['bob@ajaia.dev'],
  editorEmails: ['bob@ajaia.dev'],
  viewerEmails: [],
  sharedEntries: [{ email: 'bob@ajaia.dev', role: 'editor', addedAt: '2026-11-12T00:00:00Z' }],
  sourceType: 'blank',
  importedFileName: null,
  attachmentCount: 1,
  createdAt: '2026-11-12T00:00:00Z',
  updatedAt: '2026-11-12T00:00:00Z',
  lastEditedByEmail: alice.email,
};

const sharedDoc: DocRecord = {
  id: 'shared-1',
  title: 'Bob Architecture Notes',
  contentHtml: '<p>Shared notes</p>',
  contentJson: '',
  plainTextPreview: 'Shared notes',
  ownerUid: 'u-bob',
  ownerEmail: 'bob@ajaia.dev',
  ownerName: 'Bob Patel',
  sharedEmails: ['alice@ajaia.dev'],
  editorEmails: [],
  viewerEmails: ['alice@ajaia.dev'],
  sharedEntries: [{ email: 'alice@ajaia.dev', role: 'viewer', addedAt: '2026-11-12T00:00:00Z' }],
  sourceType: 'blank',
  importedFileName: null,
  attachmentCount: 0,
  createdAt: '2026-11-12T00:00:00Z',
  updatedAt: '2026-11-12T00:00:00Z',
  lastEditedByEmail: 'bob@ajaia.dev',
};

describe('DashboardView', () => {
  it('separates owned and shared documents and restricts owner-only actions', () => {
    render(
      <DashboardView
        currentUser={alice}
        ownedDocs={[ownedDoc]}
        sharedDocs={[sharedDoc]}
        loading={false}
        error={null}
        storageMode="firebase"
        onOpenDoc={vi.fn()}
      />,
    );

    expect(screen.getByText('Owned by me')).toBeInTheDocument();
    expect(screen.getByText('Shared with me')).toBeInTheDocument();
    expect(screen.getByText('Alice Owned Brief')).toBeInTheDocument();
    expect(screen.getByText('Bob Architecture Notes')).toBeInTheDocument();
    expect(screen.getByText('Shared · Viewer')).toBeInTheDocument();

    // Share & Delete buttons exist for owned doc, not for shared doc.
    expect(screen.getByLabelText('Share Alice Owned Brief')).toBeInTheDocument();
    expect(screen.queryByLabelText('Share Bob Architecture Notes')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Delete Bob Architecture Notes')).not.toBeInTheDocument();
  });
});
