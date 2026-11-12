import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore';
import type {
  AppUser,
  AttachmentRecord,
  DemoAccount,
  DocRecord,
  ShareEntry,
} from '../types/document';
import { DEMO_ACCOUNTS, getStarterDocsForEmail } from './demoAccounts';
import { fileToBase64 } from './fileImport';
import { firebaseAuth, firestoreDb, isFirebaseConfigured } from './firebase';
import { canUserEditDoc, canUserShareOrDeleteDoc, deriveShareArrays } from './permissions';
import {
  extractPlainTextPreview,
  normalizeEmail,
  validateAttachmentFile,
  validateDocumentTitle,
} from './validation';

export interface UserDocumentsResult {
  owned: DocRecord[];
  shared: DocRecord[];
}

export interface CreateDocumentInput {
  title: string;
  contentHtml?: string;
  contentJson?: string;
  sourceType?: 'blank' | 'import';
  importedFileName?: string | null;
  shares?: Array<{ email: string; role: 'viewer' | 'editor' }>;
}

export interface UpdateContentInput {
  title?: string;
  contentHtml?: string;
  contentJson?: string;
}

function sortByUpdatedDesc<T extends { updatedAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function mapFirebaseUser(user: FirebaseUser): AppUser {
  const email = normalizeEmail(user.email ?? '');
  const matchedDemo = DEMO_ACCOUNTS.find((d) => normalizeEmail(d.email) === email);
  return {
    uid: user.uid,
    email,
    displayName:
      user.displayName?.trim() || matchedDemo?.name || email.split('@')[0] || 'User',
    isDemo: Boolean(matchedDemo) || email.endsWith('@ajaia.dev'),
  };
}

function mapFirestoreDoc(id: string, data: DocumentData): DocRecord {
  const sharedEntries = Array.isArray(data.sharedEntries)
    ? (data.sharedEntries as ShareEntry[])
    : [];
  const derived = deriveShareArrays(sharedEntries);
  return {
    id,
    title: typeof data.title === 'string' ? data.title : 'Untitled Document',
    contentHtml: typeof data.contentHtml === 'string' ? data.contentHtml : '<p></p>',
    contentJson: typeof data.contentJson === 'string' ? data.contentJson : '',
    plainTextPreview:
      typeof data.plainTextPreview === 'string'
        ? data.plainTextPreview
        : extractPlainTextPreview(typeof data.contentHtml === 'string' ? data.contentHtml : ''),
    ownerUid: typeof data.ownerUid === 'string' ? data.ownerUid : '',
    ownerEmail: normalizeEmail(typeof data.ownerEmail === 'string' ? data.ownerEmail : ''),
    ownerName: typeof data.ownerName === 'string' ? data.ownerName : 'Owner',
    sharedEmails: Array.isArray(data.sharedEmails) ? data.sharedEmails : derived.sharedEmails,
    editorEmails: Array.isArray(data.editorEmails) ? data.editorEmails : derived.editorEmails,
    viewerEmails: Array.isArray(data.viewerEmails) ? data.viewerEmails : derived.viewerEmails,
    sharedEntries,
    sourceType: data.sourceType === 'import' ? 'import' : 'blank',
    importedFileName: typeof data.importedFileName === 'string' ? data.importedFileName : null,
    attachmentCount: typeof data.attachmentCount === 'number' ? data.attachmentCount : 0,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString(),
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
    lastEditedByEmail: normalizeEmail(
      typeof data.lastEditedByEmail === 'string' ? data.lastEditedByEmail : '',
    ),
  };
}

function mapFirestoreAttachment(docId: string, id: string, data: DocumentData): AttachmentRecord {
  return {
    id,
    docId,
    name: typeof data.name === 'string' ? data.name : 'attachment',
    mimeType: typeof data.mimeType === 'string' ? data.mimeType : 'application/octet-stream',
    sizeBytes: typeof data.sizeBytes === 'number' ? data.sizeBytes : 0,
    base64Data: typeof data.base64Data === 'string' ? data.base64Data : '',
    uploadedByUid: typeof data.uploadedByUid === 'string' ? data.uploadedByUid : '',
    uploadedByEmail: normalizeEmail(
      typeof data.uploadedByEmail === 'string' ? data.uploadedByEmail : '',
    ),
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString(),
  };
}

// ---------- Local Sandbox Fallback Store (used only when Firebase env vars are absent) ----------

interface LocalStoreShape {
  currentUser: AppUser | null;
  seededUsers: Record<string, boolean>;
  documents: DocRecord[];
  attachments: AttachmentRecord[];
}

const LOCAL_STORAGE_KEY = 'ajaia_docs_sandbox_v1';
const localBus = new EventTarget();

function readLocalStore(): LocalStoreShape {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as LocalStoreShape;
    }
  } catch {
    // Ignore storage parse error and return fresh state.
  }
  return {
    currentUser: null,
    seededUsers: {},
    documents: [],
    attachments: [],
  };
}

