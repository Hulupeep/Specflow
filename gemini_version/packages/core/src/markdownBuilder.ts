import { CaptureMetadata, MarkdownNote } from './types';

export class MarkdownBuilder {
  static build(metadata: CaptureMetadata, body: string): MarkdownNote {
    // Contract DATA-001: Must use valid frontmatter
    const frontmatter = [
      '---',
      `source: ${metadata.source}`,
      `captured_at: ${metadata.capturedAt}`,
      `url: "${metadata.url || ''}"`,
      `page_title: "${metadata.pageTitle || ''}"`,
      `topic: "${metadata.topic || ''}"`,
      'tags:',
      ...metadata.tags.map(t => `  - ${t}`),
      '---'
    ].join('\n');

    const content = `${frontmatter}\n\n${body}`;
    
    // Simple slugification for filename
    const slug = (metadata.topic || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const filename = `${slug}.md`;

    return { filename, content };
  }
}