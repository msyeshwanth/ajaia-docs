export const MAX_TITLE_LENGTH = 160;
export const MAX_IMPORT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB for client-side import parsing
export const MAX_ATTACHMENT_SIZE_BYTES = 500 * 1024; // 500 KB to fit cleanly inside Firestore 1 MiB doc limit
export const MAX_ATTACHMENTS_PER_DOC = 10;

export const SUPPORTED_IMPORT_EXTENSIONS = ['.txt', '.md', '.docx'] as const;

export const SUPPORTED_ATTACHMENT_EXTENSIONS = [
  '.txt',
  '.md',
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.docx',
] as const;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): { valid: boolean; error?: string; normalized: string } {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return { valid: false, error: 'Email address is required.', normalized };
  }
  if (!EMAIL_REGEX.test(normalized)) {
    return { valid: false, error: 'Please enter a valid email address.', normalized };
  }
  return { valid: true, normalized };
}

export function validateDocumentTitle(title: string): { valid: boolean; error?: string; trimmed: string } {
  const trimmed = title.trim();
  if (!trimmed) {
    return { valid: false, error: 'Document title cannot be empty.', trimmed };
  }
  if (trimmed.length > MAX_TITLE_LENGTH) {
    return {
      valid: false,
      error: `Document title must be ${MAX_TITLE_LENGTH} characters or fewer.`,
      trimmed,
    };
  }
  return { valid: true, trimmed };
}

export function getFileExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.slice(idx).toLowerCase() : '';
}

export function validateImportFile(file: { name: string; size: number }): {
  valid: boolean;
  error?: string;
  extension: string;
} {
  const extension = getFileExtension(file.name);
  if (!(SUPPORTED_IMPORT_EXTENSIONS as readonly string[]).includes(extension)) {
    return {
      valid: false,
      error: `Unsupported import type "${extension || 'unknown'}". Supported types: ${SUPPORTED_IMPORT_EXTENSIONS.join(', ')}.`,
      extension,
    };
  }
  if (file.size <= 0) {
    return { valid: false, error: 'The selected file is empty.', extension };
  }
  if (file.size > MAX_IMPORT_SIZE_BYTES) {
    return {
      valid: false,
      error: `Import file exceeds the 5 MB limit (${formatBytes(file.size)}).`,
      extension,
    };
  }
  return { valid: true, extension };
}

export function validateAttachmentFile(
  file: { name: string; size: number },
  existingCount: number,
): { valid: boolean; error?: string; extension: string } {
  if (existingCount >= MAX_ATTACHMENTS_PER_DOC) {
    return {
      valid: false,
      error: `Maximum ${MAX_ATTACHMENTS_PER_DOC} attachments per document reached.`,
      extension: getFileExtension(file.name),
    };
  }
  const extension = getFileExtension(file.name);
  if (!(SUPPORTED_ATTACHMENT_EXTENSIONS as readonly string[]).includes(extension)) {
    return {
      valid: false,
      error: `Unsupported attachment type "${extension || 'unknown'}". Supported: ${SUPPORTED_ATTACHMENT_EXTENSIONS.join(', ')}.`,
      extension,
    };
  }
  if (file.size <= 0) {
    return { valid: false, error: 'Attachment file cannot be empty.', extension };
  }
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return {
      valid: false,
      error: `Attachment exceeds the 500 KB Spark-tier limit (${formatBytes(file.size)}).`,
      extension,
    };
  }
  return { valid: true, extension };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function extractPlainTextPreview(html: string, maxLength = 140): string {
  const stripped = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

  if (!stripped) return 'Empty document';
  if (stripped.length <= maxLength) return stripped;
  return `${stripped.slice(0, maxLength - 1).trimEnd()}…`;
}
