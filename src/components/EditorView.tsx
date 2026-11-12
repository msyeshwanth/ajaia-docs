import { useCallback, useEffect, useRef, useState } from 'react';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  ArrowLeft,
  Bold,
  Check,
  Code,
  Italic,
  List,
  ListOrdered,
  Paperclip,
  Quote,
  Redo2,
  RemoveFormatting,
  Save,
  Share2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react';
import { canUserEditDoc, getUserRoleForDoc } from '../lib/permissions';
import {
  subscribeAttachments,
  subscribeDocument,
  updateDocumentContent,
} from '../lib/repository';
import { validateDocumentTitle } from '../lib/validation';
import type { AppUser, AttachmentRecord, DocRecord } from '../types/document';
import { AccountSwitcher } from './AccountSwitcher';
import { AttachmentsPanel } from './AttachmentsPanel';
import { ShareModal } from './ShareModal';

interface EditorViewProps {
  docId: string;
  currentUser: AppUser;
  onBack: () => void;
}

type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

function parseTipTapInitialContent(doc: DocRecord): string | Record<string, unknown> {
  if (doc.contentJson) {
    try {
      return JSON.parse(doc.contentJson) as Record<string, unknown>;
    } catch {
      // Fall back to sanitized HTML if JSON cannot be parsed.
    }
  }
  return doc.contentHtml || '<p></p>';
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function EditorView({ docId, currentUser, onBack }: EditorViewProps) {
  const [docRecord, setDocRecord] = useState<DocRecord | null>(null);
  const [attachments, setAttachments] = useState<AttachmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [titleDraft, setTitleDraft] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [remoteUpdatePending, setRemoteUpdatePending] = useState(false);

  const [showShareModal, setShowShareModal] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [wordCount, setWordCount] = useState(0);

  const initializedDocIdRef = useRef<string | null>(null);
  const lastAppliedUpdatedAtRef = useRef<string>('');
  const isDirtyRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const canEditRef = useRef(false);
  const titleDraftRef = useRef('');
  const persistRef = useRef<(explicitTitle?: string) => Promise<void>>(async () => {});

  const role = docRecord ? getUserRoleForDoc(docRecord, currentUser) : 'none';
  const canEdit = docRecord ? canUserEditDoc(docRecord, currentUser) : false;
  canEditRef.current = canEdit;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Placeholder.configure({
        placeholder: 'Start writing your document… (Use # for headings or toolbar controls above)',
      }),
    ],
    content: '<p></p>',
    editable: canEdit,
    onUpdate: ({ editor: ed }) => {
      setWordCount(countWords(ed.getText()));
      if (!canEditRef.current) return;
      isDirtyRef.current = true;
      setSaveStatus('unsaved');
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        void persistRef.current();
      }, 750);
    },
  });

  const persistEditorChanges = useCallback(
    async (explicitTitle?: string) => {
      if (!editor || !docRecord || !canEdit) return;
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      const nextTitle = explicitTitle ?? titleDraftRef.current;
      const titleCheck = validateDocumentTitle(nextTitle);
      if (!titleCheck.valid) {
        setSaveStatus('error');
        setSaveError(titleCheck.error ?? 'Invalid title.');
        return;
      }

      setSaveStatus('saving');
      setSaveError(null);
      try {
        await updateDocumentContent(docRecord.id, currentUser, {
          title: titleCheck.trimmed,
          contentHtml: editor.getHTML(),
          contentJson: JSON.stringify(editor.getJSON()),
        });
        isDirtyRef.current = false;
        setRemoteUpdatePending(false);
        setSaveStatus('saved');
      } catch (err) {
        setSaveStatus('error');
        setSaveError(err instanceof Error ? err.message : 'Failed to save changes.');
      }
    },
    [canEdit, currentUser, docRecord, editor],
  );
  persistRef.current = persistEditorChanges;

  // Keep TipTap editability synced with permissions.
  useEffect(() => {
    if (editor) {
      editor.setEditable(canEdit);
    }
  }, [canEdit, editor]);

  // Subscribe to live document record.
  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    initializedDocIdRef.current = null;
    lastAppliedUpdatedAtRef.current = '';
    isDirtyRef.current = false;

    const unsub = subscribeDocument(
      docId,
      currentUser,
      (incoming) => {
        setLoading(false);
        if (!incoming) {
          setDocRecord(null);
          setLoadError('Document was deleted or cannot be accessed by your current account.');
          return;
        }
        setDocRecord(incoming);
      },
      (errMsg) => {
        setLoading(false);
        setLoadError(errMsg);
      },
    );

    return () => {
      unsub();
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [currentUser, docId]);

  // Subscribe to document attachments.
  useEffect(() => {
    const unsub = subscribeAttachments(
      docId,
      (items) => setAttachments(items),
      () => {
        // Attachment subscription error will show if user tries opening drawer.
      },
    );
    return () => unsub();
  }, [docId]);

  // Sync incoming document snapshot into TipTap safely without overwriting unsaved typing.
  useEffect(() => {
    if (!docRecord || !editor) return;

    const isFirstLoadForDoc = initializedDocIdRef.current !== docRecord.id;
    const isNewRemoteVersion = docRecord.updatedAt !== lastAppliedUpdatedAtRef.current;

    if (isFirstLoadForDoc) {
      initializedDocIdRef.current = docRecord.id;
      lastAppliedUpdatedAtRef.current = docRecord.updatedAt;
      titleDraftRef.current = docRecord.title;
      setTitleDraft(docRecord.title);
      editor.commands.setContent(parseTipTapInitialContent(docRecord), false);
      setWordCount(countWords(editor.getText()));
      setSaveStatus('saved');
      setRemoteUpdatePending(false);
      return;
    }

    if (isNewRemoteVersion) {
      const matchesEditor =
        docRecord.contentHtml === editor.getHTML() && docRecord.title === titleDraftRef.current;

      if (matchesEditor) {
        lastAppliedUpdatedAtRef.current = docRecord.updatedAt;
        setRemoteUpdatePending(false);
        return;
      }

      if (!isDirtyRef.current) {
        lastAppliedUpdatedAtRef.current = docRecord.updatedAt;
        titleDraftRef.current = docRecord.title;
        setTitleDraft(docRecord.title);
        editor.commands.setContent(parseTipTapInitialContent(docRecord), false);
        setWordCount(countWords(editor.getText()));
        setRemoteUpdatePending(false);
      } else if (docRecord.lastEditedByEmail !== currentUser.email) {
        setRemoteUpdatePending(true);
      }
    }
  }, [currentUser.email, docRecord, editor]);

  // Ctrl+S manual save shortcut.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void persistRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleReloadRemote = () => {
    if (!docRecord || !editor) return;
    isDirtyRef.current = false;
    lastAppliedUpdatedAtRef.current = docRecord.updatedAt;
    titleDraftRef.current = docRecord.title;
    setTitleDraft(docRecord.title);
    editor.commands.setContent(parseTipTapInitialContent(docRecord), false);
    setWordCount(countWords(editor.getText()));
    setRemoteUpdatePending(false);
    setSaveStatus('saved');
  };

  const handleTitleChange = (next: string) => {
    titleDraftRef.current = next;
    setTitleDraft(next);
    if (!canEdit) return;
    isDirtyRef.current = true;
    setSaveStatus('unsaved');
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      void persistRef.current(next);
    }, 750);
  };

  const activeHeadingValue = editor?.isActive('heading', { level: 1 })
    ? 'h1'
    : editor?.isActive('heading', { level: 2 })
      ? 'h2'
      : editor?.isActive('heading', { level: 3 })
        ? 'h3'
        : 'p';

  const handleHeadingChange = (value: string) => {
    if (!editor || !canEdit) return;
    const chain = editor.chain().focus();
    if (value === 'p') chain.setParagraph().run();
    if (value === 'h1') chain.toggleHeading({ level: 1 }).run();
    if (value === 'h2') chain.toggleHeading({ level: 2 }).run();
    if (value === 'h3') chain.toggleHeading({ level: 3 }).run();
  };

  if (loading) {
    return <div className="empty-state">Opening document…</div>;
  }

  if (loadError || !docRecord) {
    return (
      <div className="editor-error-shell">
        <div className="error-banner" role="alert">
          {loadError ?? 'Document unavailable.'}
        </div>
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={15} />
          <span>Back to Workspace</span>
        </button>
      </div>
    );
  }

  return (
    <div className="editor-shell">
      <header className="editor-topbar">
        <div className="editor-topbar-left">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={async () => {
              if (isDirtyRef.current && canEdit) {
                await persistEditorChanges();
              }
              onBack();
            }}
          >
            <ArrowLeft size={15} />
            <span>Docs</span>
          </button>

          <input
            type="text"
            className="title-input"
            value={titleDraft}
            disabled={!canEdit}
            onChange={(e) => handleTitleChange(e.target.value)}
            onBlur={() => {
              if (isDirtyRef.current && canEdit) {
                void persistEditorChanges();
              }
            }}
            aria-label="Document title"
            maxLength={160}
          />

          <span className={`role-badge role-${role}`}>
            {role === 'owner' ? 'Owner' : role === 'editor' ? 'Editor' : 'Viewer (Read-only)'}
          </span>
        </div>

        <div className="editor-topbar-right">
          {canEdit && (
            <span className={`save-pill ${saveStatus}`} aria-live="polite">
              {saveStatus === 'saved' && (
                <>
                  <Check size={13} /> Saved
                </>
              )}
              {saveStatus === 'saving' && 'Saving…'}
              {saveStatus === 'unsaved' && 'Unsaved changes'}
              {saveStatus === 'error' && 'Save error'}
            </span>
          )}

          {canEdit && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void persistEditorChanges()}
              disabled={saveStatus === 'saving'}
            >
              <Save size={14} />
              <span>Save</span>
            </button>
          )}

          <button
            type="button"
            className={`btn btn-secondary btn-sm ${showAttachments ? 'active-btn' : ''}`}
            onClick={() => setShowAttachments((v) => !v)}
          >
            <Paperclip size={14} />
            <span>Attachments ({attachments.length})</span>
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowShareModal(true)}
          >
            <Share2 size={14} />
            <span>{role === 'owner' ? 'Share' : 'Collaborators'}</span>
          </button>

          <AccountSwitcher currentUser={currentUser} />
        </div>
      </header>

      <div className="format-toolbar" role="toolbar" aria-label="Formatting options">
        <select
          className="toolbar-select"
          value={activeHeadingValue}
          disabled={!canEdit || !editor}
          onChange={(e) => handleHeadingChange(e.target.value)}
          aria-label="Text style"
        >
          <option value="p">Normal text</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>

        <span className="toolbar-divider" />

        <button
          type="button"
          className={`toolbar-btn ${editor?.isActive('bold') ? 'active' : ''}`}
          disabled={!canEdit || !editor}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          title="Bold (Ctrl+B)"
          aria-label="Bold"
        >
          <Bold size={15} />
        </button>
        <button
          type="button"
          className={`toolbar-btn ${editor?.isActive('italic') ? 'active' : ''}`}
          disabled={!canEdit || !editor}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          title="Italic (Ctrl+I)"
          aria-label="Italic"
        >
          <Italic size={15} />
        </button>
        <button
          type="button"
          className={`toolbar-btn ${editor?.isActive('underline') ? 'active' : ''}`}
          disabled={!canEdit || !editor}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
          title="Underline (Ctrl+U)"
          aria-label="Underline"
        >
          <UnderlineIcon size={15} />
        </button>
        <button
          type="button"
          className={`toolbar-btn ${editor?.isActive('strike') ? 'active' : ''}`}
          disabled={!canEdit || !editor}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
          title="Strikethrough"
          aria-label="Strikethrough"
        >
          <Strikethrough size={15} />
        </button>
        <button
          type="button"
          className={`toolbar-btn ${editor?.isActive('code') ? 'active' : ''}`}
          disabled={!canEdit || !editor}
          onClick={() => editor?.chain().focus().toggleCode().run()}
          title="Inline code"
          aria-label="Inline code"
        >
          <Code size={15} />
        </button>

        <span className="toolbar-divider" />

        <button
          type="button"
          className={`toolbar-btn ${editor?.isActive('bulletList') ? 'active' : ''}`}
          disabled={!canEdit || !editor}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          title="Bulleted list"
          aria-label="Bulleted list"
        >
          <List size={15} />
        </button>
        <button
          type="button"
          className={`toolbar-btn ${editor?.isActive('orderedList') ? 'active' : ''}`}
          disabled={!canEdit || !editor}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          title="Numbered list"
          aria-label="Numbered list"
        >
          <ListOrdered size={15} />
        </button>
        <button
          type="button"
          className={`toolbar-btn ${editor?.isActive('blockquote') ? 'active' : ''}`}
          disabled={!canEdit || !editor}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          title="Quote"
          aria-label="Quote"
        >
          <Quote size={15} />
        </button>

        <span className="toolbar-divider" />

        <button
          type="button"
          className="toolbar-btn"
          disabled={!canEdit || !editor?.can().undo()}
          onClick={() => editor?.chain().focus().undo().run()}
          title="Undo"
          aria-label="Undo"
        >
          <Undo2 size={15} />
        </button>
        <button
          type="button"
          className="toolbar-btn"
          disabled={!canEdit || !editor?.can().redo()}
          onClick={() => editor?.chain().focus().redo().run()}
          title="Redo"
          aria-label="Redo"
        >
          <Redo2 size={15} />
        </button>
        <button
          type="button"
          className="toolbar-btn"
          disabled={!canEdit || !editor}
          onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}
          title="Clear formatting"
          aria-label="Clear formatting"
        >
          <RemoveFormatting size={15} />
        </button>

        <div className="toolbar-spacer" />
        <span className="word-counter">{wordCount} words</span>
      </div>

      {saveError && (
        <div className="editor-alert-strip error" role="alert">
          {saveError}
        </div>
      )}

      {!canEdit && (
        <div className="editor-alert-strip info">
          <span>
            You have <strong>Viewer</strong> access to this document (owned by {docRecord.ownerName}
            ). Editing is disabled.
          </span>
        </div>
      )}

      {remoteUpdatePending && (
        <div className="editor-alert-strip warn">
          <span>
            Another collaborator ({docRecord.lastEditedByEmail}) saved newer changes while you were
            typing.
          </span>
          <button type="button" className="btn btn-secondary btn-xs" onClick={handleReloadRemote}>
            Reload Latest
          </button>
        </div>
      )}

      <div className="editor-workspace">
        <div className="editor-scroll">
          <div className="document-sheet">
            <EditorContent editor={editor} />
          </div>
        </div>

        {showAttachments && (
          <AttachmentsPanel
            docId={docRecord.id}
            attachments={attachments}
            currentUser={currentUser}
            canEdit={canEdit}
            onClose={() => setShowAttachments(false)}
          />
        )}
      </div>

      {showShareModal && (
        <ShareModal
          doc={docRecord}
          currentUser={currentUser}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}