function writeLocalStore(next: LocalStoreShape): void {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
  localBus.dispatchEvent(new Event('change'));
}

function ensureLocalStarterDocs(user: AppUser): void {
  const store = readLocalStore();
  if (store.seededUsers[user.uid]) return;

  const now = new Date().toISOString();
  const seeds = getStarterDocsForEmail(user.email);
  const newDocs: DocRecord[] = seeds.map((seed, index) => {
    const derived = deriveShareArrays(
      seed.shares.map((s) => ({ email: s.email, role: s.role, addedAt: now })),
    );
    return {
      id: `local-${user.uid}-${Date.now()}-${index}`,
      title: seed.title,
      contentHtml: seed.contentHtml,
      contentJson: '',
      plainTextPreview: extractPlainTextPreview(seed.contentHtml),
      ownerUid: user.uid,
      ownerEmail: normalizeEmail(user.email),
      ownerName: user.displayName,
      ...derived,
      sourceType: 'blank',
      importedFileName: null,
      attachmentCount: 0,
      createdAt: now,
      updatedAt: now,
      lastEditedByEmail: normalizeEmail(user.email),
    };
  });

  store.seededUsers[user.uid] = true;
  store.documents = [...newDocs, ...store.documents];
  writeLocalStore(store);
}

// ---------- Public Repository API ----------

export function getStorageModeLabel(): 'firebase' | 'local-sandbox' {
  return isFirebaseConfigured ? 'firebase' : 'local-sandbox';
}

export function subscribeAuthState(callback: (user: AppUser | null) => void): () => void {
  if (isFirebaseConfigured && firebaseAuth) {
    return onAuthStateChanged(firebaseAuth, async (fbUser) => {
      if (!fbUser) {
        callback(null);
        return;
      }
      const mapped = mapFirebaseUser(fbUser);
      try {
        await ensureFirebaseStarterDocs(mapped);
      } catch {
        // Non-fatal if user profile seeding fails transiently.
      }
      callback(mapped);
    });
  }

  const emitLocal = () => callback(readLocalStore().currentUser);
  emitLocal();
  const handleStorage = (event: StorageEvent) => {
    if (event.key === LOCAL_STORAGE_KEY) emitLocal();
  };
  localBus.addEventListener('change', emitLocal);
  window.addEventListener('storage', handleStorage);
  return () => {
    localBus.removeEventListener('change', emitLocal);
    window.removeEventListener('storage', handleStorage);
  };
}

const seedingInFlight = new Map<string, Promise<void>>();

