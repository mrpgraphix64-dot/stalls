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
  Search,
  CheckCircle2,
  FolderOpen,
  Eye,
  Filter,
} from 'lucide-react';
import { fetchDashboard } from './api';
import { DashboardData, BoothItem } from './types';
import { FloorplanViewerModal } from './FloorplanViewerModal';
import { ExhibitorDirectoryModal } from './ExhibitorDirectoryModal';
import { matchFloorplanStall } from './floorplanData';

interface DashboardViewProps {
  onNavigate: (route: string) => void;
  onOpenCreateEvent: () => void;
  onOpenCreateBooth: () => void;
}

export function DashboardView({ onNavigate, onOpenCreateEvent, onOpenCreateBooth }: DashboardViewProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Table Search and Filters
  const [tableSearch, setTableSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');

  // Modals
  const [isFloorplanModalOpen, setIsFloorplanModalOpen] = useState<boolean>(false);
  const [isExhibitorModalOpen, setIsExhibitorModalOpen] = useState<boolean>(false);

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
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  // 4 Focused Operational KPIs
  const kpis = [
    {
      label: 'Total Reworkzone Stalls',
      value: data?.total_booths ?? 0,
      sub: 'Active managed stalls',
      icon: Layers,
      color: 'from-amber-500/20 to-amber-600/5 text-amber-500 border-amber-500/30',
      action: () => onNavigate('booths'),
    },
    {
      label: 'Work In Progress',
      value: data?.work_in_progress ?? data?.booths_in_production ?? 0,
      sub: 'Design & fabrication active',
      icon: Wrench,
      color: 'from-blue-500/20 to-blue-600/5 text-blue-400 border-blue-500/30',
      action: () => setStatusFilter('in_progress'),
    },
    {
      label: 'Ready / Completed',
      value: data?.ready_completed ?? 0,
      sub: 'Installed or handed over',
      icon: CheckCircle2,
      color: 'from-emerald-500/20 to-emerald-600/5 text-emerald-400 border-emerald-500/30',
      action: () => setStatusFilter('completed'),
    },
    {
      label: 'Pending Tasks',
      value: data?.pending_tasks ?? 0,
      sub: 'Across active checklists',
      icon: CheckSquare,
      color: 'from-purple-500/20 to-purple-600/5 text-purple-400 border-purple-500/30',
      action: () => onNavigate('booths'),
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
      case 'handover':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'draft':
      default:
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  // Filter booths for main work table
  const allStalls = data?.all_booths || data?.recent_booths || [];
  const filteredStalls = allStalls.filter((b) => {
    const matchesSearch =
      b.client_name.toLowerCase().includes(tableSearch.toLowerCase().trim()) ||
      b.booth_number.toLowerCase().includes(tableSearch.toLowerCase().trim()) ||
      (b.event_name && b.event_name.toLowerCase().includes(tableSearch.toLowerCase().trim()));

    if (!matchesSearch) return false;

    if (statusFilter === 'pending') {
      return b.status === 'draft' || b.status === 'design';
    }
    if (statusFilter === 'in_progress') {
      return b.status === 'approved' || b.status === 'in_production';
    }
    if (statusFilter === 'completed') {
      return b.status === 'installed' || b.status === 'handover' || b.status === 'completed';
    }
    return true;
  });

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
          <p className="text-xs text-zinc-400 mt-1">
            Real-time tracking of active Reworkzone stall fabrications and venue operations
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={onOpenCreateBooth}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 text-xs font-bold rounded-xl transition-all shadow-md shadow-amber-500/10 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Stall</span>
          </button>

          <button
            type="button"
            onClick={() => setIsFloorplanModalOpen(true)}
            className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
            <span>View Floor Plan</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExhibitorModalOpen(true)}
            className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Building className="w-3.5 h-3.5 text-zinc-400" />
            <span>Exhibitors Catalogue</span>
          </button>

          <button
            type="button"
            onClick={onOpenCreateEvent}
            className="px-3.5 py-2 bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Event</span>
          </button>
        </div>
      </div>

      {/* 4 Focused Operational KPI Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              onClick={kpi.action}
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

      {/* Main Content: Searchable Reworkzone Stalls Operations Table */}
      <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">
              Active Reworkzone Stalls
            </h2>
            <span className="text-xs font-mono text-zinc-400">
              ({filteredStalls.length} Stalls)
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search */}
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Search stalls or clients..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-500"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl p-1 text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-amber-500 text-zinc-950'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('pending')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  statusFilter === 'pending'
                    ? 'bg-amber-500 text-zinc-950'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Pending
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('in_progress')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  statusFilter === 'in_progress'
                    ? 'bg-amber-500 text-zinc-950'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                In Progress
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('completed')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  statusFilter === 'completed'
                    ? 'bg-amber-500 text-zinc-950'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Ready / Done
              </button>
            </div>
          </div>
        </div>

        {/* Work Table */}
        {filteredStalls.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 text-xs space-y-2">
            <p>No managed stalls match the selected filter.</p>
            <button
              type="button"
              onClick={onOpenCreateBooth}
              className="text-amber-400 hover:text-amber-300 font-semibold underline inline-flex items-center gap-1 cursor-pointer"
            >
              + Add New Stall
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto border border-zinc-800/80 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/80 border-b border-zinc-800 text-zinc-400 font-semibold">
                <tr>
                  <th className="py-3 px-3.5">Stall #</th>
                  <th className="py-3 px-3.5">Exhibitor / Company</th>
                  <th className="py-3 px-3.5">Exhibition</th>
                  <th className="py-3 px-3">Size</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3.5">Work Progress</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {filteredStalls.map((b) => {
                  const verified = Boolean(matchFloorplanStall(b.booth_number));
                  const progressPct = b.progress?.percentage ?? 0;
                  const comp = b.progress?.completed ?? 0;
                  const app = b.progress?.applicable ?? b.progress?.total ?? 0;

                  return (
                    <tr
                      key={b.id}
                      onClick={() => onNavigate(`booth:${b.id}`)}
                      className="group hover:bg-zinc-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-3.5 font-mono font-bold text-zinc-100 group-hover:text-amber-400 transition-colors">
                        <div className="flex items-center gap-1.5">
                          <span>{b.booth_number}</span>
                          {verified && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Floor Plan Verified" />
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3.5 font-semibold text-zinc-100">
                        {b.client_name}
                      </td>

                      <td className="py-3 px-3.5 text-zinc-400">
                        {b.event_name ? (
                          <span className="truncate max-w-[140px] inline-block">{b.event_name}</span>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="py-3 px-3 font-mono text-zinc-400">
                        {b.stand_size || '—'}
                      </td>

                      <td className="py-3 px-3 text-zinc-400 text-[11px]">
                        {b.booth_type || 'Custom Stall'}
                      </td>

                      <td className="py-3 px-3.5">
                        <div className="w-32 space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                            <span>{comp}/{app} done</span>
                            <span className="font-bold text-amber-400">{progressPct}%</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md border ${getStatusBadge(
                            b.status
                          )}`}
                        >
                          {b.status.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-3 px-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => onNavigate(`booth:${b.id}`)}
                          className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          <span>Open</span>
                          <ChevronRight className="w-3 h-3 text-amber-400" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upcoming Exhibitions Schedule Section */}
      <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">
              Upcoming Exhibition Schedule
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('events')}
            className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
          >
            All Exhibitions
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {(!data?.upcoming_events || data.upcoming_events.length === 0) ? (
          <div className="text-center py-6 text-zinc-500 text-xs">
            No upcoming events scheduled.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.upcoming_events.map((e) => (
              <div
                key={e.id}
                onClick={() => onNavigate(`event:${e.id}`)}
                className="group cursor-pointer p-4 rounded-xl bg-zinc-950/60 hover:bg-zinc-800/50 border border-zinc-800 hover:border-zinc-700 transition-all space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-xs font-bold text-zinc-100 group-hover:text-amber-400 transition-colors line-clamp-1">
                    {e.name}
                  </h3>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 shrink-0">
                    {e.booth_count ?? 0} stalls
                  </span>
                </div>

                <div className="text-[11px] text-zinc-400 flex items-center gap-1 truncate">
                  <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span>{e.city} • {e.venue}</span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t border-zinc-800/60">
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3 text-zinc-500" />
                    Starts {e.start_date}
                  </span>
                  <span className="px-1.5 py-0.2 rounded uppercase font-semibold text-[9px] bg-zinc-800 text-zinc-300 border border-zinc-700">
                    {e.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pop-up Floor Plan Viewer */}
      <FloorplanViewerModal
        isOpen={isFloorplanModalOpen}
        onClose={() => setIsFloorplanModalOpen(false)}
      />

      {/* Pop-up Exhibitor Catalogue Directory */}
      <ExhibitorDirectoryModal
        isOpen={isExhibitorModalOpen}
        onClose={() => setIsExhibitorModalOpen(false)}
        onSelectExhibitor={(company, booth) => {
          onOpenCreateBooth();
        }}
      />
    </div>
  );
}
