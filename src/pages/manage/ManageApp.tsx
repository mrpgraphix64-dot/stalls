import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Calendar,
  Layers,
  Settings,
  LogOut,
  ExternalLink,
  Menu,
  X,
  Shield,
  Sparkles,
  Clock,
} from 'lucide-react';
import { fetchAuthStatus, logout } from './api';
import { AuthStatus } from './types';
import { PinGate } from './PinGate';
import { DashboardView } from './DashboardView';
import { EventsView } from './EventsView';
import { EventDetailView } from './EventDetailView';
import { BoothsView } from './BoothsView';
import { BoothDetailView } from './BoothDetailView';
import { SettingsView } from './SettingsView';
import {
  hasPendingRestoration,
  consumeBoothsRestoration,
  consumeEventsRestoration,
} from './scrollRestoration';

export function ManageApp() {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Sub-routing state (e.g., 'dashboard', 'events', 'event:evt_123', 'booths', 'booth:bth_123', 'settings')
  const [currentRoute, setCurrentRoute] = useState<string>('dashboard');

  // Modal triggers from Quick Actions
  const [createEventModalOpen, setCreateEventModalOpen] = useState<boolean>(false);
  const [createBoothModalOpen, setCreateBoothModalOpen] = useState<boolean>(false);
  const [defaultBoothEventId, setDefaultBoothEventId] = useState<string>('');

  const checkAuth = async () => {
    try {
      setLoading(true);
      const status = await fetchAuthStatus();
      setAuthStatus(status);
    } catch (err) {
      setAuthStatus({
        is_initialized: true,
        authenticated: false,
        role: null,
        account_name: null,
        csrf_token: null,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();

    const handleRouteSync = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/manage/')) {
        const sub = hash.replace('#/manage/', '');
        if (sub) setCurrentRoute(sub);
      } else if (hash === '#/manage' || hash === '#manage' || (!hash && (window.location.pathname === '/manage' || window.location.pathname === '/manage/'))) {
        setCurrentRoute('dashboard');
      } else if (window.location.pathname.startsWith('/manage/')) {
        const sub = window.location.pathname.replace('/manage/', '');
        if (sub) setCurrentRoute(sub);
      }
    };

    handleRouteSync();
    window.addEventListener('hashchange', handleRouteSync);
    window.addEventListener('popstate', handleRouteSync);

    return () => {
      window.removeEventListener('hashchange', handleRouteSync);
      window.removeEventListener('popstate', handleRouteSync);
    };
  }, []);

  const handleNavigate = (route: string) => {
    setCurrentRoute(route);
    setMobileMenuOpen(false);

    // Only scroll to top if this navigation does not have a pending scroll restoration return
    if (!hasPendingRestoration(route)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Sync hash for easy back/forward navigation
    window.location.hash = `#/manage/${route}`;
  };

  const handleSidebarNavigate = (routeId: string) => {
    // When clicking a primary navigation link in the sidebar, clear pending restorations to start fresh
    if (routeId === 'booths') {
      consumeBoothsRestoration();
    } else if (routeId === 'events') {
      consumeEventsRestoration();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    handleNavigate(routeId);
  };

  const handleLogout = async () => {
    try {
      await logout();
      await checkAuth();
    } catch {
      window.location.reload();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-zinc-400 gap-3">
        <div className="w-10 h-10 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        <span className="text-xs font-medium tracking-wide">Connecting to Reworkzone Operations Hub...</span>
      </div>
    );
  }

  // If unauthenticated or uninitialized, show PIN gate
  if (!authStatus?.authenticated) {
    return (
      <PinGate
        isInitialized={authStatus?.is_initialized ?? true}
        rateLimited={authStatus?.rate_limited ?? false}
        retryAfter={authStatus?.retry_after ?? 0}
        onSuccess={checkAuth}
      />
    );
  }

  const navItems = [
    { id: 'dashboard', label: 'Command Center', icon: LayoutDashboard },
    { id: 'events', label: 'Exhibitions & Events', icon: Calendar },
    { id: 'booths', label: 'Stalls & Booths', icon: Layers },
    { id: 'settings', label: 'Settings & Security', icon: Settings },
  ];

  const getPageTitle = () => {
    if (currentRoute === 'dashboard') return 'Command Center';
    if (currentRoute === 'events') return 'Exhibitions';
    if (currentRoute.startsWith('event:')) return 'Exhibition Details';
    if (currentRoute === 'booths') return 'Stalls & Booths';
    if (currentRoute.startsWith('booth:')) return 'Stall Details';
    if (currentRoute === 'settings') return 'Settings';
    return 'Operations';
  };

  return (
    <div className="min-h-screen bg-[#0f1115] text-zinc-100 flex flex-col md:flex-row font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#13151b] border-b border-white/[0.07] sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-zinc-950 font-black text-sm shadow-md shadow-amber-500/10">
            R
          </div>
          <span className="font-bold text-sm tracking-tight text-zinc-100">Reworkzone Stalls</span>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-zinc-400 hover:text-zinc-100 rounded-xl hover:bg-white/[0.06] transition-colors"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar for Desktop & Mobile Drawer */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-30 h-screen w-60 bg-[#13151b] border-r border-white/[0.07] flex flex-col justify-between transition-transform duration-200 backdrop-blur-md shrink-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-5 space-y-6">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-zinc-950 font-black text-base shadow-md shadow-amber-500/20">
              R
            </div>
            <div>
              <div className="font-bold text-sm text-zinc-100 tracking-tight leading-none">Reworkzone</div>
              <div className="text-[10px] uppercase font-semibold text-amber-500 tracking-wider mt-1">
                Stalls Operations V1
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                currentRoute === item.id ||
                (item.id === 'events' && currentRoute.startsWith('event:')) ||
                (item.id === 'booths' && (currentRoute.startsWith('booth:') || currentRoute.startsWith('booths')));

              return (
                <button
                  key={item.id}
                  onClick={() => handleSidebarNavigate(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Status & Sign Out */}
        <div className="p-4 border-t border-white/[0.07] space-y-3">
          <div className="bg-[#181a22] border border-white/[0.06] rounded-xl p-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <div className="font-semibold text-zinc-200 leading-none">Master Admin</div>
                <div className="text-[10px] text-zinc-500 mt-1">6-Digit PIN Session</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/"
              className="flex-1 px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-200 text-xs font-medium rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Website
            </a>
            <button
              onClick={handleLogout}
              className="px-3 py-2 bg-white/[0.04] hover:bg-red-500/10 text-zinc-400 hover:text-red-400 hover:border-red-500/30 border border-transparent text-xs font-medium rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Desktop Top Bar */}
        <header className="hidden md:flex items-center justify-between px-6 lg:px-8 py-3.5 bg-[#13151b]/80 border-b border-white/[0.07] backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Workspace</span>
            <span className="text-zinc-700">/</span>
            <span className="text-xs font-bold text-zinc-200 tracking-wide">{getPageTitle()}</span>
          </div>

          <div className="flex items-center gap-3 text-xs text-zinc-400">
            <div className="flex items-center gap-1.5 bg-[#181a22] border border-white/[0.06] px-3 py-1.5 rounded-xl font-mono text-[11px] text-zinc-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              SQLite Persistent WAL
            </div>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 font-medium rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </header>

        {/* Routed View Container */}
        <main className="flex-1 w-full min-w-0 px-3.5 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-6">
          {currentRoute === 'dashboard' && (
            <DashboardView
              onNavigate={handleNavigate}
              onOpenCreateEvent={() => {
                setCreateEventModalOpen(true);
                handleNavigate('events');
              }}
              onOpenCreateBooth={() => {
                setCreateBoothModalOpen(true);
                handleNavigate('booths');
              }}
            />
          )}

          {currentRoute === 'events' && (
            <EventsView
              onNavigate={handleNavigate}
              createModalOpen={createEventModalOpen}
              onCloseCreateModal={() => setCreateEventModalOpen(false)}
            />
          )}

          {currentRoute.startsWith('event:') && (
            <EventDetailView
              eventId={currentRoute.replace('event:', '')}
              onNavigate={handleNavigate}
              onOpenCreateBoothForEvent={(evtId) => {
                setDefaultBoothEventId(evtId);
                setCreateBoothModalOpen(true);
                handleNavigate('booths');
              }}
            />
          )}

          {(currentRoute === 'booths' || currentRoute === 'booths:discussions') && (
            <BoothsView
              onNavigate={handleNavigate}
              createModalOpen={createBoothModalOpen}
              defaultEventId={defaultBoothEventId}
              initialTab={currentRoute === 'booths:discussions' ? 'discussions' : 'confirmed'}
              onCloseCreateModal={() => {
                setCreateBoothModalOpen(false);
                setDefaultBoothEventId('');
              }}
            />
          )}

          {currentRoute.startsWith('booth:') && (
            <BoothDetailView boothId={currentRoute.replace('booth:', '')} onNavigate={handleNavigate} />
          )}

          {currentRoute === 'settings' && <SettingsView />}
        </main>
      </div>
    </div>
  );
}
