import { useMemo, useState } from 'react';
import {
  FileText,
  FileUp,
  FolderOpen,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Share2,
  Trash2,
  Users,
} from 'lucide-react';
import { getUserRoleForDoc } from '../lib/permissions';
import { createDocument, deleteDocument, updateDocumentContent } from '../lib/repository';
import type { AppUser, DocRecord } from '../types/document';
import { AccountSwitcher } from './AccountSwitcher';
import { ImportModal } from './ImportModal';
import { ShareModal } from './ShareModal';

interface DashboardViewProps {
  currentUser: AppUser;
  ownedDocs: DocRecord[];
  sharedDocs: DocRecord[];
  loading: boolean;
  error: string | null;
  storageMode: 'firebase' | 'local-sandbox';
  onOpenDoc: (docId: string) => void;
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function DashboardView({
  currentUser,
  ownedDocs,
  sharedDocs,
  loading,
  error,
  storageMode,
  onOpenDoc,
}: DashboardViewProps) {
  const [filterTab, setFilterTab] = useState<'all' | 'owned' | 'shared'>('all');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [shareTarget, setShareTarget] = useState<DocRecord | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const normalizedQuery = search.trim().toLowerCase();

  const filteredOwned = useMemo(() => {
    if (!normalizedQuery) return ownedDocs;
    return ownedDocs.filter(
      (d) =>
        d.title.toLowerCase().includes(normalizedQuery) ||
        d.plainTextPreview.toLowerCase().includes(normalizedQuery),
    );
  }, [ownedDocs, normalizedQuery]);

  const filteredShared = useMemo(() => {
    if (!normalizedQuery) return sharedDocs;
    return sharedDocs.filter(
      (d) =>
        d.title.toLowerCase().includes(normalizedQuery) ||
        d.ownerName.toLowerCase().includes(normalizedQuery) ||
        d.ownerEmail.toLowerCase().includes(normalizedQuery) ||
        d.plainTextPreview.toLowerCase().includes(normalizedQuery),
    );
  }, [sharedDocs, normalizedQuery]);

  const handleCreateBlank = async () => {
    setActionError(null);
    setCreating(true);
    try {
      const created = await createDocument(currentUser, {
        title: 'Untitled Document',
        contentHtml: '<p></p>',
        sourceType: 'blank',
      });
      onOpenDoc(created.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create document.');
    } finally {
      setCreating(false);
    }
  };

  const handleStartRename = (doc: DocRecord) => {
    setRenamingId(doc.id);
    setRenameDraft(doc.title);
    setActionError(null);
  };

  const handleSaveRename = async (docId: string) => {
    setActionError(null);
    try {
      await updateDocumentContent(docId, currentUser, { title: renameDraft });
      setRenamingId(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to rename document.');
    }
  };

  const handleDelete = async (doc: DocRecord) => {
    if (!window.confirm(`Delete “${doc.title}”? This cannot be undone.`)) return;
    setActionError(null);
    try {
      await deleteDocument(doc.id, currentUser);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete document.');
    }
  };

  const renderDocCard = (doc: DocRecord, kind: 'owned' | 'shared') => {
    const role = getUserRoleForDoc(doc, currentUser);
    const isRenaming = renamingId === doc.id;

    return (
      <article key={doc.id} className="doc-card">
        <div className="doc-card-top">
          <div className="doc-icon-wrap">
            <FileText size={18} />
          </div>
          <div className="doc-card-badges">
            {kind === 'owned' ? (
              <span className="role-badge role-owner">Owned</span>
            ) : (
              <span className={`role-badge role-${role}`}>
                Shared · {role === 'editor' ? 'Editor' : 'Viewer'}
              </span>
            )}
            {doc.sourceType === 'import' && <span className="meta-pill">Imported</span>}
          </div>
        </div>

        {isRenaming ? (
          <div className="inline-rename-row">
            <input
              type="text"
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveRename(doc.id);
                if (e.key === 'Escape') setRenamingId(null);
              }}
              aria-label="New document title"
              autoFocus
            />
            <button
              type="button"
              className="btn btn-primary btn-xs"
              onClick={() => handleSaveRename(doc.id)}
            >
              Save
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => setRenamingId(null)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <h3 className="doc-card-title" onClick={() => onOpenDoc(doc.id)}>
            {doc.title}
          </h3>
        )}

        <p className="doc-card-preview">{doc.plainTextPreview}</p>

        <div className="doc-card-meta">
          <span>
            {kind === 'owned'
              ? doc.sharedEmails.length > 0
                ? `Shared with ${doc.sharedEmails.length}`
                : 'Private'
              : `Owner: ${doc.ownerName}`}
          </span>
          <span>·</span>
          <span>Updated {formatRelativeDate(doc.updatedAt)}</span>
          {doc.attachmentCount > 0 && (
            <>
              <span>·</span>
              <span className="inline-icon-meta">
                <Paperclip size={12} /> {doc.attachmentCount}
              </span>
            </>
          )}
        </div>

        <div className="doc-card-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onOpenDoc(doc.id)}
          >
            <FolderOpen size={14} />
            <span>Open</span>
          </button>

          {kind === 'owned' && (
            <>
              <button
                type="button"
                className="icon-btn"
                title="Share document"
                aria-label={`Share ${doc.title}`}
                onClick={() => setShareTarget(doc)}
              >
                <Share2 size={15} />
              </button>
              <button
                type="button"
                className="icon-btn"
                title="Rename document"
                aria-label={`Rename ${doc.title}`}
                onClick={() => handleStartRename(doc)}
              >
                <Pencil size={15} />
              </button>
              <button
                type="button"
                className="icon-btn danger"
                title="Delete document"
                aria-label={`Delete ${doc.title}`}
                onClick={() => handleDelete(doc)}
              >
                <Trash2 size={15} />
              </button>
            </>
          )}
        </div>
      </article>
    );
  };

  const liveShareTarget = shareTarget
    ? ownedDocs.find((d) => d.id === shareTarget.id) ?? shareTarget
    : null;

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="top-bar-left">
          <div className="brand-mark">
            <FileText size={19} />
            <span>Ajaia Docs</span>
          </div>
          <span className={`storage-pill ${storageMode}`}>
            {storageMode === 'firebase' ? 'Cloud Firestore' : 'Local Sandbox'}
          </span>
        </div>

        <AccountSwitcher currentUser={currentUser} />
      </header>

      <main className="dashboard-main">
        <div className="dashboard-toolbar">
          <div>
            <h1>Workspace Documents</h1>
            <p className="dashboard-subtitle">
              Create rich documents, import <code>.txt</code> / <code>.md</code> / <code>.docx</code>
              , and collaborate across owned and shared files.
            </p>
          </div>
          <div className="dashboard-cta-group">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowImport(true)}
            >
              <FileUp size={16} />
              <span>Import File</span>
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={creating}
              onClick={handleCreateBlank}
            >
              <Plus size={16} />
              <span>{creating ? 'Creating…' : 'New Document'}</span>
            </button>
          </div>
        </div>