async function ensureFirebaseStarterDocs(user: AppUser): Promise<void> {
  if (!firestoreDb) return;
  const existingTask = seedingInFlight.get(user.uid);
  if (existingTask) {
    return existingTask;
  }

  const task = (async () => {
    if (!firestoreDb) return;
    const userRef = doc(firestoreDb, 'users', user.uid);
    const snap = await getDoc(userRef);
    if (snap.exists() && snap.data().starterSeeded === true) {
      return;
    }

    const now = new Date().toISOString();
    await setDoc(
      userRef,
      {
        uid: user.uid,
        email: normalizeEmail(user.email),
        displayName: user.displayName,
        starterSeeded: true,
        updatedAt: now,
      },
      { merge: true },
    );

    const seeds = getStarterDocsForEmail(user.email);
    for (let index = 0; index < seeds.length; index += 1) {
      const seed = seeds[index];
      const starterDocRef = doc(firestoreDb, 'documents', `starter-${user.uid}-${index}`);
      const existingDoc = await getDoc(starterDocRef);
      if (existingDoc.exists()) continue;

      const derived = deriveShareArrays(
        seed.shares.map((s) => ({ email: s.email, role: s.role, addedAt: now })),
      );
      await setDoc(starterDocRef, {
        title: seed.title,
        contentHtml: seed.contentHtml,
        contentJson: '',
        plainTextPreview: extractPlainTextPreview(seed.contentHtml),
        ownerUid: user.uid,
        ownerEmail: normalizeEmail(user.email),
        ownerName: user.displayName,
        ...derived,
        sourceType: 'blank',
        importedFileName: null,
        attachmentCount: 0,
        createdAt: now,
        updatedAt: now,
        lastEditedByEmail: normalizeEmail(user.email),
      });
    }
  })().finally(() => {
    seedingInFlight.delete(user.uid);
  });

  seedingInFlight.set(user.uid, task);
  return task;
}

export async function signInWithEmail(email: string, password: string): Promise<AppUser> {
  const normalized = normalizeEmail(email);
  if (isFirebaseConfigured && firebaseAuth) {
    const cred = await signInWithEmailAndPassword(firebaseAuth, normalized, password);
    const appUser = mapFirebaseUser(cred.user);
    await ensureFirebaseStarterDocs(appUser);
    return appUser;
  }

  const store = readLocalStore();
  const user: AppUser = {
    uid: `local-${normalized.replace(/[^a-z0-9]/g, '-')}`,
    email: normalized,
    displayName: normalized.split('@')[0],
  };
  store.currentUser = user;
  writeLocalStore(store);
  ensureLocalStarterDocs(user);
  return user;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<AppUser> {
  const normalized = normalizeEmail(email);
  const cleanName = displayName.trim() || normalized.split('@')[0];

  if (isFirebaseConfigured && firebaseAuth) {
    const cred = await createUserWithEmailAndPassword(firebaseAuth, normalized, password);
    await updateProfile(cred.user, { displayName: cleanName });
    const appUser = {
      uid: cred.user.uid,
      email: normalized,
      displayName: cleanName,
      isDemo: normalized.endsWith('@ajaia.dev'),
    };
    await ensureFirebaseStarterDocs(appUser);
    return appUser;
  }

  const store = readLocalStore();
  const user: AppUser = {
    uid: `local-${normalized.replace(/[^a-z0-9]/g, '-')}`,
    email: normalized,
    displayName: cleanName,
  };
  store.currentUser = user;
  writeLocalStore(store);
  ensureLocalStarterDocs(user);
  return user;
}

export async function signInDemoAccount(demo: DemoAccount): Promise<AppUser> {
  if (isFirebaseConfigured && firebaseAuth) {
    try {
      const cred = await signInWithEmailAndPassword(firebaseAuth, demo.email, demo.password);
      if (!cred.user.displayName) {
        await updateProfile(cred.user, { displayName: demo.name });
      }
      const appUser = {
        uid: cred.user.uid,
        email: normalizeEmail(demo.email),
        displayName: demo.name,
        isDemo: true,
      };
      await ensureFirebaseStarterDocs(appUser);
      return appUser;
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code ?? '';
      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
        const cred = await createUserWithEmailAndPassword(firebaseAuth, demo.email, demo.password);
        await updateProfile(cred.user, { displayName: demo.name });
        const appUser = {
          uid: cred.user.uid,
          email: normalizeEmail(demo.email),
          displayName: demo.name,
          isDemo: true,
        };
        await ensureFirebaseStarterDocs(appUser);
        return appUser;
      }
      throw error;
    }
  }

  const store = readLocalStore();
  const user: AppUser = {
    uid: `demo-${demo.id}`,
    email: normalizeEmail(demo.email),
    displayName: demo.name,
    isDemo: true,
  };
  store.currentUser = user;
  writeLocalStore(store);
  ensureLocalStarterDocs(user);
  return user;
}

