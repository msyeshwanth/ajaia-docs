import { useState, type FormEvent } from 'react';
import { FileText, Lock, ShieldCheck, Sparkles, UserCheck } from 'lucide-react';
import { DEMO_ACCOUNTS } from '../lib/demoAccounts';
import { signInDemoAccount, signInWithEmail, signUpWithEmail } from '../lib/repository';
import { validateEmail } from '../lib/validation';
import type { DemoAccount } from '../types/document';

interface AuthViewProps {
  storageMode: 'firebase' | 'local-sandbox';
}

function formatAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  const msg = err instanceof Error ? err.message : 'Authentication failed.';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. You can use a one-click demo account on the left.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Switch to Sign In.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled in Firebase Authentication Console yet.';
    default:
      return msg;
  }
}

export function AuthView({ storageMode }: AuthViewProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDemoLogin = async (demo: DemoAccount) => {
    setError(null);
    setLoadingId(demo.id);
    try {
      await signInDemoAccount(demo);
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoadingId(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      setError(emailCheck.error ?? 'Invalid email.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoadingId('form');
    try {
      if (mode === 'signin') {
        await signInWithEmail(emailCheck.normalized, password);
      } else {
        await signUpWithEmail(emailCheck.normalized, password, displayName);
      }
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-grid">
        <section className="auth-hero">
          <div className="brand-pill">
            <FileText size={18} />
            <span>Ajaia Docs</span>
          </div>
          <h1>Collaborative documents, scoped for clarity and speed.</h1>
          <p className="auth-subtitle">
            Create and format rich documents, import <code>.txt</code>, <code>.md</code>, or{' '}
            <code>.docx</code> files, attach reference assets, and verify owner vs. collaborator
            access rules.
          </p>

          <div className="demo-card">
            <div className="demo-card-header">
              <UserCheck size={16} />
              <span>One-Click Demo Accounts (For Reviewers)</span>
            </div>
            <p className="demo-card-hint">
              Password for all demo accounts: <code>AjaiaDemo2026!</code>. Switch accounts anytime
              to verify <strong>Owned by me</strong> vs. <strong>Shared with me</strong> and
              Editor/Viewer permissions.
            </p>
            <div className="demo-account-list">
              {DEMO_ACCOUNTS.map((demo) => (
                <button
                  key={demo.id}
                  type="button"
                  className="demo-account-btn"
                  disabled={loadingId !== null}
                  onClick={() => handleDemoLogin(demo)}
                >
                  <span className="avatar-dot" style={{ backgroundColor: demo.avatarColor }}>
                    {demo.name[0]}
                  </span>
                  <span className="demo-account-meta">
                    <strong>{demo.name}</strong>
                    <span>
                      {demo.email} · {demo.roleLabel}
                    </span>
                  </span>
                  <span className="demo-action-label">
                    {loadingId === demo.id ? 'Signing in…' : 'Enter →'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="auth-badges">
            <span>
              <ShieldCheck size={14} />{' '}
              {storageMode === 'firebase'
                ? 'Firebase Auth + Firestore Rules'
                : 'Local Sandbox Mode (configure .env for Firebase)'}
            </span>
            <span>
              <Sparkles size={14} /> TipTap Rich Text + Mammoth DOCX Import
            </span>
          </div>
        </section>

        <section className="auth-form-card">
          <div className="auth-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signin'}
              className={mode === 'signin' ? 'active' : ''}
              onClick={() => {
                setMode('signin');
                setError(null);
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              className={mode === 'signup' ? 'active' : ''}
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {mode === 'signup' && (
              <label className="field">
                <span>Full name</span>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Alex Rivera"
                  autoComplete="name"
                />
              </label>
            )}

            <label className="field">
              <span>Work email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@ajaia.dev"
                autoComplete="email"
                required
              />
            </label>

            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                required
              />
            </label>

            {error && (
              <div className="error-banner" role="alert">
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-full" disabled={loadingId !== null}>
              <Lock size={15} />
              <span>
                {loadingId === 'form'
                  ? 'Please wait…'
                  : mode === 'signin'
                    ? 'Sign in with Email'
                    : 'Create Account'}
              </span>
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
