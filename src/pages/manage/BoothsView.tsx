import React, { useEffect, useState, useMemo } from 'react';
import {
  Layers,
  Plus,
  Search,
  Building,
  Calendar,
  ExternalLink,
  Edit2,
  Archive,
  ChevronRight,
  AlertTriangle,
  Check,
  Trash2,
  FileText,
  ArrowUp,
  ArrowDown,
  Printer,
} from 'lucide-react';
import {
  fetchBooths,
  fetchEvents,
  updateBooth,
  updateEvent,
  archiveBooth,
  deleteBooth,
  confirmBooth,
  fetchBooth,
  fetchTasks,
  fetchItems,
  fetchLinks,
} from './api';
import { BoothItem, EventItem, StallPrintData } from './types';
import { Modal } from './Modal';
import { AddBoothModal } from './AddBoothModal';
import { FloorplanViewerModal } from './FloorplanViewerModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { SortDirection, sortBoothsByNumber } from './boothSort';
import { PrintChecklistModal } from './PrintChecklistModal';

interface BoothsViewProps {
  onNavigate: (route: string) => void;
  createModalOpen?: boolean;
  defaultEventId?: string;
  initialTab?: 'confirmed' | 'discussions';
  onCloseCreateModal?: () => void;
}

const BOOTH_SIZE_OPTIONS = [
  '3 × 3 m (9 sq.m)',
  '6 × 3 m (18 sq.m)',
  '6 × 6 m (36 sq.m)',
  '27 sq. m',
  'Startup Stall (2 × 2 m)',
  'Custom Size',
];

