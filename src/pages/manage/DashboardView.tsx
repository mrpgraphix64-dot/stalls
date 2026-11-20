import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Layers,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  ChevronRight,
  MapPin,
  Building,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { fetchDashboard } from './api';
import { DashboardData, BoothItem, EventItem } from './types';
import { AddBoothModal } from './AddBoothModal';
import { FloorplanViewerModal } from './FloorplanViewerModal';

interface DashboardViewProps {
  onNavigate: (route: string) => void;
  onOpenCreateEvent: () => void;
  onOpenCreateBooth: () => void;
}

export function DashboardView({
  onNavigate,
  onOpenCreateEvent,
  onOpenCreateBooth,
}: DashboardViewProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Search & Filter State for Booths
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [structureFilter, setStructureFilter] = useState<'all' | 'wooden' | 'frame' | 'customize'>('all');

  const [isFloorplanOpen, setIsFloorplanOpen] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const dashData = await fetchDashboard();
      setData(dashData);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-zinc-400 gap-3">
        <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        <span className="text-xs">Loading dashboard...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center space-y-3">
        <p className="text-red-400 text-sm">{error || 'Failed to load dashboard.'}</p>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg"
        >
          Retry
        </button>
      </div>
    );
  }

  const allStalls = data.all_booths || data.recent_booths || [];

  const getStallTypeLabel = (rawType?: string): 'Wooden' | 'Frame' | 'Customize' => {
    const raw = (rawType || '').toLowerCase();
    if (raw.includes('frame') || raw.includes('octonorm')) return 'Frame';
    if (raw.includes('custom')) return 'Customize';
    return 'Wooden';
  };

  // Filter booths
  const filteredBooths = allStalls.filter((b) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      b.booth_number.toLowerCase().includes(q) ||
      b.client_name.toLowerCase().includes(q) ||
      (b.event_name && b.event_name.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    const typeLabel = getStallTypeLabel(b.booth_type);
    if (structureFilter === 'wooden') return typeLabel === 'Wooden';
    if (structureFilter === 'frame') return typeLabel === 'Frame';
    if (structureFilter === 'customize') return typeLabel === 'Customize';
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200 max-w-6xl mx-auto pb-12">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.07]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight">
            Command Center
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Exhibition booth management & checklist tracking
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsFloorplanOpen(true)}
            className="px-3.5 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-300 text-xs font-medium rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
            <span>Floor Plan</span>
          </button>

          <button
            type="button"
            onClick={onOpenCreateEvent}
            className="px-3.5 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-300 text-xs font-medium rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ New Event</span>
          </button>

          <button
            type="button"
            onClick={onOpenCreateBooth}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold rounded-xl transition-all shadow-sm shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Booth</span>
          </button>
        </div>
      </div>

      {/* 4 Core Management Metrics */}
      <div className="space-y-1.5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* 1. Confirmed Stalls */}
          <div
            onClick={() => onNavigate('booths')}
            className="group cursor-pointer bg-[#15171e] hover:bg-[#191c25] border border-white/[0.07] hover:border-white/[0.14] rounded-2xl p-4 sm:p-5 transition-all shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">Confirmed Stalls</span>
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-extrabold text-zinc-100 font-mono group-hover:text-amber-400 transition-colors">
                {data.confirmed_stalls ?? data.total_booths}
              </div>
              <div className="text-[11px] text-zinc-500 mt-0.5 flex items-center justify-between">
                <span>All confirmed booths</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-amber-400" />
              </div>
            </div>
          </div>

          {/* 2. Ongoing Discussions */}
          <div
            onClick={() => onNavigate('booths:discussions')}
            className="group cursor-pointer bg-[#15171e] hover:bg-[#191c25] border border-sky-500/20 hover:border-sky-500/40 rounded-2xl p-4 sm:p-5 transition-all shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-sky-400">Ongoing Discussions</span>
              <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
                <MessageSquare className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-extrabold text-sky-400 font-mono group-hover:text-sky-300 transition-colors">
                {data.ongoing_discussions ?? 0}
              </div>
              <div className="text-[11px] text-zinc-500 mt-0.5 flex items-center justify-between">
                <span>Unconfirmed discussions</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-sky-400" />
              </div>
            </div>
          </div>

          {/* 3. In Progress (Subset of Confirmed) */}
          <div
            onClick={() => onNavigate('booths')}
            className="group cursor-pointer bg-[#15171e] hover:bg-[#191c25] border border-white/[0.07] hover:border-white/[0.14] rounded-2xl p-4 sm:p-5 transition-all shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">In Progress</span>
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono">
                {data.in_progress ?? data.booths_in_production ?? 0}
              </div>
              <div className="text-[11px] text-zinc-500 mt-0.5 flex items-center justify-between">
                <span>Underway (subset of Confirmed)</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-amber-400" />
              </div>
            </div>
          </div>

          {/* 4. Completed (Subset of Confirmed) */}
          <div
            onClick={() => onNavigate('booths')}
            className="group cursor-pointer bg-[#15171e] hover:bg-[#191c25] border border-white/[0.07] hover:border-white/[0.14] rounded-2xl p-4 sm:p-5 transition-all shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">Completed</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono">
                {data.completed ?? data.completed_checklists ?? 0}
              </div>
              <div className="text-[11px] text-zinc-500 mt-0.5 flex items-center justify-between">
                <span>100% checklist complete</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-400" />
              </div>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-zinc-500 italic px-1 pt-0.5">
          * In Progress and Completed are tracked as subsets of Confirmed Stalls.
        </p>
      </div>

      {/* Section 1: Upcoming Events */}
      <div className="bg-[#15171e] border border-white/[0.07] rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-400" />
            <h2 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">
              Upcoming Events ({data.upcoming_events?.length ?? 0})
            </h2>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('events')}
            className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>View All Events</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {(!data.upcoming_events || data.upcoming_events.length === 0) ? (
          <div className="text-center py-8 text-zinc-500 text-xs">
            No events created yet. Click "+ New Event" to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.upcoming_events.map((evt) => (
              <div
                key={evt.id}
                onClick={() => onNavigate(`event:${evt.id}`)}
                className="group cursor-pointer p-4 rounded-xl bg-[#191c25] hover:bg-[#1e222e] border border-white/[0.06] hover:border-white/[0.14] transition-all space-y-2.5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xs font-bold text-zinc-100 group-hover:text-amber-400 transition-colors line-clamp-1">
                      {evt.name}
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0 font-bold">
                      {evt.booth_count ?? 0} {evt.booth_count === 1 ? 'booth' : 'booths'}
                    </span>
                  </div>

                  <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 mt-2 truncate">
                    <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    <span className="truncate">{evt.venue}, {evt.city}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-2 border-t border-white/[0.06] text-zinc-500 font-mono">
                  <span>{evt.start_date} &rarr; {evt.end_date}</span>
                  <span className="text-amber-400 group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-0.5 font-sans font-semibold">
                    Open <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Recent Booths List */}
      <div className="bg-[#15171e] border border-white/[0.07] rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-amber-400" />
            <h2 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">
              Recent Booths Directory ({filteredBooths.length})
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Quick Search */}
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search booth # or company..."
                className="w-full bg-[#191c25] border border-white/[0.08] rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500/80 transition-all"
              />
            </div>

            {/* Structure Filter */}
            <div className="flex items-center bg-[#191c25] border border-white/[0.08] rounded-xl p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setStructureFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  structureFilter === 'all'
                    ? 'bg-amber-500 text-zinc-950 font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStructureFilter('wooden')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  structureFilter === 'wooden'
                    ? 'bg-amber-500 text-zinc-950 font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Wooden
              </button>
              <button
                type="button"
                onClick={() => setStructureFilter('frame')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  structureFilter === 'frame'
                    ? 'bg-amber-500 text-zinc-950 font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Frame
              </button>
              <button
                type="button"
                onClick={() => setStructureFilter('customize')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  structureFilter === 'customize'
                    ? 'bg-amber-500 text-zinc-950 font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Customize
              </button>
            </div>
          </div>
        </div>

        {/* Booths Directory Table */}
        {filteredBooths.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 text-xs space-y-2">
            <p>No booths match your search criteria.</p>
            <button
              type="button"
              onClick={onOpenCreateBooth}
              className="text-amber-400 hover:text-amber-300 font-semibold underline cursor-pointer"
            >
              + Add Booth
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto border border-white/[0.07] rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#121319] border-b border-white/[0.07] text-zinc-400 font-medium">
                <tr>
                  <th className="py-3 px-3.5">Booth</th>
                  <th className="py-3 px-3.5">Company</th>
                  <th className="py-3 px-3.5">Exhibition</th>
                  <th className="py-3 px-3.5">Size</th>
                  <th className="py-3 px-3.5">Structure</th>
                  <th className="py-3 px-3.5">Progress</th>
                  <th className="py-3 px-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05] text-zinc-300">
                {filteredBooths.map((b) => {
                  const comp = b.progress?.completed ?? 0;
                  const applicable = b.progress?.applicable ?? 0;
                  const na = b.progress?.na ?? 0;
                  const pct = b.progress?.percentage ?? 0;
                  const hasNoApplicable = applicable === 0;
                  const structure = getStallTypeLabel(b.booth_type);

                  return (
                    <tr
                      key={b.id}
                      onClick={() => onNavigate(`booth:${b.id}`)}
                      className="group hover:bg-white/[0.03] cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-3.5 font-mono font-bold text-zinc-100 group-hover:text-amber-400 transition-colors">
                        {b.booth_number}
                      </td>

                      <td className="py-3 px-3.5 font-semibold text-zinc-100">
                        {b.client_name}
                      </td>

                      <td className="py-3 px-3.5 text-zinc-400">
                        <span className="truncate max-w-[140px] inline-block">
                          {b.event_name || '—'}
                        </span>
                      </td>

                      <td className="py-3 px-3.5 font-mono text-zinc-400">
                        {b.stand_size || '3 × 3 m'}
                      </td>

                      <td className="py-3 px-3.5">
                        <span className="px-2 py-0.5 rounded-md bg-[#191c25] border border-white/[0.08] font-medium text-zinc-300 text-[11px]">
                          {structure}
                        </span>
                      </td>

                      <td className="py-3 px-3.5">
                        {hasNoApplicable ? (
                          <div className="w-28 text-[10px] text-zinc-400 font-mono">
                            <span className="bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700/50 block text-center truncate">
                              No Tasks {na > 0 ? `(${na} N/A)` : ''}
                            </span>
                          </div>
                        ) : pct === 100 ? (
                          <div className="w-28 space-y-1">
                            <div className="flex items-center justify-between text-[10px] text-emerald-400 font-mono">
                              <span>{comp}/{applicable}</span>
                              <span className="font-bold">100%</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-emerald-500/20 overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full w-full" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-28 space-y-1">
                            <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                              <span>{comp}/{applicable}</span>
                              <span className="font-bold text-amber-400">{pct}%</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => onNavigate(`booth:${b.id}`)}
                          className="px-2.5 py-1 bg-white/[0.06] hover:bg-white/[0.12] text-zinc-200 text-[11px] font-semibold rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
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

      {/* Pop-up Floor Plan Viewer */}
      <FloorplanViewerModal
        isOpen={isFloorplanOpen}
        onClose={() => setIsFloorplanOpen(false)}
        eventName={data?.upcoming_events?.[0]?.name || 'Exhibition Floor Plan'}
        pdfUrl={data?.upcoming_events?.[0]?.floor_plan_url || null}
      />
    </div>
  );
}
