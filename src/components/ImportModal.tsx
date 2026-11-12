import { useRef, useState, type DragEvent } from 'react';
import { FileUp, UploadCloud, X } from 'lucide-react';
import { parseImportedFile } from '../lib/fileImport';
import { createDocument } from '../lib/repository';
import { SUPPORTED_IMPORT_EXTENSIONS } from '../lib/validation';
import type { AppUser, DocRecord } from '../types/document';

interface ImportModalProps {
  currentUser: AppUser;
  onImported: (doc: DocRecord) => void;
  onClose: () => void;
}

export function ImportModal({ currentUser, onImported, onClose }: ImportModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const parsed = await parseImportedFile(file);
      const created = await createDocument(currentUser, {
        title: parsed.title,
        contentHtml: parsed.html,
        sourceType: 'import',
        importedFileName: parsed.sourceFileName,
      });
      onImported(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import file.');
    } finally {
      setBusy(false);
    }
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    await handleFile(file);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="import-modal-title">
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <h2 id="import-modal-title">Import File as Editable Document</h2>
            <p className="modal-subtitle">
              Supported formats: <code>{SUPPORTED_IMPORT_EXTENSIONS.join(', ')}</code> · Max 5 MB
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div
          className={`dropzone ${dragging ? 'dragging' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <UploadCloud size={32} />
          <p className="dropzone-title">
            {busy ? 'Converting and saving document…' : 'Drag and drop a file here'}
          </p>
          <p className="dropzone-hint">
            Markdown and Word headings, emphasis, and lists are converted into formatted rich text
            and sanitized before saving.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".txt,.md,.docx"
            className="sr-only"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <FileUp size={15} />
            <span>Choose File</span>
          </button>
        </div>

        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
