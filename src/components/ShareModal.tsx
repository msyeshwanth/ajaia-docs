import { useState, type FormEvent } from 'react';
import { Shield, Trash2, UserPlus, X } from 'lucide-react';
import { DEMO_ACCOUNTS } from '../lib/demoAccounts';
import { removeShareEntry, upsertShareEntry } from '../lib/permissions';
import { updateDocumentSharing } from '../lib/repository';
import { normalizeEmail } from '../lib/validation';
import type { AppUser, DocRecord, ShareRole } from '../types/document';

interface ShareModalProps {
  doc: DocRecord;
  currentUser: AppUser;
  onClose: () => void;
}

export function ShareModal({ doc, currentUser, onClose }: ShareModalProps) {
  const [emailInput, setEmailInput] = useState('');
  const [role, setRole] = useState<ShareRole>('editor');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = doc.ownerUid === currentUser.uid;
  const quickSuggestions = DEMO_ACCOUNTS.filter(
    (demo) =>
      normalizeEmail(demo.email) !== normalizeEmail(doc.ownerEmail) &&
      !doc.sharedEmails.includes(normalizeEmail(demo.email)),
  );

  const handleGrant = async (e: FormEvent) => {
    e.preventDefault();
    if (!isOwner) return;
    setError(null);

    const result = upsertShareEntry(doc, emailInput, role);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setBusy(true);
    try {
      await updateDocumentSharing(doc.id, currentUser, result.next);
      setEmailInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update sharing.');
    } finally {
      setBusy(false);
    }
  };

  const handleRoleChange = async (targetEmail: string, nextRole: ShareRole) => {
    if (!isOwner) return;
    setError(null);
    const result = upsertShareEntry(doc, targetEmail, nextRole);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBusy(true);
    try {
      await updateDocumentSharing(doc.id, currentUser, result.next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change role.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (targetEmail: string) => {
    if (!isOwner) return;
    setError(null);
    setBusy(true);
    try {
      const next = removeShareEntry(doc, targetEmail);
      await updateDocumentSharing(doc.id, currentUser, next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove collaborator.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="share-modal-title">
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <h2 id="share-modal-title">Share “{doc.title}”</h2>
            <p className="modal-subtitle">
              Grant teammate access. Enforced in both UI and Firestore Security Rules.
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {isOwner ? (
          <form onSubmit={handleGrant} className="share-form">
            <div className="share-input-row">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="teammate@ajaia.dev"
                aria-label="Collaborator email"
                disabled={busy}
                required
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as ShareRole)}
                aria-label="Permission role"
                disabled={busy}
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                <UserPlus size={15} />
                <span>Share</span>
              </button>
            </div>

            {quickSuggestions.length > 0 && (
              <div className="quick-chips">
                <span className="quick-chips-label">Quick add:</span>
                {quickSuggestions.map((demo) => (
                  <button
                    key={demo.id}
                    type="button"
                    className="chip-btn"
                    onClick={() => setEmailInput(demo.email)}
                  >
                    + {demo.name} ({demo.email})
                  </button>
                ))}
              </div>
            )}
          </form>
        ) : (
          <div className="info-banner">
            <Shield size={15} />
            <span>Only the owner ({doc.ownerEmail}) can modify sharing permissions.</span>
          </div>
        )}

        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}

        <div className="collaborator-list">
          <h3>People with access</h3>

          <div className="collaborator-row">
            <div>
              <strong>{doc.ownerName}</strong>
              <span className="muted-email">{doc.ownerEmail}</span>
            </div>
            <span className="role-badge role-owner">Owner</span>
          </div>

          {doc.sharedEntries.length === 0 ? (
            <p className="empty-inline">Not shared with anyone yet. Only you can access this doc.</p>
          ) : (
            doc.sharedEntries.map((entry) => (
              <div key={entry.email} className="collaborator-row">
                <div>
                  <strong>{entry.email}</strong>
                  <span className="muted-email">
                    {entry.role === 'editor' ? 'Can edit content & attachments' : 'Read-only viewer'}
                  </span>
                </div>
                <div className="collaborator-actions">
                  {isOwner ? (
                    <>
                      <select
                        value={entry.role}
                        onChange={(e) => handleRoleChange(entry.email, e.target.value as ShareRole)}
                        disabled={busy}
                        aria-label={`Role for ${entry.email}`}
                      >
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button
                        type="button"
                        className="icon-btn danger"
                        onClick={() => handleRemove(entry.email)}
                        disabled={busy}
                        aria-label={`Revoke access for ${entry.email}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  ) : (
                    <span className={`role-badge role-${entry.role}`}>{entry.role}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
