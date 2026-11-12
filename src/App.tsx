import { useEffect, useState } from 'react';
import { AuthView } from './components/AuthView';
import { DashboardView } from './components/DashboardView';
import { EditorView } from './components/EditorView';
import {
  getStorageModeLabel,
  subscribeAuthState,
  subscribeUserDocuments,
} from './lib/repository';
import type { AppUser, DocRecord } from './types/document';

function readDocIdFromHash(): string | null {
  const hash = window.location.hash;
  const match = hash.match(/^#\/doc\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeDocId, setActiveDocId] = useState<string | null>(() => readDocIdFromHash());

  const [ownedDocs, setOwnedDocs] = useState<DocRecord[]>([]);
  const [sharedDocs, setSharedDocs] = useState<DocRecord[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);

  const storageMode = getStorageModeLabel();

  useEffect(() => {
    const unsub = subscribeAuthState((nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const handleHashChange = () => setActiveDocId(readDocIdFromHash());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (!user) {
      setOwnedDocs([]);
      setSharedDocs([]);
      return;
    }

    setDocsLoading(true);
    setDocsError(null);
    const unsub = subscribeUserDocuments(
      user,
      ({ owned, shared }) => {
        setOwnedDocs(owned);
        setSharedDocs(shared);
        setDocsLoading(false);
      },
      (msg) => {
        setDocsError(msg);
        setDocsLoading(false);
      },
    );
    return () => unsub();
  }, [user]);

  const openDocument = (docId: string) => {
    window.location.hash = `#/doc/${encodeURIComponent(docId)}`;
    setActiveDocId(docId);
  };

  const backToDashboard = () => {
    window.location.hash = '#/';
    setActiveDocId(null);
  };

  if (!authReady) {
    return <div className="empty-state">Initializing Ajaia Docs…</div>;
  }

  if (!user) {
    return <AuthView storageMode={storageMode} />;
  }

  if (activeDocId) {
    return (
      <EditorView
        docId={activeDocId}
        currentUser={user}
        onBack={backToDashboard}
      />
    );
  }

  return (
    <DashboardView
      currentUser={user}
      ownedDocs={ownedDocs}
      sharedDocs={sharedDocs}
      loading={docsLoading}
      error={docsError}
      storageMode={storageMode}
      onOpenDoc={openDocument}
    />
  );
}

export default App;