export function BoothsView({
  onNavigate,
  createModalOpen = false,
  defaultEventId = '',
  initialTab = 'confirmed',
  onCloseCreateModal,
}: BoothsViewProps) {
  const [booths, setBooths] = useState<BoothItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Active Tab: Confirmed Stalls vs. Ongoing Discussions
  const [activeTab, setActiveTab] = useState<'confirmed' | 'discussions'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [selectedEventId, setSelectedEventId] = useState<string>(defaultEventId);
  const [structureFilter, setStructureFilter] = useState<'all' | 'wooden' | 'frame' | 'customize'>('all');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const toggleSortDirection = () => {
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  // Modals
  const [isAddOpen, setIsAddOpen] = useState<boolean>(createModalOpen);
  const [editingBooth, setEditingBooth] = useState<BoothItem | null>(null);
  const [archivingBooth, setArchivingBooth] = useState<BoothItem | null>(null);
  const [deletingBooth, setDeletingBooth] = useState<BoothItem | null>(null);
  const [isFloorplanOpen, setIsFloorplanOpen] = useState<boolean>(false);

  // Confirm Stall Modal State
  const [confirmingBooth, setConfirmingBooth] = useState<BoothItem | null>(null);
  const [confirmStallNumber, setConfirmStallNumber] = useState<string>('');
  const [confirmError, setConfirmError] = useState<string>('');
  const [confirmSubmitting, setConfirmSubmitting] = useState<boolean>(false);

  // Printable Stall Checklist State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [printStallsData, setPrintStallsData] = useState<StallPrintData[]>([]);
  const [printModalTitle, setPrintModalTitle] = useState<string>('');
  const [printModalSubtitle, setPrintModalSubtitle] = useState<string>('');
  const [loadingPrintId, setLoadingPrintId] = useState<string | null>(null);

  const handlePrintSingleBooth = async (bthSummary: BoothItem) => {
    try {
      setLoadingPrintId(bthSummary.id);
      const [bth, tskRes, pItems, fItems, eItems, gItems, d3dViews] = await Promise.all([
        fetchBooth(bthSummary.id),
        fetchTasks(bthSummary.id).catch(() => ({ tasks: [], total: 5, completed: 0, percentage: 0, success: true })),
        fetchItems(bthSummary.id, 'production').catch(() => []),
        fetchItems(bthSummary.id, 'furniture').catch(() => []),
        fetchItems(bthSummary.id, 'electrical').catch(() => []),
        fetchItems(bthSummary.id, 'goodies').catch(() => []),
        fetchLinks(bthSummary.id, 'render_3d').catch(() => []),
      ]);

      setPrintStallsData([
        {
          booth: bth,
          eventName: bth.event_name || 'Exhibition',
          tasks: tskRes.tasks || [],
          productionItems: pItems || [],
          furnitureItems: fItems || [],
          electricalItems: eItems || [],
          goodiesItems: gItems || [],
          views3D: d3dViews || [],
        },
      ]);
      setPrintModalTitle(`Stall #${bth.booth_number} — ${bth.client_name}`);
      setPrintModalSubtitle(`${bth.event_name || 'Exhibition'} • ${bth.stand_size || '3 × 3 m'}`);
      setIsPrintModalOpen(true);
    } catch (err: any) {
      alert(err.message || 'Failed to prepare stall checklist for printing.');
    } finally {
      setLoadingPrintId(null);
    }
  };

  // Edit Form State
  const [editBoothNumber, setEditBoothNumber] = useState<string>('');
  const [editCompanyName, setEditCompanyName] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editSize, setEditSize] = useState<string>('');
  const [editStructure, setEditStructure] = useState<'Wooden' | 'Frame' | 'Customize'>('Wooden');
  const [editDiscussionRemark, setEditDiscussionRemark] = useState<string>('');
  const [editSubmitting, setEditSubmitting] = useState<boolean>(false);
  const [editError, setEditError] = useState<string>('');

  useEffect(() => {
    if (createModalOpen) {
      setIsAddOpen(true);
    } else {
      setIsAddOpen(false);
    }
    if (defaultEventId) {
      setSelectedEventId(defaultEventId);
    }
  }, [createModalOpen, defaultEventId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [boothsData, eventsData] = await Promise.all([
        fetchBooths({
          event_id: selectedEventId || undefined,
          search: search.trim() || undefined,
        }),
        fetchEvents(),
      ]);
      setBooths(boothsData);
      setEvents(eventsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load booths directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedEventId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const openEditModal = (bth: BoothItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingBooth(bth);
    setEditBoothNumber(bth.booth_number && bth.booth_number.toLowerCase() !== 'pending' ? bth.booth_number : '');
    setEditCompanyName(bth.client_name);
    setEditPhone(bth.phone || '');
    setEditSize(bth.stand_size || '3 × 3 m (9 sq.m)');
    setEditDiscussionRemark(bth.discussion_remark || '');
    let st: 'Wooden' | 'Frame' | 'Customize' = 'Wooden';
    const rawSt = bth.booth_type?.toLowerCase() || '';
    if (rawSt.includes('frame') || rawSt.includes('octonorm')) {
      st = 'Frame';
    } else if (rawSt.includes('custom')) {
      st = 'Customize';
    }
    setEditStructure(st);
    setEditError('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBooth) return;

    const isDiscussion = editingBooth.booking_stage === 'discussion';
    if (!isDiscussion && !editBoothNumber.trim()) {
      setEditError('Booth number is required for confirmed stalls.');
      return;
    }
    if (!editCompanyName.trim()) {
      setEditError('Company name is required.');
      return;
    }

    setEditSubmitting(true);
    try {
      await updateBooth(editingBooth.id, {
        booth_number: editBoothNumber.trim() || (isDiscussion ? 'Pending' : ''),
        client_name: editCompanyName.trim(),
        phone: editPhone.trim() || undefined,
        stand_size: editSize,
        booth_type: editStructure,
        discussion_remark: editDiscussionRemark.trim() || undefined,
      });
      setEditingBooth(null);
      await loadData();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update booth.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const openConfirmModal = (bth: BoothItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setConfirmingBooth(bth);
    setConfirmStallNumber(bth.booth_number && bth.booth_number.toLowerCase() !== 'pending' ? bth.booth_number : '');
    setConfirmError('');
  };

  const handleConfirmStallSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmingBooth) return;

    const num = confirmStallNumber.trim();
    if (!num || num.toLowerCase() === 'pending') {
      setConfirmError('Please enter a valid Stall / Booth number to confirm.');
      return;
    }

    setConfirmSubmitting(true);
    setConfirmError('');
    try {
      await confirmBooth(confirmingBooth.id, num);
      setConfirmingBooth(null);
      await loadData();
    } catch (err: any) {
      setConfirmError(err.message || 'Failed to confirm stall.');
    } finally {
      setConfirmSubmitting(false);
    }
  };

  const handleArchiveConfirm = async () => {
    if (!archivingBooth) return;
    try {
      setEditSubmitting(true);
      await archiveBooth(archivingBooth.id);
      setArchivingBooth(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to archive booth.');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Helper to map booth type display
  const getStallTypeLabel = (rawType?: string): 'Wooden' | 'Frame' | 'Customize' => {
    const raw = (rawType || '').toLowerCase();
    if (raw.includes('frame') || raw.includes('octonorm')) return 'Frame';
    if (raw.includes('custom')) return 'Customize';
    return 'Wooden';
  };

  const confirmedCount = booths.filter((b) => b.booking_stage !== 'discussion').length;
  const discussionsCount = booths.filter((b) => b.booking_stage === 'discussion').length;

  // Filter booths by active tab and structure
  const filteredBooths = useMemo(() => {
    return booths.filter((b) => {
      if (activeTab === 'confirmed' && b.booking_stage === 'discussion') return false;
      if (activeTab === 'discussions' && b.booking_stage !== 'discussion') return false;

      const typeLabel = getStallTypeLabel(b.booth_type);
      if (structureFilter === 'wooden') return typeLabel === 'Wooden';
      if (structureFilter === 'frame') return typeLabel === 'Frame';
      if (structureFilter === 'customize') return typeLabel === 'Customize';
      return true;
    });
  }, [booths, activeTab, structureFilter]);

  const sortedBooths = useMemo(() => {
    return sortBoothsByNumber(filteredBooths, sortDirection);
  }, [filteredBooths, sortDirection]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200 max-w-6xl mx-auto pb-12">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800/60">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight flex items-center gap-2.5">
            Stalls & Booths Directory
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {filteredBooths.length}
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Track exhibition booths, sizes, structure fabrication, and checklist completion
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
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
            onClick={() => setIsAddOpen(true)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold rounded-xl transition-all shadow-sm shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Booth</span>
          </button>
        </div>
      </div>

      {/* Tab Switcher: Confirmed Stalls vs Ongoing Discussions */}
      <div className="flex items-center gap-2 border-b border-white/[0.08] pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('confirmed')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'confirmed'
              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
          }`}
        >
          <span>Confirmed Stalls</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              activeTab === 'confirmed' ? 'bg-amber-500/30 text-amber-300' : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            {confirmedCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('discussions')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'discussions'
              ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30 font-bold'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
          }`}
        >
          <span>Ongoing Discussions</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              activeTab === 'discussions' ? 'bg-sky-500/30 text-sky-300' : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            {discussionsCount}
          </span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              activeTab === 'confirmed'
                ? 'Search by client or booth #...'
                : 'Search discussion by company or remark...'
            }
            className="w-full bg-[#15171e] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500/80 transition-all"
          />
        </form>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Exhibition Filter */}
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="bg-[#15171e] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/80 cursor-pointer"
          >
            <option value="">All Exhibitions</option>
            {events.map((evt) => (
              <option key={evt.id} value={evt.id}>
                {evt.name} ({evt.city})
              </option>
            ))}
          </select>

          {/* Structure Filter */}
          <div className="flex items-center bg-[#15171e] border border-white/[0.08] rounded-xl p-0.5 text-xs">
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

      {/* Directory Table */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-zinc-400 gap-3">
          <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          <span className="text-xs">
            {activeTab === 'confirmed' ? 'Loading stalls directory...' : 'Loading ongoing discussions...'}
          </span>
        </div>
      ) : filteredBooths.length === 0 ? (
        <div className="bg-[#15171e] border border-dashed border-white/[0.1] rounded-2xl p-12 text-center space-y-3">
          <p className="text-sm font-medium text-zinc-300">
            {activeTab === 'confirmed' ? 'No confirmed stalls found' : 'No ongoing discussions found'}
          </p>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            {search || selectedEventId
              ? 'No records match your active search filters.'
              : activeTab === 'confirmed'
              ? 'Register a confirmed booth to begin tracking checklist execution.'
              : 'Add an inquiry or prospective stall to track client discussions before confirmation.'}
          </p>
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-xs transition-all cursor-pointer shadow-sm shadow-amber-500/20 mt-2"
          >
            <Plus className="w-4 h-4" />
            <span>{activeTab === 'confirmed' ? '+ Add Booth' : '+ Add Discussion'}</span>
          </button>
        </div>
      ) : activeTab === 'confirmed' ? (
        /* 1. Confirmed Stalls List */
        <div className="bg-[#15171e] border border-white/[0.08] rounded-2xl overflow-hidden shadow-sm">
          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#121319] border-b border-white/[0.08] text-zinc-400 font-medium">
                <tr>
                  <th className="py-3.5 px-4" aria-sort={sortDirection === 'asc' ? 'ascending' : 'descending'}>
                    <button
                      type="button"
                      onClick={toggleSortDirection}
                      className="inline-flex items-center gap-1.5 font-semibold text-zinc-300 hover:text-amber-400 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 rounded py-0.5 px-1 -ml-1 transition-colors cursor-pointer select-none group"
                      title={`Sorted by Booth # (${sortDirection === 'asc' ? 'Ascending' : 'Descending'}). Click to toggle.`}
                    >
                      <span>Booth #</span>
                      {sortDirection === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
                      )}
                    </button>
                  </th>
                  <th className="py-3.5 px-4">Company Name</th>
                  <th className="py-3.5 px-4">Mobile Number</th>
                  <th className="py-3.5 px-4">Size & Structure</th>
                  <th className="py-3.5 px-4">Checklist Progress</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05] text-zinc-300">
                {sortedBooths.map((b) => {
                  const comp = b.tasks_completed ?? 0;
                  const total = b.task_count ?? 5;
                  const pct = total > 0 ? Math.round((comp / total) * 100) : 0;
                  const structure = getStallTypeLabel(b.booth_type);

                  return (
                    <tr
                      key={b.id}
                      onClick={() => onNavigate(`booth:${b.id}`)}
                      className="group hover:bg-zinc-800/40 odd:bg-transparent even:bg-white/[0.015] cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/25 font-mono font-bold text-amber-300 text-xs tracking-tight group-hover:border-amber-500/50 group-hover:bg-amber-500/20 transition-all">
                          {b.booth_number}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-zinc-100 text-sm group-hover:text-amber-300 transition-colors block truncate max-w-[220px]" title={b.client_name}>
                          {b.client_name}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-zinc-400">
                        {b.phone ? (
                          <a
                            href={`tel:${b.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-zinc-300 hover:text-amber-400 hover:underline transition-colors"
                            title={`Call ${b.phone}`}
                          >
                            {b.phone}
                          </a>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-400">
                          <span className="px-2 py-0.5 rounded bg-[#1a1d26] border border-white/[0.08] font-medium text-zinc-300 text-[11px]">
                            {structure}
                          </span>
                          <span className="text-zinc-600">•</span>
                          <span className="text-zinc-300">{b.stand_size || '3 × 3 m'}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {pct === 100 ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-mono text-[11px] font-medium">
                            <Check className="w-3 h-3" />
                            <span>{total}/{total} Done</span>
                          </span>
                        ) : (
                          <div className="flex items-center gap-2.5">
                            <div className="w-20 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                              <div
                                className="h-full bg-amber-500 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="font-mono text-[11px] text-zinc-300">
                              {comp}/{total} <span className="text-zinc-500">({pct}%)</span>
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePrintSingleBooth(b);
                            }}
                            className="p-1.5 hover:bg-amber-500/10 text-zinc-400 hover:text-amber-400 rounded-lg transition-colors cursor-pointer"
                            title="Print Stall Checklist"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => openEditModal(b, e)}
                            className="p-1.5 hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors cursor-pointer"
                            title="Edit Booth"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setArchivingBooth(b);
                            }}
                            className="p-1.5 hover:bg-amber-500/10 text-zinc-500 hover:text-amber-400 rounded-lg transition-colors cursor-pointer"
                            title="Archive Stall"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingBooth(b);
                            }}
                            className="p-1.5 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                            title="Delete Stall"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all ml-1 shrink-0" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Card View */}
          <div className="block sm:hidden divide-y divide-white/[0.06]">
            {sortedBooths.map((b) => {
              const comp = b.tasks_completed ?? 0;
              const total = b.task_count ?? 5;
              const pct = total > 0 ? Math.round((comp / total) * 100) : 0;
              const structure = getStallTypeLabel(b.booth_type);

              return (
                <div
                  key={b.id}
                  onClick={() => onNavigate(`booth:${b.id}`)}
                  className="p-3.5 hover:bg-zinc-800/40 active:bg-zinc-800/60 cursor-pointer transition-colors space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 font-mono font-bold text-amber-300 text-xs tracking-tight shrink-0">
                        {b.booth_number}
                      </span>
                      <span className="font-semibold text-zinc-100 text-sm truncate">
                        {b.client_name}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-400">
                    <span className="px-1.5 py-0.5 rounded bg-[#1a1d26] border border-white/[0.08] font-medium text-zinc-300 text-[10px]">
                      {structure}
                    </span>
                    <span className="text-zinc-600">•</span>
                    <span className="font-mono text-zinc-300 text-[11px]">{b.stand_size || '3 × 3 m'}</span>
                    {b.phone && (
                      <>
                        <span className="text-zinc-600">•</span>
                        <a
                          href={`tel:${b.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-zinc-400 hover:text-amber-400 font-mono text-[11px]"
                        >
                          {b.phone}
                        </a>
                      </>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="flex-1 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="font-mono text-[11px] text-zinc-400 shrink-0">
                        {comp}/{total} ({pct}%)
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrintSingleBooth(b);
                        }}
                        className="p-1.5 text-zinc-400 hover:text-amber-400 active:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                        title="Print Stall Checklist"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => openEditModal(b, e)}
                        className="p-1.5 text-zinc-400 hover:text-zinc-200 active:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                        title="Edit Booth"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setArchivingBooth(b);
                        }}
                        className="p-1.5 text-zinc-500 hover:text-amber-400 active:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                        title="Archive Stall"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingBooth(b);
                        }}
                        className="p-1.5 text-zinc-500 hover:text-red-400 active:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                        title="Delete Stall"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* 2. Ongoing Discussions List */
        <div className="bg-[#15171e] border border-white/[0.08] rounded-2xl overflow-hidden shadow-sm">
          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#121319] border-b border-white/[0.08] text-zinc-400 font-medium">
                <tr>
                  <th className="py-3.5 px-4">Company Name</th>
                  <th className="py-3.5 px-4">Exhibition</th>
                  <th className="py-3.5 px-4">Mobile Number</th>
                  <th className="py-3.5 px-4" aria-sort={sortDirection === 'asc' ? 'ascending' : 'descending'}>
                    <button
                      type="button"
                      onClick={toggleSortDirection}
                      className="inline-flex items-center gap-1.5 font-semibold text-zinc-300 hover:text-sky-400 focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-500 rounded py-0.5 px-1 -ml-1 transition-colors cursor-pointer select-none group"
                      title={`Sorted by Stall # (${sortDirection === 'asc' ? 'Ascending' : 'Descending'}). Click to toggle.`}
                    >
                      <span>Stall #</span>
                      {sortDirection === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform shrink-0" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform shrink-0" />
                      )}
                    </button>
                  </th>
                  <th className="py-3.5 px-4">Structure & Size</th>
                  <th className="py-3.5 px-4">Discussion Remark</th>
                  <th className="py-3.5 px-4">Last Updated</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05] text-zinc-300">
                {sortedBooths.map((b) => {
                  const structure = getStallTypeLabel(b.booth_type);
                  const hasAllottedNumber = b.booth_number && b.booth_number.toLowerCase() !== 'pending';
                  const dateStr = b.updated_at || b.created_at || '';
                  const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString() : '—';

                  return (
                    <tr
                      key={b.id}
                      onClick={() => onNavigate(`booth:${b.id}`)}
                      className="group hover:bg-zinc-800/40 odd:bg-transparent even:bg-white/[0.015] cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4 font-bold text-zinc-100 group-hover:text-amber-400 transition-colors">
                        {b.client_name}
                      </td>

                      <td className="py-3.5 px-4 text-zinc-300">
                        <span className="truncate max-w-[150px] block" title={b.event_name}>
                          {b.event_name || 'Exhibition'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-zinc-400">
                        {b.phone ? (
                          <a
                            href={`tel:${b.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-zinc-300 hover:text-amber-400 hover:underline"
                          >
                            {b.phone}
                          </a>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {hasAllottedNumber ? (
                          <span className="font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/25">
                            #{b.booth_number}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800/80 text-zinc-400 border border-zinc-700/60">
                            Pending Allotment
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-zinc-400 font-mono text-[11px]">
                        <span>{structure}</span>
                        <span className="text-zinc-600 mx-1">•</span>
                        <span>{b.stand_size || '3 × 3 m'}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        {b.discussion_remark ? (
                          <span
                            className="text-zinc-300 italic truncate max-w-xs block text-[11px]"
                            title={b.discussion_remark}
                          >
                            "{b.discussion_remark}"
                          </span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-zinc-400 text-[11px]">
                        {formattedDate}
                      </td>

                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Confirm Stall Action Button */}
                          <button
                            type="button"
                            onClick={(e) => openConfirmModal(b, e)}
                            className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-[11px] font-bold rounded-lg transition-all shadow-sm shadow-amber-500/20 flex items-center gap-1 cursor-pointer"
                            title="Confirm Stall & Initialize Checklist"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Confirm Stall</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => openEditModal(b, e)}
                            className="p-1.5 hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors cursor-pointer"
                            title="Edit Discussion"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingBooth(b);
                            }}
                            className="p-1.5 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                            title="Delete Discussion"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all ml-1 shrink-0" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Card View for Discussions */}
          <div className="block sm:hidden divide-y divide-white/[0.06]">
            {sortedBooths.map((b) => {
              const structure = getStallTypeLabel(b.booth_type);
              const hasAllottedNumber = b.booth_number && b.booth_number.toLowerCase() !== 'pending';

              return (
                <div
                  key={b.id}
                  onClick={() => onNavigate(`booth:${b.id}`)}
                  className="p-3.5 hover:bg-zinc-800/40 active:bg-zinc-800/60 cursor-pointer transition-colors space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {hasAllottedNumber ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 font-mono font-bold text-amber-300 text-xs tracking-tight shrink-0">
                          #{b.booth_number}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-800/80 text-zinc-400 border border-zinc-700/60 shrink-0">
                          Pending
                        </span>
                      )}
                      <span className="font-semibold text-zinc-100 text-sm truncate">
                        {b.client_name}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-400">
                    <span className="text-zinc-300 font-medium truncate max-w-[130px]">{b.event_name || 'Exhibition'}</span>
                    <span className="text-zinc-600">•</span>
                    <span className="px-1.5 py-0.5 rounded bg-[#1a1d26] border border-white/[0.08] font-medium text-zinc-300 text-[10px]">
                      {structure}
                    </span>
                    <span className="text-zinc-600">•</span>
                    <span className="font-mono text-zinc-300 text-[11px]">{b.stand_size || '3 × 3 m'}</span>
                    {b.phone && (
                      <>
                        <span className="text-zinc-600">•</span>
                        <a
                          href={`tel:${b.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-zinc-400 hover:text-amber-400 font-mono text-[11px]"
                        >
                          {b.phone}
                        </a>
                      </>
                    )}
                  </div>

                  {b.discussion_remark && (
                    <p className="text-zinc-300 italic text-[11px] line-clamp-2 bg-zinc-900/60 p-2 rounded-lg border border-white/[0.04]">
                      "{b.discussion_remark}"
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={(e) => openConfirmModal(b, e)}
                      className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold rounded-lg transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirm Stall</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => openEditModal(b, e)}
                        className="p-1.5 text-zinc-400 hover:text-zinc-200 active:bg-zinc-800 rounded-lg"
                        title="Edit Discussion"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingBooth(b);
                        }}
                        className="p-1.5 text-zinc-500 hover:text-red-400 active:bg-zinc-800 rounded-lg"
                        title="Delete Discussion"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Booth Modal */}
      <AddBoothModal
        isOpen={isAddOpen}
        onClose={() => {
          setIsAddOpen(false);
          if (onCloseCreateModal) onCloseCreateModal();
        }}
        events={events}
        defaultEventId={selectedEventId}
        existingBooths={booths}
        onSuccess={(newBooth) => {
          setIsAddOpen(false);
          if (onCloseCreateModal) onCloseCreateModal();
          loadData();
          onNavigate(`booth:${newBooth.id}`);
        }}
      />

      {/* Edit Booth Modal */}
      <Modal
        isOpen={editingBooth !== null}
        onClose={() => setEditingBooth(null)}
        title={
          editingBooth?.booking_stage === 'discussion'
            ? `Edit Discussion: ${editingBooth.client_name}`
            : editingBooth
            ? `Edit Booth: #${editingBooth.booth_number}`
            : 'Edit Booth'
        }
        subtitle={
          editingBooth?.booking_stage === 'discussion'
            ? 'Update prospective stall and discussion details'
            : 'Update the basic details for this booth'
        }
        maxWidth="max-w-[540px]"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4 text-xs" noValidate>
          {editError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{editError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="block text-zinc-300 font-semibold">
                Booth Number{' '}
                {editingBooth?.booking_stage === 'discussion' ? (
                  <span className="text-zinc-500 font-normal">(Optional)</span>
                ) : (
                  <span className="text-amber-500">*</span>
                )}
              </label>
              <input
                type="text"
                required={editingBooth?.booking_stage !== 'discussion'}
                value={editBoothNumber}
                onChange={(e) => setEditBoothNumber(e.target.value)}
                placeholder={editingBooth?.booking_stage === 'discussion' ? 'Optional (allot later)' : 'e.g. A-12'}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-zinc-300 font-semibold">Company Name *</label>
              <input
                type="text"
                required
                value={editCompanyName}
                onChange={(e) => setEditCompanyName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="block text-zinc-300 font-semibold">Mobile Number</label>
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-zinc-300 font-semibold">Booth Size</label>
              <select
                value={editSize}
                onChange={(e) => setEditSize(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 cursor-pointer"
              >
                {BOOTH_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-zinc-300 font-semibold">Stall Type</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setEditStructure('Wooden')}
                className={`p-2.5 rounded-xl border text-left cursor-pointer flex items-center justify-between ${
                  editStructure === 'Wooden'
                    ? 'bg-amber-500/10 border-amber-500/60 text-amber-400 font-bold'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                }`}
              >
                <span>Wooden</span>
                {editStructure === 'Wooden' && <Check className="w-3.5 h-3.5 text-amber-400" />}
              </button>
              <button
                type="button"
                onClick={() => setEditStructure('Frame')}
                className={`p-2.5 rounded-xl border text-left cursor-pointer flex items-center justify-between ${
                  editStructure === 'Frame'
                    ? 'bg-amber-500/10 border-amber-500/60 text-amber-400 font-bold'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                }`}
              >
                <span>Frame</span>
                {editStructure === 'Frame' && <Check className="w-3.5 h-3.5 text-amber-400" />}
              </button>
              <button
                type="button"
                onClick={() => setEditStructure('Customize')}
                className={`p-2.5 rounded-xl border text-left cursor-pointer flex items-center justify-between ${
                  editStructure === 'Customize'
                    ? 'bg-amber-500/10 border-amber-500/60 text-amber-400 font-bold'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                }`}
              >
                <span>Customize</span>
                {editStructure === 'Customize' && <Check className="w-3.5 h-3.5 text-amber-400" />}
              </button>
            </div>
          </div>

          {editingBooth?.booking_stage === 'discussion' && (
            <div className="space-y-1.5">
              <label className="block text-zinc-300 font-semibold">Discussion Remark</label>
              <textarea
                rows={2}
                value={editDiscussionRemark}
                onChange={(e) => setEditDiscussionRemark(e.target.value)}
                placeholder="e.g. Waiting for client to approve 3x3 layout..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 resize-none"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setEditingBooth(null)}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editSubmitting}
              className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-zinc-950 font-bold rounded-xl cursor-pointer"
            >
              {editSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Stall Modal */}
      <Modal
        isOpen={confirmingBooth !== null}
        onClose={() => setConfirmingBooth(null)}
        title="Confirm Exhibition Stall"
        subtitle="Convert ongoing discussion into an active confirmed project"
        maxWidth="max-w-[460px]"
      >
        <form onSubmit={handleConfirmStallSubmit} className="space-y-4 text-xs" noValidate>
          {confirmError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{confirmError}</span>
            </div>
          )}

          <div className="bg-[#1c1f2a] border border-white/[0.08] rounded-xl p-3.5 space-y-1.5">
            <div className="flex items-center justify-between text-zinc-400 text-[11px]">
              <span>Company:</span>
              <span className="font-bold text-zinc-100 text-xs">{confirmingBooth?.client_name}</span>
            </div>
            <div className="flex items-center justify-between text-zinc-400 text-[11px]">
              <span>Exhibition:</span>
              <span className="font-medium text-zinc-200">{confirmingBooth?.event_name || 'Selected Exhibition'}</span>
            </div>
            {confirmingBooth?.phone && (
              <div className="flex items-center justify-between text-zinc-400 text-[11px]">
                <span>Contact:</span>
                <span className="font-mono text-zinc-300">{confirmingBooth.phone}</span>
              </div>
            )}
            {confirmingBooth?.discussion_remark && (
              <div className="text-zinc-400 text-[11px] pt-1 border-t border-white/[0.04]">
                <span className="text-zinc-500 block">Discussion Remark:</span>
                <span className="italic text-zinc-300">"{confirmingBooth.discussion_remark}"</span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-zinc-300 font-semibold">
              Allot Stall / Booth Number <span className="text-amber-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={confirmStallNumber}
              onChange={(e) => setConfirmStallNumber(e.target.value)}
              placeholder="e.g. A-12, B-05, D-02..."
              className="w-full bg-[#1c1f2a] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 font-mono transition-all"
            />
          </div>

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-amber-400" />
              <span>What happens upon confirmation:</span>
            </p>
            <ul className="list-disc list-inside text-zinc-400 space-y-0.5 pl-1">
              <li>Initializes the 5-section production & design checklist.</li>
              <li>Moves this stall to the Confirmed Stalls directory.</li>
              <li>Updates dashboard statistics immediately.</li>
            </ul>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setConfirmingBooth(null)}
              disabled={confirmSubmitting}
              className="px-4 py-2 rounded-xl border border-white/[0.08] text-zinc-400 hover:text-zinc-200 text-xs font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={confirmSubmitting}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-md shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {confirmSubmitting ? (
                <span>Confirming...</span>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirm Stall</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Archive Booth Modal */}
      <Modal
        isOpen={archivingBooth !== null}
        onClose={() => setArchivingBooth(null)}
        title="Confirm Safe Archiving"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <p className="text-zinc-300">
            Are you sure you want to archive booth{' '}
            <span className="font-bold text-zinc-100">{archivingBooth?.booth_number}</span> (
            {archivingBooth?.client_name})?
          </p>
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setArchivingBooth(null)}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleArchiveConfirm}
              disabled={editSubmitting}
              className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold rounded-xl cursor-pointer"
            >
              {editSubmitting ? 'Archiving...' : 'Archive Booth'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Floor Plan Viewer */}
      <FloorplanViewerModal
        isOpen={isFloorplanOpen}
        onClose={() => setIsFloorplanOpen(false)}
        eventId={events.find((e) => e.id === selectedEventId)?.id || events[0]?.id}
        eventName={events.find((e) => e.id === selectedEventId)?.name || events[0]?.name || 'Exhibition Floor Plan'}
        pdfUrl={events.find((e) => e.id === selectedEventId)?.floor_plan_url || events[0]?.floor_plan_url || null}
        onUpdatePdfUrl={async (newUrl) => {
          const targetEvt = events.find((e) => e.id === selectedEventId) || events[0];
          if (targetEvt) {
            await updateEvent(targetEvt.id, { floor_plan_url: newUrl });
            await loadData();
          }
        }}
      />

      {/* Delete Stall Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deletingBooth !== null}
        onClose={() => setDeletingBooth(null)}
        type="stall"
        itemName={`Stall #${deletingBooth?.booth_number || ''} — ${deletingBooth?.client_name || ''}`}
        itemSubtext={`${deletingBooth?.event_name || 'Exhibition'} • ${deletingBooth?.stand_size || ''}`}
        onConfirmDelete={async () => {
          if (deletingBooth) {
            await deleteBooth(deletingBooth.id);
            setDeletingBooth(null);
            await loadData();
          }
        }}
        onArchiveInstead={async () => {
          if (deletingBooth) {
            await archiveBooth(deletingBooth.id);
            setDeletingBooth(null);
            await loadData();
          }
        }}
      />

      {/* Printable Stall Checklist Modal */}
      <PrintChecklistModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title={printModalTitle}
        subtitle={printModalSubtitle}
        stalls={printStallsData}
      />
    </div>
  );
}
