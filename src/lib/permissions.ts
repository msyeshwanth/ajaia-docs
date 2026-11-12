import type { AccessRole, AppUser, DocRecord, ShareEntry, ShareRole } from '../types/document';
import { normalizeEmail, validateEmail } from './validation';

export function getUserRoleForDoc(doc: DocRecord, user: AppUser | null): AccessRole {
  if (!user) return 'none';
  if (doc.ownerUid === user.uid) return 'owner';

  const email = normalizeEmail(user.email);
  if (doc.editorEmails.includes(email)) return 'editor';
  if (doc.viewerEmails.includes(email)) return 'viewer';
  return 'none';
}

export function canUserEditDoc(doc: DocRecord, user: AppUser | null): boolean {
  const role = getUserRoleForDoc(doc, user);
  return role === 'owner' || role === 'editor';
}

export function canUserShareOrDeleteDoc(doc: DocRecord, user: AppUser | null): boolean {
  return getUserRoleForDoc(doc, user) === 'owner';
}

export function deriveShareArrays(entries: ShareEntry[]): {
  sharedEmails: string[];
  editorEmails: string[];
  viewerEmails: string[];
  sharedEntries: ShareEntry[];
} {
  const deduped = new Map<string, ShareEntry>();
  for (const entry of entries) {
    const email = normalizeEmail(entry.email);
    if (!email) continue;
    deduped.set(email, { ...entry, email });
  }

  const sharedEntries = Array.from(deduped.values());
  const sharedEmails = sharedEntries.map((e) => e.email);
  const editorEmails = sharedEntries.filter((e) => e.role === 'editor').map((e) => e.email);
  const viewerEmails = sharedEntries.filter((e) => e.role === 'viewer').map((e) => e.email);

  return { sharedEmails, editorEmails, viewerEmails, sharedEntries };
}

export function upsertShareEntry(
  doc: DocRecord,
  targetEmail: string,
  role: ShareRole,
  nowIso = new Date().toISOString(),
): {
  ok: true;
  next: ReturnType<typeof deriveShareArrays>;
} | {
  ok: false;
  error: string;
} {
  const emailCheck = validateEmail(targetEmail);
  if (!emailCheck.valid) {
    return { ok: false, error: emailCheck.error ?? 'Invalid email.' };
  }

  if (emailCheck.normalized === normalizeEmail(doc.ownerEmail)) {
    return { ok: false, error: 'You are already the owner of this document.' };
  }

  const nextEntries = doc.sharedEntries.filter(
    (entry) => normalizeEmail(entry.email) !== emailCheck.normalized,
  );
  nextEntries.push({
    email: emailCheck.normalized,
    role,
    addedAt: nowIso,
  });

  return { ok: true, next: deriveShareArrays(nextEntries) };
}

export function removeShareEntry(doc: DocRecord, targetEmail: string) {
  const normalized = normalizeEmail(targetEmail);
  const remaining = doc.sharedEntries.filter((entry) => normalizeEmail(entry.email) !== normalized);
  return deriveShareArrays(remaining);
}