export async function signOutUser(): Promise<void> {
  if (isFirebaseConfigured && firebaseAuth) {
    await signOut(firebaseAuth);
    return;
  }
  const store = readLocalStore();
  store.currentUser = null;
  writeLocalStore(store);
}

export function subscribeUserDocuments(
  user: AppUser,
  onUpdate: (data: UserDocumentsResult) => void,
  onError: (message: string) => void,
): () => void {
  if (isFirebaseConfigured && firestoreDb) {
    let owned: DocRecord[] = [];
    let shared: DocRecord[] = [];

    const emit = () => {
      onUpdate({
        owned: sortByUpdatedDesc(owned),
        shared: sortByUpdatedDesc(shared.filter((d) => d.ownerUid !== user.uid)),
      });
    };

    const ownedQ = query(
      collection(firestoreDb, 'documents'),
      where('ownerUid', '==', user.uid),
    );
    const sharedQ = query(
      collection(firestoreDb, 'documents'),
      where('sharedEmails', 'array-contains', normalizeEmail(user.email)),
    );

    const unsubOwned = onSnapshot(
      ownedQ,
      (snap) => {
        owned = snap.docs.map((d) => mapFirestoreDoc(d.id, d.data()));
        emit();
      },
      (err) => onError(err.message),
    );

    const unsubShared = onSnapshot(
      sharedQ,
      (snap) => {
        shared = snap.docs.map((d) => mapFirestoreDoc(d.id, d.data()));
        emit();
      },
      (err) => onError(err.message),
    );

    return () => {
      unsubOwned();
      unsubShared();
    };
  }

  const emitLocal = () => {
    const store = readLocalStore();
    const email = normalizeEmail(user.email);
    const owned = store.documents.filter((d) => d.ownerUid === user.uid);
    const shared = store.documents.filter(
      (d) => d.ownerUid !== user.uid && d.sharedEmails.includes(email),
    );
    onUpdate({
      owned: sortByUpdatedDesc(owned),
      shared: sortByUpdatedDesc(shared),
    });
  };
  emitLocal();

  const handleStorage = (event: StorageEvent) => {
    if (event.key === LOCAL_STORAGE_KEY) emitLocal();
  };
  localBus.addEventListener('change', emitLocal);
  window.addEventListener('storage', handleStorage);
  return () => {
    localBus.removeEventListener('change', emitLocal);
    window.removeEventListener('storage', handleStorage);
  };
}

export function subscribeDocument(
  docId: string,
  user: AppUser,
  onUpdate: (docRecord: DocRecord | null) => void,
  onError: (message: string) => void,
): () => void {
  if (isFirebaseConfigured && firestoreDb) {
    const ref = doc(firestoreDb, 'documents', docId);
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          onUpdate(null);
          return;
        }
        onUpdate(mapFirestoreDoc(snap.id, snap.data()));
      },
      (err) => onError(err.message),
    );
  }

  const emitLocal = () => {
    const store = readLocalStore();
    const found = store.documents.find((d) => d.id === docId) ?? null;
    if (!found) {
      onUpdate(null);
      return;
    }
    const email = normalizeEmail(user.email);
    const canRead = found.ownerUid === user.uid || found.sharedEmails.includes(email);
    if (!canRead) {
      onError('You do not have permission to view this document.');
      return;
    }
    onUpdate(found);
  };
  emitLocal();

  const handleStorage = (event: StorageEvent) => {
    if (event.key === LOCAL_STORAGE_KEY) emitLocal();
  };
  localBus.addEventListener('change', emitLocal);
  window.addEventListener('storage', handleStorage);
  return () => {
    localBus.removeEventListener('change', emitLocal);
    window.removeEventListener('storage', handleStorage);
  };
}

