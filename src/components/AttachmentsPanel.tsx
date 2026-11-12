import { useRef, useState } from 'react';
import { Download, Eye, Paperclip, Trash2, Upload, X } from 'lucide-react';
import { decodeBase64Text, downloadBase64File } from '../lib/fileImport';
import { addAttachment, deleteAttachment } from '../lib/repository';
import {
  formatBytes,
  MAX_ATTACHMENTS_PER_DOC,
  SUPPORTED_ATTACHMENT_EXTENSIONS,
} from '../lib/validation';
import type { AppUser, AttachmentRecord } from '../types/document';

interface AttachmentsPanelProps {
  docId: string;
  attachments: AttachmentRecord[];
  currentUser: AppUser;
  canEdit: boolean;
  onClose: () => void;
}

export function AttachmentsPanel({
  docId,
  attachments,
  currentUser,
  canEdit,
  onClose,
}: AttachmentsPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<AttachmentRecord | null>(null);

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      await addAttachment(docId, currentUser, file, attachments.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload attachment.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDelete = async (attachment: AttachmentRecord) => {
    setError(null);
    setBusy(true);
    try {
      await deleteAttachment(docId, attachment.id, currentUser, attachments.length - 1);
      if (previewItem?.id === attachment.id) {
        setPreviewItem(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove attachment.');
    } finally {
      setBusy(false);
    }
  };

  const isImage = (att: AttachmentRecord) => att.mimeType.startsWith('image/');
  const isText = (att: AttachmentRecord) =>
    att.mimeType.startsWith('text/') ||
    att.name.toLowerCase().endsWith('.md') ||
    att.name.toLowerCase().endsWith('.txt');

  return (
    <aside className="attachments-drawer" aria-label="Document attachments">
      <div className="drawer-header">
        <div className="drawer-title">
          <Paperclip size={16} />
          <h3>Attachments ({attachments.length})</h3>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close attachments">
          <X size={16} />
        </button>
      </div>

      <p className="drawer-hint">
        Allowed: <code>{SUPPORTED_ATTACHMENT_EXTENSIONS.join(', ')}</code> · Max 500 KB/file, up to{' '}
        {MAX_ATTACHMENTS_PER_DOC} files (Spark-tier Firestore limit).
      </p>

      {canEdit ? (
        <div className="drawer-upload">
          <input
            ref={inputRef}
            type="file"
            accept={SUPPORTED_ATTACHMENT_EXTENSIONS.join(',')}
            className="sr-only"
            onChange={(e) => handleUpload(e.target.files?.[0])}
          />
          <button
            type="button"
            className="btn btn-secondary btn-full"
            disabled={busy || attachments.length >= MAX_ATTACHMENTS_PER_DOC}
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={15} />
            <span>{busy ? 'Uploading…' : 'Attach File'}</span>
          </button>
        </div>
      ) : (
        <div className="info-banner">Viewer access: attachments are read-only.</div>
      )}

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      <div className="attachment-list">
        {attachments.length === 0 ? (
          <p className="empty-inline">No files attached to this document yet.</p>
        ) : (
          attachments.map((att) => (
            <div key={att.id} className="attachment-item">
              <div className="attachment-meta">
                <strong title={att.name}>{att.name}</strong>
                <span>
                  {formatBytes(att.sizeBytes)} · by {att.uploadedByEmail}
                </span>
              </div>
              <div className="attachment-actions">
                {(isImage(att) || isText(att)) && (
                  <button
                    type="button"
                    className="icon-btn"
                    title="Preview"
                    onClick={() => setPreviewItem(att)}
                    aria-label={`Preview ${att.name}`}
                  >
                    <Eye size={14} />
                  </button>
                )}
                <button
                  type="button"
                  className="icon-btn"
                  title="Download"
                  onClick={() => downloadBase64File(att.base64Data, att.name, att.mimeType)}
                  aria-label={`Download ${att.name}`}
                >
                  <Download size={14} />
                </button>
                {canEdit && (
                  <button
                    type="button"
                    className="icon-btn danger"
                    title="Delete attachment"
                    disabled={busy}
                    onClick={() => handleDelete(att)}
                    aria-label={`Delete ${att.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {previewItem && (
        <div className="attachment-preview">
          <div className="preview-header">
            <span>Preview: {previewItem.name}</span>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setPreviewItem(null)}
              aria-label="Close preview"
            >
              <X size={14} />
            </button>
          </div>
          {isImage(previewItem) ? (
            <img
              src={`data:${previewItem.mimeType};base64,${previewItem.base64Data}`}
              alt={previewItem.name}
            />
          ) : (
            <pre>{decodeBase64Text(previewItem.base64Data)}</pre>
          )}
        </div>
      )}
    </aside>
  );
}
