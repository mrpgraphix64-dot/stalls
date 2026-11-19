import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Layers,
  Wrench,
  CheckSquare,
  Clock,
  Plus,
  ExternalLink,
  ChevronRight,
  Sparkles,
  MapPin,
  Building,
} from 'lucide-react';
import { fetchDashboard } from './api';
import { DashboardData } from './types';

interface DashboardViewProps {
  onNavigate: (route: string) => void;
  onOpenCreateEvent: () => void;
  onOpenCreateBooth: () => void;
}

export function DashboardView({ onNavigate, onOpenCreateEvent, onOpenCreateBooth }: DashboardViewProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetchDashboard();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-zinc-400 gap-3">
        <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        <span className="text-sm">Loading live operations metrics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center space-y-3">
        <p className="text-red-400 text-sm">{error}</p>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const kpis = [
    {
      label: 'Active Events',
      value: data?.active_events ?? 0,
      total: data?.total_events ?? 0,
      sub: `${data?.total_events ?? 0} total events`,
      icon: Calendar,
      color: 'from-amber-500/20 to-amber-600/5 text-amber-500 border-amber-500/30',
      route: 'events',
    },
    {
      label: 'Booths In Production',
      value: data?.booths_in_production ?? 0,
      total: data?.total_booths ?? 0,
      sub: `${data?.total_booths ?? 0} total booths`,
      icon: Wrench,
      color: 'from-blue-500/20 to-blue-600/5 text-blue-400 border-blue-500/30',
      route: 'booths',
    },
    {
      label: 'Total Booths Managed',
      value: data?.total_booths ?? 0,
      sub: 'All active projects',
      icon: Layers,
      color: 'from-emerald-500/20 to-emerald-600/5 text-emerald-400 border-emerald-500/30',
      route: 'booths',
    },
    {
      label: 'Pending Tasks',
      value: data?.pending_tasks ?? 0,
      sub: 'Across active checklists',
      icon: CheckSquare,
      color: 'from-purple-500/20 to-purple-600/5 text-purple-400 border-purple-500/30',
      route: 'booths',
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_production':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'approved':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'installed':
      case 'completed':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'live':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse';
      case 'upcoming':
        return 'bg-zinc-800 text-zinc-300 border-zinc-700';
      default:
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800/60">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
            Operations Command Center
            <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
              Live V1
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">Real-time overview of upcoming exhibitions and active stall fabrications</p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={onOpenCreateEvent}
            className="flex-1 sm:flex-none px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/80 text-zinc-200 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            New Event
          </button>
          <button
            onClick={onOpenCreateBooth}
            className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 text-xs font-bold rounded-xl transition-all shadow-md shadow-amber-500/10 flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            New Booth
          </button>
        </div>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              onClick={() => onNavigate(kpi.route)}
              className="group cursor-pointer bg-zinc-900/80 hover:bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700/80 rounded-2xl p-5 transition-all shadow-sm flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-400">{kpi.label}</span>
                <div className={`p-2 rounded-xl bg-gradient-to-tr border ${kpi.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <div className="mt-4">
                <div className="text-3xl font-extrabold text-zinc-100 tracking-tight group-hover:text-amber-400 transition-colors">
                  {kpi.value}
                </div>
                <div className="text-xs text-zinc-500 mt-1 flex items-center justify-between">
                  <span>{kpi.sub}</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-amber-400" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Two Column Layout: Recent Booths & Upcoming Events */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Booths */}
        <div className="lg:col-span-2 bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">Recently Added Booths</h2>
            </div>
            <button
              onClick={() => onNavigate('booths')}
              className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 transition-colors"
            >
              View All ({data?.total_booths ?? 0})
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {(!data?.recent_booths || data.recent_booths.length === 0) ? (
            <div className="text-center py-10 text-zinc-500 text-xs">
              No booths created yet. Click "+ New Booth" to register your first stall.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 font-medium">
                    <th className="pb-2.5">Booth #</th>
                    <th className="pb-2.5">Client</th>
                    <th className="pb-2.5">Event</th>
                    <th className="pb-2.5">Size</th>
                    <th className="pb-2.5">Status</th>
                    <th className="pb-2.5 text-right">Drive</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                  {data.recent_booths.map((b) => (
                    <tr
                      key={b.id}
                      onClick={() => onNavigate(`booth:${b.id}`)}
                      className="group hover:bg-zinc-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3 font-semibold text-zinc-100 group-hover:text-amber-400 transition-colors">
                        {b.booth_number}
                      </td>
                      <td className="py-3 font-medium text-zinc-200">{b.client_name}</td>
                      <td className="py-3 text-zinc-400">
                        {b.event_name ? (
                          <span className="truncate max-w-[150px] inline-block">{b.event_name}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 text-zinc-400">{b.stand_size || '—'}</td>
                      <td className="py-3">
                        <span
                          className={`inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md border ${getStatusBadge(
                            b.status
                          )}`}
                        >
                          {b.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {b.main_drive_folder_url ? (
                          <a
                            href={b.main_drive_folder_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-md border border-amber-500/20 text-[10px] font-medium transition-colors"
                            title="Open Google Drive Folder"
                          >
                            <span>Drive</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Col: Upcoming Exhibitions */}
        <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">Upcoming Schedule</h2>
            </div>
            <button
              onClick={() => onNavigate('events')}
              className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 transition-colors"
            >
              All Events
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {(!data?.upcoming_events || data.upcoming_events.length === 0) ? (
            <div className="text-center py-10 text-zinc-500 text-xs">
              No upcoming events scheduled. Click "+ New Event" to register an exhibition.
            </div>
          ) : (
            <div className="space-y-3">
              {data.upcoming_events.map((e) => (
                <div
                  key={e.id}
                  onClick={() => onNavigate(`event:${e.id}`)}
                  className="group cursor-pointer p-3.5 rounded-xl bg-zinc-950/60 hover:bg-zinc-800/50 border border-zinc-800/80 hover:border-zinc-700/80 transition-all space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xs font-semibold text-zinc-200 group-hover:text-amber-400 transition-colors line-clamp-1">
                      {e.name}
                    </h3>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 shrink-0">
                      {e.booth_count ?? 0} {e.booth_count === 1 ? 'booth' : 'booths'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span className="flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3 text-zinc-500 shrink-0" />
                      {e.city} • {e.venue}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t border-zinc-800/40">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-zinc-500" />
                      Starts {e.start_date}
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded uppercase font-semibold text-[9px] border ${getStatusBadge(
                        e.status
                      )}`}
                    >
                      {e.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
