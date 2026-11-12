import { describe, expect, it } from 'vitest';
import {
  extractPlainTextPreview,
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_ATTACHMENTS_PER_DOC,
  MAX_IMPORT_SIZE_BYTES,
  validateAttachmentFile,
  validateDocumentTitle,
  validateEmail,
  validateImportFile,
} from '../validation';

describe('validation helpers', () => {
  it('validates and trims document titles', () => {
    expect(validateDocumentTitle('  Product Spec  ')).toEqual({
      valid: true,
      trimmed: 'Product Spec',
    });
    expect(validateDocumentTitle('   ').valid).toBe(false);
    expect(validateDocumentTitle('a'.repeat(161)).valid).toBe(false);
  });

  it('normalizes and validates collaborator emails', () => {
    expect(validateEmail('  Bob@Ajaia.DEV ')).toEqual({
      valid: true,
      normalized: 'bob@ajaia.dev',
    });
    expect(validateEmail('not-an-email').valid).toBe(false);
  });

  it('enforces supported import extensions and 5 MB limit', () => {
    expect(validateImportFile({ name: 'notes.md', size: 1200 }).valid).toBe(true);
    expect(validateImportFile({ name: 'brief.docx', size: 42000 }).valid).toBe(true);
    expect(validateImportFile({ name: 'deck.pdf', size: 1200 }).valid).toBe(false);
    expect(validateImportFile({ name: 'empty.txt', size: 0 }).valid).toBe(false);
    expect(validateImportFile({ name: 'huge.txt', size: MAX_IMPORT_SIZE_BYTES + 1 }).valid).toBe(
      false,
    );
  });

  it('enforces attachment type, 500 KB Spark-tier size cap, and max attachment count', () => {
    expect(validateAttachmentFile({ name: 'diagram.png', size: 2048 }, 0).valid).toBe(true);
    expect(
      validateAttachmentFile({ name: 'large.pdf', size: MAX_ATTACHMENT_SIZE_BYTES + 1 }, 0).valid,
    ).toBe(false);
    expect(
      validateAttachmentFile({ name: 'notes.txt', size: 512 }, MAX_ATTACHMENTS_PER_DOC).valid,
    ).toBe(false);
    expect(validateAttachmentFile({ name: 'script.exe', size: 512 }, 0).valid).toBe(false);
  });

  it('extracts readable plain-text snippets from rich HTML', () => {
    expect(extractPlainTextPreview('<h1>Launch</h1><p>Hello <strong>team</strong>!</p>')).toBe(
      'Launch Hello team !',
    );
    expect(extractPlainTextPreview('<p></p>')).toBe('Empty document');
  });
});
