import React, { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  Code,
  User,
  Wallet,
  FileText,
  Globe,
  LayoutDashboard,
  Activity,
  ShieldAlert,
  Menu,
  X,
  PieChart,
} from 'lucide-react';
import { Avatar } from './Avatar';
import { AvatarUpload } from './AvatarUpload';
import { useWallet } from '../hooks/useWallet';

const AppNav: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false);
  const [userImageUrl, setUserImageUrl] = useState<string | undefined>(undefined);
  const { address, walletName, isConnecting } = useWallet();

  useEffect(() => {
    const savedImage = localStorage.getItem('payd:user-avatar');
    if (savedImage) {
      setUserImageUrl(savedImage);
    }
  }, []);

  // Mock user data - replace with actual user context
  const currentUser = {
    email: 'user@example.com',
    name: 'John Doe',
    imageUrl: userImageUrl,
  };

  const navLinks = (
    <>
      <NavLink
        to="/payroll"
        className={({ isActive }) =>
          `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition ${
            isActive
              ? 'text-(--accent) bg-white/5'
              : 'text-(--muted) hover:bg-white/10 hover:text-white'
          }`
        }
        onClick={() => setMobileOpen(false)}
      >
        <span className="opacity-70">
          <Wallet className="w-4 h-4" />
        </span>
        <span className="hidden sm:inline">Payroll</span>
      </NavLink>

      <NavLink
        to="/employee"
        className={({ isActive }) =>
          `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition ${
            isActive
              ? 'text-(--accent) bg-white/5'
              : 'text-(--muted) hover:bg-white/10 hover:text-white'
          }`
        }
        onClick={() => setMobileOpen(false)}
      >
        <span className="opacity-70">
          <User className="w-4 h-4" />
        </span>
        <span className="hidden sm:inline">Employees</span>
      </NavLink>

      <NavLink
        to="/portal"
        className={({ isActive }) =>
          `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition ${
            isActive
              ? 'text-(--accent) bg-white/5'
              : 'text-(--muted) hover:bg-white/10 hover:text-white'
          }`
        }
      >
        <span className="opacity-70">
          <LayoutDashboard className="w-4 h-4" />
        </span>
        My Portal
      </NavLink>

      <NavLink
        to="/reports"
        className={({ isActive }) =>
          `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition ${
            isActive
              ? 'text-(--accent) bg-white/5'
              : 'text-(--muted) hover:bg-white/10 hover:text-white'
          }`
        }
        onClick={() => setMobileOpen(false)}
      >
        <span className="opacity-70">
          <FileText className="w-4 h-4" />
        </span>
        <span className="hidden sm:inline">Reports</span>
      </NavLink>

      <NavLink
        to="/cross-asset-payment"
        className={({ isActive }) =>
          `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition ${
            isActive
              ? 'text-(--accent) bg-white/5'
              : 'text-(--muted) hover:bg-white/10 hover:text-white'
          }`
        }
        onClick={() => setMobileOpen(false)}
      >
        <span className="opacity-70">
          <Globe className="w-4 h-4" />
        </span>
        <span className="hidden sm:inline">Cross-Asset</span>
      </NavLink>

      <NavLink
        to="/transactions"
        className={({ isActive }) =>
          `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition ${
            isActive
              ? 'text-(--accent) bg-white/5'
              : 'text-(--muted) hover:bg-white/10 hover:text-white'
          }`
        }
      >
        <span className="opacity-70">
          <Activity className="w-4 h-4" />
        </span>
        History
      </NavLink>

      <NavLink
        to="/revenue-split"
        className={({ isActive }) =>
          `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition ${
            isActive
              ? 'text-(--accent) bg-white/5'
              : 'text-(--muted) hover:bg-white/10 hover:text-white'
          }`
        }
        onClick={() => setMobileOpen(false)}
      >
        <span className="opacity-70">
          <PieChart className="w-4 h-4" />
        </span>
        <span className="hidden sm:inline">Revenue Split</span>
      </NavLink>

      <div className="w-px h-5 bg-(--border-hi) mx-2" />
      <NavLink
        to="/admin"
        className={({ isActive }) =>
          `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition ${
            isActive
              ? 'text-red-500 bg-red-500/10'
              : 'text-red-400 hover:bg-red-500/20 hover:text-red-500'
          }`
        }
      >
        <ShieldAlert className="w-4 h-4" />
        Admin
      </NavLink>

      <NavLink
        to="/debug"
        className={({ isActive }) =>
          `flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-mono tracking-wide border transition ${
            isActive
              ? 'text-(--accent2) bg-[rgba(124,111,247,0.06)] border-[rgba(124,111,247,0.25)]'
              : 'text-(--accent2) bg-[rgba(124,111,247,0.06)] border-[rgba(124,111,247,0.25)] hover:bg-[rgba(124,111,247,0.12)]'
          }`
        }
        onClick={() => setMobileOpen(false)}
      >
        <Code className="w-4 h-4" />
        <span className="hidden sm:inline">debugger</span>
      </NavLink>

      <Link
        to="/help"
        onClick={() => setMobileOpen(false)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition text-(--accent) hover:bg-(--accent)/10"
      >
        Help
      </Link>
    </>
  );

  return (
    <nav className="relative w-full">
      <div className="flex items-center justify-between gap-4 px-3 py-2">
        {/* Desktop links */}
        <div className="hidden lg:flex items-center gap-4">{navLinks}</div>

        {/* Mobile menu button */}
        <button
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(!mobileOpen)}
          className="lg:hidden p-2 rounded-md hover:bg-white/5 transition"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* User profile */}
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden xl:flex flex-col items-end rounded-lg border border-(--border-hi) bg-(--surface) px-3 py-1.5">
            <span className="text-[9px] uppercase tracking-wider text-(--muted)">
              {isConnecting
                ? 'Connecting wallet'
                : walletName
                  ? `${walletName} connected`
                  : 'Wallet'}
            </span>
            <span className="text-[11px] font-mono text-(--accent)">
              {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'}
            </span>
          </div>
          <button
            type="button"
            className="p-1 rounded-lg flex items-center gap-2 cursor-pointer border border-(--border-hi) bg-(--surface) hover:bg-(--surface-hi) transition"
            onClick={() => setIsProfileEditorOpen(true)}
            title="Edit profile photo"
          >
            <Avatar
              email={currentUser.email}
              name={currentUser.name}
              imageUrl={currentUser.imageUrl}
              size="sm"
            />
            <div className="hidden md:block flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-(--text) truncate">{currentUser.name}</p>
              <p className="text-[10px] text-(--muted) truncate">{currentUser.email}</p>
            </div>
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {mobileOpen && (
        <div className="lg:hidden absolute left-0 right-0 top-full z-40 bg-white shadow-lg border-t">
          <div className="px-4 py-3 flex flex-col gap-2">{navLinks}</div>
        </div>
      )}

      {isProfileEditorOpen && (
        <div className="fixed inset-0 z-90 grid place-items-center bg-black/65 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-sm rounded-xl border border-(--border-hi) bg-(--surface) p-5 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-(--text)">Profile Picture</h3>
              <button
                type="button"
                className="rounded p-1 text-(--muted) hover:bg-(--surface-hi)"
                onClick={() => setIsProfileEditorOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <AvatarUpload
              email={currentUser.email}
              name={currentUser.name}
              currentImageUrl={currentUser.imageUrl}
              label="Upload Profile Photo"
              onImageUpload={(imageUrl) => {
                setUserImageUrl(imageUrl);
                localStorage.setItem('payd:user-avatar', imageUrl);
                setIsProfileEditorOpen(false);
              }}
            />
            <button
              type="button"
              className="mt-4 w-full rounded border border-(--border-hi) px-3 py-2 text-sm text-(--text) hover:bg-(--surface-hi) transition"
              onClick={() => {
                setUserImageUrl(undefined);
                localStorage.removeItem('payd:user-avatar');
              }}
            >
              Remove Custom Photo
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default AppNav;