export async function createDocument(user: AppUser, input: CreateDocumentInput): Promise<DocRecord> {
  const titleCheck = validateDocumentTitle(input.title);
  if (!titleCheck.valid) {
    throw new Error(titleCheck.error ?? 'Invalid title.');
  }

  const now = new Date().toISOString();
  const contentHtml = input.contentHtml?.trim() || '<p></p>';
  const derived = deriveShareArrays(
    (input.shares ?? []).map((s) => ({ email: s.email, role: s.role, addedAt: now })),
  );

  const payload = {
    title: titleCheck.trimmed,
    contentHtml,
    contentJson: input.contentJson ?? '',
    plainTextPreview: extractPlainTextPreview(contentHtml),
    ownerUid: user.uid,
    ownerEmail: normalizeEmail(user.email),
    ownerName: user.displayName,
    ...derived,
    sourceType: input.sourceType ?? 'blank',
    importedFileName: input.importedFileName ?? null,
    attachmentCount: 0,
    createdAt: now,
    updatedAt: now,
    lastEditedByEmail: normalizeEmail(user.email),
  };

  if (isFirebaseConfigured && firestoreDb) {
    const ref = await addDoc(collection(firestoreDb, 'documents'), payload);
    return { id: ref.id, ...payload };
  }

  const store = readLocalStore();
  const record: DocRecord = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ...payload,
  };
  store.documents = [record, ...store.documents];
  writeLocalStore(store);
  return record;
}

export async function updateDocumentContent(
  docId: string,
  user: AppUser,
  patch: UpdateContentInput,
): Promise<void> {
  const updates: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
    lastEditedByEmail: normalizeEmail(user.email),
  };

  if (patch.title !== undefined) {
    const titleCheck = validateDocumentTitle(patch.title);
    if (!titleCheck.valid) {
      throw new Error(titleCheck.error ?? 'Invalid title.');
    }
    updates.title = titleCheck.trimmed;
  }

  if (patch.contentHtml !== undefined) {
    updates.contentHtml = patch.contentHtml;
    updates.plainTextPreview = extractPlainTextPreview(patch.contentHtml);
  }

  if (patch.contentJson !== undefined) {
    updates.contentJson = patch.contentJson;
  }

  if (isFirebaseConfigured && firestoreDb) {
    await updateDoc(doc(firestoreDb, 'documents', docId), updates);
    return;
  }

  const store = readLocalStore();
  const idx = store.documents.findIndex((d) => d.id === docId);
  if (idx === -1) throw new Error('Document not found.');
  if (!canUserEditDoc(store.documents[idx], user)) {
    throw new Error('Viewers cannot edit this document.');
  }
  store.documents[idx] = { ...store.documents[idx], ...(updates as Partial<DocRecord>) };
  writeLocalStore(store);
}

export async function updateDocumentSharing(
  docId: string,
  user: AppUser,
  shareData: ReturnType<typeof deriveShareArrays>,
): Promise<void> {
  const updates = {
    ...shareData,
    updatedAt: new Date().toISOString(),
  };

  if (isFirebaseConfigured && firestoreDb) {
    await updateDoc(doc(firestoreDb, 'documents', docId), updates);
    return;
  }

  const store = readLocalStore();
  const idx = store.documents.findIndex((d) => d.id === docId);
  if (idx === -1) throw new Error('Document not found.');
  if (!canUserShareOrDeleteDoc(store.documents[idx], user)) {
    throw new Error('Only the document owner can manage sharing.');
  }
  store.documents[idx] = { ...store.documents[idx], ...updates };
  writeLocalStore(store);
}

export async function deleteDocument(docId: string, user: AppUser): Promise<void> {
  if (isFirebaseConfigured && firestoreDb) {
    const attachmentsRef = collection(firestoreDb, 'documents', docId, 'attachments');
    const attSnap = await getDocs(attachmentsRef);
    for (const att of attSnap.docs) {
      await deleteDoc(att.ref);
    }
    await deleteDoc(doc(firestoreDb, 'documents', docId));
    return;
  }

  const store = readLocalStore();
  const target = store.documents.find((d) => d.id === docId);
  if (!target) return;
  if (!canUserShareOrDeleteDoc(target, user)) {
    throw new Error('Only the document owner can delete this document.');
  }
  store.documents = store.documents.filter((d) => d.id !== docId);
  store.attachments = store.attachments.filter((a) => a.docId !== docId);
  writeLocalStore(store);
}

