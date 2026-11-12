import DOMPurify from 'dompurify';
import mammoth from 'mammoth';
import { marked } from 'marked';
import { getFileExtension, validateImportFile } from './validation';

export interface ImportedDocumentResult {
  title: string;
  html: string;
  sourceFileName: string;
  warnings: string[];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function deriveTitleFromFilename(filename: string): string {
  const withoutExt = filename.replace(/\.[^/.]+$/, '').trim();
  return withoutExt || 'Imported Document';
}

export function plainTextToSafeHtml(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return '<p></p>';
  }

  const blocks = normalized.split(/\n{2,}/);
  const htmlBlocks = blocks.map((block) => {
    const lines = block.split('\n').map((line) => escapeHtml(line));
    return `<p>${lines.join('<br />')}</p>`;
  });
  return htmlBlocks.join('');
}

export function markdownToSafeHtml(markdown: string): string {
  const rendered = marked.parse(markdown, { async: false, gfm: true, breaks: true });
  return sanitizeRichHtml(typeof rendered === 'string' ? rendered : '');
}

export function sanitizeRichHtml(rawHtml: string): string {
  const clean = DOMPurify.sanitize(rawHtml, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
  }).trim();

  return clean || '<p></p>';
}

async function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file as text.'));
    reader.readAsText(file);
  });
}

async function readFileArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as binary buffer.'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file buffer.'));
    reader.readAsArrayBuffer(file);
  });
}

export async function parseImportedFile(file: File): Promise<ImportedDocumentResult> {
  const validation = validateImportFile(file);
  if (!validation.valid) {
    throw new Error(validation.error ?? 'Invalid file.');
  }

  const ext = getFileExtension(file.name);
  const title = deriveTitleFromFilename(file.name);
  const warnings: string[] = [];

  if (ext === '.txt') {
    const text = await readFileText(file);
    return {
      title,
      html: plainTextToSafeHtml(text),
      sourceFileName: file.name,
      warnings,
    };
  }

  if (ext === '.md') {
    const text = await readFileText(file);
    return {
      title,
      html: markdownToSafeHtml(text),
      sourceFileName: file.name,
      warnings,
    };
  }

  if (ext === '.docx') {
    const buffer = await readFileArrayBuffer(file);
    const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
    for (const msg of result.messages) {
      if (msg.type === 'warning') {
        warnings.push(msg.message);
      }
    }
    return {
      title,
      html: sanitizeRichHtml(result.value),
      sourceFileName: file.name,
      warnings,
    };
  }

  throw new Error(`Unsupported file extension: ${ext}`);
}

export async function fileToBase64(file: File): Promise<string> {
  const buffer = await readFileArrayBuffer(file);
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function downloadBase64File(base64Data: string, filename: string, mimeType: string): void {
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function decodeBase64Text(base64Data: string): string {
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}
