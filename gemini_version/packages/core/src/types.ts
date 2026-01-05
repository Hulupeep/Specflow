export type SourceType = "chatgpt" | "web" | "other";

export interface CaptureMetadata {
  source: SourceType;
  capturedAt: string; // ISO Date
  url?: string;
  pageTitle?: string;
  tags: string[];
  topic?: string;
}

export interface MarkdownNote {
  filename: string;
  content: string; // Full content including frontmatter
}