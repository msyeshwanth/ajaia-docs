import { describe, expect, it } from 'vitest';
import {
  deriveTitleFromFilename,
  markdownToSafeHtml,
  parseImportedFile,
  plainTextToSafeHtml,
} from '../fileImport';

describe('file import & sanitization', () => {
  it('derives clean titles from filenames', () => {
    expect(deriveTitleFromFilename('Q4-Launch-Plan.docx')).toBe('Q4-Launch-Plan');
    expect(deriveTitleFromFilename('notes.md')).toBe('notes');
  });

  it('converts plain text safely without injecting raw HTML', () => {
    const html = plainTextToSafeHtml('Line <1>\nLine 2\n\nSecond paragraph');
    expect(html).toBe('<p>Line &lt;1&gt;<br />Line 2</p><p>Second paragraph</p>');
  });

  it('converts markdown formatting and strips unsafe script tags', () => {
    const html = markdownToSafeHtml('# Roadmap\n\n- **Bold** item\n\n<script>alert(1)</script>');
    expect(html).toContain('<h1>Roadmap</h1>');
    expect(html).toContain('<strong>Bold</strong>');
    expect(html).not.toContain('<script>');
  });

  it('parses uploaded .md File objects and rejects unsupported extensions', async () => {
    const mdFile = new File(['## Spec\n\n1. First step'], 'Product-Spec.md', {
      type: 'text/markdown',
    });
    const result = await parseImportedFile(mdFile);
    expect(result.title).toBe('Product-Spec');
    expect(result.html).toContain('<h2>Spec</h2>');
    expect(result.html).toContain('<ol>');

    const badFile = new File(['%PDF-1.4'], 'slides.pdf', { type: 'application/pdf' });
    await expect(parseImportedFile(badFile)).rejects.toThrow(/Unsupported import type/);
  });
});