export function subscribeAttachments(
  docId: string,
  onUpdate: (items: AttachmentRecord[]) => void,
  onError: (message: string) => void,
): () => void {
  if (isFirebaseConfigured && firestoreDb) {
    const attCollection = collection(firestoreDb, 'documents', docId, 'attachments');
    return onSnapshot(
      attCollection,
      (snap) => {
        const items = snap.docs.map((d) => mapFirestoreAttachment(docId, d.id, d.data()));
        onUpdate(items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      },
      (err) => onError(err.message),
    );
  }

  const emitLocal = () => {
    const store = readLocalStore();
    const items = store.attachments.filter((a) => a.docId === docId);
    onUpdate(items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  };
  emitLocal();

  const handleStorage = (event: StorageEvent) => {
    if (event.key === LOCAL_STORAGE_KEY) emitLocal();
  };
  localBus.addEventListener('change', emitLocal);
  window.addEventListener('storage', handleStorage);
  return () => {
    localBus.removeEventListener('change', emitLocal);
    window.removeEventListener('storage', handleStorage);
  };
}

export async function addAttachment(
  docId: string,
  user: AppUser,
  file: File,
  existingCount: number,
): Promise<AttachmentRecord> {
  const check = validateAttachmentFile(file, existingCount);
  if (!check.valid) {
    throw new Error(check.error ?? 'Invalid attachment.');
  }

  const base64Data = await fileToBase64(file);
  const now = new Date().toISOString();
  const payload = {
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    base64Data,
    uploadedByUid: user.uid,
    uploadedByEmail: normalizeEmail(user.email),
    createdAt: now,
  };

  if (isFirebaseConfigured && firestoreDb) {
    const ref = await addDoc(collection(firestoreDb, 'documents', docId, 'attachments'), payload);
    await updateDoc(doc(firestoreDb, 'documents', docId), {
      attachmentCount: existingCount + 1,
      updatedAt: now,
      lastEditedByEmail: normalizeEmail(user.email),
    });
    return { id: ref.id, docId, ...payload };
  }

  const store = readLocalStore();
  const idx = store.documents.findIndex((d) => d.id === docId);
  if (idx === -1) throw new Error('Document not found.');
  if (!canUserEditDoc(store.documents[idx], user)) {
    throw new Error('Viewers cannot add attachments.');
  }
  const attachment: AttachmentRecord = {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    docId,
    ...payload,
  };
  store.attachments = [attachment, ...store.attachments];
  store.documents[idx] = {
    ...store.documents[idx],
    attachmentCount: store.attachments.filter((a) => a.docId === docId).length,
    updatedAt: now,
    lastEditedByEmail: normalizeEmail(user.email),
  };
  writeLocalStore(store);
  return attachment;
}

export async function deleteAttachment(
  docId: string,
  attachmentId: string,
  user: AppUser,
  remainingCount: number,
): Promise<void> {
  const now = new Date().toISOString();
  if (isFirebaseConfigured && firestoreDb) {
    await deleteDoc(doc(firestoreDb, 'documents', docId, 'attachments', attachmentId));
    await updateDoc(doc(firestoreDb, 'documents', docId), {
      attachmentCount: Math.max(0, remainingCount),
      updatedAt: now,
      lastEditedByEmail: normalizeEmail(user.email),
    });
    return;
  }

  const store = readLocalStore();
  const idx = store.documents.findIndex((d) => d.id === docId);
  if (idx === -1) throw new Error('Document not found.');
  if (!canUserEditDoc(store.documents[idx], user)) {
    throw new Error('Viewers cannot remove attachments.');
  }
  store.attachments = store.attachments.filter((a) => a.id !== attachmentId);
  store.documents[idx] = {
    ...store.documents[idx],
    attachmentCount: store.attachments.filter((a) => a.docId === docId).length,
    updatedAt: now,
    lastEditedByEmail: normalizeEmail(user.email),
  };
  writeLocalStore(store);
}
