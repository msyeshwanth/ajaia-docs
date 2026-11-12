export type ShareRole = 'viewer' | 'editor';
export type AccessRole = 'owner' | ShareRole | 'none';

export interface ShareEntry {
  email: string;
  role: ShareRole;
  addedAt: string;
}

export interface DocRecord {
  id: string;
  title: string;
  contentHtml: string;
  contentJson: string;
  plainTextPreview: string;
  ownerUid: string;
  ownerEmail: string;
  ownerName: string;
  sharedEmails: string[];
  editorEmails: string[];
  viewerEmails: string[];
  sharedEntries: ShareEntry[];
  sourceType: 'blank' | 'import';
  importedFileName: string | null;
  attachmentCount: number;
  createdAt: string;
  updatedAt: string;
  lastEditedByEmail: string;
}

export interface AttachmentRecord {
  id: string;
  docId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  base64Data: string;
  uploadedByUid: string;
  uploadedByEmail: string;
  createdAt: string;
}

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  isDemo?: boolean;
}

export interface DemoAccount {
  id: string;
  name: string;
  roleLabel: string;
  email: string;
  password: string;
  avatarColor: string;
}
