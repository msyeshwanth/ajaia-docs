import { useState } from 'react';
import { ChevronDown, LogOut, RefreshCw } from 'lucide-react';
import { DEMO_ACCOUNTS } from '../lib/demoAccounts';
import { signInDemoAccount, signOutUser } from '../lib/repository';
import { normalizeEmail } from '../lib/validation';
import type { AppUser, DemoAccount } from '../types/document';

interface AccountSwitcherProps {
  currentUser: AppUser;
  onSwitched?: () => void;
}

export function AccountSwitcher({ currentUser, onSwitched }: AccountSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSwitch = async (demo: DemoAccount) => {
    setError(null);
    setBusyId(demo.id);
    try {
      await signInDemoAccount(demo);
      setOpen(false);
      onSwitched?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch account.');
    } finally {
      setBusyId(null);
    }
  };

  const handleSignOut = async () => {
    setOpen(false);
    await signOutUser();
  };

  return (
    <div className="account-switcher">
      <button
        type="button"
        className="account-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="account-avatar">{currentUser.displayName[0]?.toUpperCase() ?? 'U'}</span>
        <span className="account-info">
          <strong>{currentUser.displayName}</strong>
          <span>{currentUser.email}</span>
        </span>
        <ChevronDown size={15} />
      </button>

      {open && (
        <div className="account-menu" role="menu">
          <div className="menu-section-label">
            <RefreshCw size={12} />
            <span>Quick Switch Demo Account</span>
          </div>
          {DEMO_ACCOUNTS.map((demo) => {
            const isCurrent = normalizeEmail(demo.email) === normalizeEmail(currentUser.email);
            return (
              <button
                key={demo.id}
                type="button"
                role="menuitem"
                className={`menu-item ${isCurrent ? 'current' : ''}`}
                disabled={busyId !== null || isCurrent}
                onClick={() => handleSwitch(demo)}
              >
                <span className="avatar-dot small" style={{ backgroundColor: demo.avatarColor }}>
                  {demo.name[0]}
                </span>
                <span className="menu-item-text">
                  <strong>{demo.name}</strong>
                  <span>{demo.email}</span>
                </span>
                {isCurrent && <span className="menu-current-tag">Active</span>}
                {busyId === demo.id && <span className="menu-current-tag">…</span>}
              </button>
            );
          })}
          {error && <div className="error-banner compact">{error}</div>}
          <div className="menu-divider" />
          <button type="button" role="menuitem" className="menu-item danger" onClick={handleSignOut}>
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
}
