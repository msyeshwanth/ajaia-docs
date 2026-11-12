import { describe, expect, it } from 'vitest';
import type { AppUser, DocRecord } from '../../types/document';
import {
  canUserEditDoc,
  canUserShareOrDeleteDoc,
  getUserRoleForDoc,
  removeShareEntry,
  upsertShareEntry,
} from '../permissions';

const alice: AppUser = { uid: 'u-alice', email: 'alice@ajaia.dev', displayName: 'Alice' };
const bob: AppUser = { uid: 'u-bob', email: 'bob@ajaia.dev', displayName: 'Bob' };
const carol: AppUser = { uid: 'u-carol', email: 'carol@ajaia.dev', displayName: 'Carol' };
const outsider: AppUser = { uid: 'u-dan', email: 'dan@ajaia.dev', displayName: 'Dan' };

const sampleDoc: DocRecord = {
  id: 'doc-1',
  title: 'Architecture Brief',
  contentHtml: '<p>Hello</p>',
  contentJson: '',
  plainTextPreview: 'Hello',
  ownerUid: alice.uid,
  ownerEmail: alice.email,
  ownerName: alice.displayName,
  sharedEmails: ['bob@ajaia.dev', 'carol@ajaia.dev'],
  editorEmails: ['bob@ajaia.dev'],
  viewerEmails: ['carol@ajaia.dev'],
  sharedEntries: [
    { email: 'bob@ajaia.dev', role: 'editor', addedAt: '2026-11-12T00:00:00Z' },
    { email: 'carol@ajaia.dev', role: 'viewer', addedAt: '2026-11-12T00:00:00Z' },
  ],
  sourceType: 'blank',
  importedFileName: null,
  attachmentCount: 0,
  createdAt: '2026-11-12T00:00:00Z',
  updatedAt: '2026-11-12T00:00:00Z',
  lastEditedByEmail: alice.email,
};

describe('permissions & sharing model', () => {
  it('resolves owner, editor, viewer, and unauthorized roles accurately', () => {
    expect(getUserRoleForDoc(sampleDoc, alice)).toBe('owner');
    expect(getUserRoleForDoc(sampleDoc, bob)).toBe('editor');
    expect(getUserRoleForDoc(sampleDoc, carol)).toBe('viewer');
    expect(getUserRoleForDoc(sampleDoc, outsider)).toBe('none');
  });

  it('restricts editing to owner and editors, and sharing/deletion to owner', () => {
    expect(canUserEditDoc(sampleDoc, alice)).toBe(true);
    expect(canUserEditDoc(sampleDoc, bob)).toBe(true);
    expect(canUserEditDoc(sampleDoc, carol)).toBe(false);

    expect(canUserShareOrDeleteDoc(sampleDoc, alice)).toBe(true);
    expect(canUserShareOrDeleteDoc(sampleDoc, bob)).toBe(false);
    expect(canUserShareOrDeleteDoc(sampleDoc, carol)).toBe(false);
  });

  it('prevents owner self-share and deduplicates role updates cleanly', () => {
    const selfAttempt = upsertShareEntry(sampleDoc, 'ALICE@ajaia.dev', 'editor');
    expect(selfAttempt.ok).toBe(false);

    const promoteCarol = upsertShareEntry(sampleDoc, 'Carol@ajaia.dev', 'editor');
    expect(promoteCarol.ok).toBe(true);
    if (promoteCarol.ok) {
      expect(promoteCarol.next.editorEmails).toEqual(['bob@ajaia.dev', 'carol@ajaia.dev']);
      expect(promoteCarol.next.viewerEmails).toEqual([]);
      expect(promoteCarol.next.sharedEntries).toHaveLength(2);
    }
  });

  it('removes collaborator access cleanly', () => {
    const afterRevoke = removeShareEntry(sampleDoc, 'BOB@ajaia.dev');
    expect(afterRevoke.sharedEmails).toEqual(['carol@ajaia.dev']);
    expect(afterRevoke.editorEmails).toEqual([]);
    expect(afterRevoke.viewerEmails).toEqual(['carol@ajaia.dev']);
  });
});