        <div className="filter-bar">
          <div className="filter-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={filterTab === 'all'}
              className={filterTab === 'all' ? 'active' : ''}
              onClick={() => setFilterTab('all')}
            >
              All ({ownedDocs.length + sharedDocs.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filterTab === 'owned'}
              className={filterTab === 'owned' ? 'active' : ''}
              onClick={() => setFilterTab('owned')}
            >
              Owned by me ({ownedDocs.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filterTab === 'shared'}
              className={filterTab === 'shared' ? 'active' : ''}
              onClick={() => setFilterTab('shared')}
            >
              Shared with me ({sharedDocs.length})
            </button>
          </div>

          <div className="search-box">
            <Search size={15} />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by title, content, or owner…"
              aria-label="Filter documents"
            />
          </div>
        </div>

        {(error || actionError) && (
          <div className="error-banner" role="alert">
            {error ?? actionError}
          </div>
        )}

        {loading ? (
          <div className="empty-state">Loading workspace documents…</div>
        ) : (
          <>
            {(filterTab === 'all' || filterTab === 'owned') && (
              <section className="doc-section">
                <div className="section-heading">
                  <h2>Owned by me</h2>
                  <span>{filteredOwned.length} document(s)</span>
                </div>
                {filteredOwned.length === 0 ? (
                  <div className="empty-state">
                    No owned documents match your filter. Create a blank document or import a{' '}
                    <code>.txt</code>, <code>.md</code>, or <code>.docx</code> file.
                  </div>
                ) : (
                  <div className="doc-grid">
                    {filteredOwned.map((doc) => renderDocCard(doc, 'owned'))}
                  </div>
                )}
              </section>
            )}

            {(filterTab === 'all' || filterTab === 'shared') && (
              <section className="doc-section">
                <div className="section-heading">
                  <h2>
                    <Users size={17} /> Shared with me
                  </h2>
                  <span>{filteredShared.length} document(s)</span>
                </div>
                {filteredShared.length === 0 ? (
                  <div className="empty-state">
                    No documents have been shared with <strong>{currentUser.email}</strong> yet.
                    Switch demo accounts in the top-right menu to share a document with yourself.
                  </div>
                ) : (
                  <div className="doc-grid">
                    {filteredShared.map((doc) => renderDocCard(doc, 'shared'))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>

      {showImport && (
        <ImportModal
          currentUser={currentUser}
          onClose={() => setShowImport(false)}
          onImported={(created) => {
            setShowImport(false);
            onOpenDoc(created.id);
          }}
        />
      )}

      {liveShareTarget && (
        <ShareModal
          doc={liveShareTarget}
          currentUser={currentUser}
          onClose={() => setShareTarget(null)}
        />
      )}
    </div>
  );
}
