import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { fetchBooths, fetchEvents, updateBooth, updateEvent, archiveBooth, deleteBooth } from './api';
import { BoothItem, EventItem } from './types';
import { Modal } from './Modal';
import { AddBoothModal } from './AddBoothModal';
import { FloorplanViewerModal } from './FloorplanViewerModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';

interface BoothsViewProps {
  onNavigate: (route: string) => void;
  createModalOpen?: boolean;
  defaultEventId?: string;
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
  onCloseCreateModal,
}: BoothsViewProps) {
  const [booths, setBooths] = useState<BoothItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Filters
  const [search, setSearch] = useState<string>('');
  const [selectedEventId, setSelectedEventId] = useState<string>(defaultEventId);
  const [structureFilter, setStructureFilter] = useState<'all' | 'wooden' | 'octonorm'>('all');

  // Modals
  const [isAddOpen, setIsAddOpen] = useState<boolean>(createModalOpen);
  const [editingBooth, setEditingBooth] = useState<BoothItem | null>(null);
  const [archivingBooth, setArchivingBooth] = useState<BoothItem | null>(null);
  const [deletingBooth, setDeletingBooth] = useState<BoothItem | null>(null);
  const [isFloorplanOpen, setIsFloorplanOpen] = useState<boolean>(false);

  // Edit Form State
  const [editBoothNumber, setEditBoothNumber] = useState<string>('');
  const [editCompanyName, setEditCompanyName] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editSize, setEditSize] = useState<string>('');
  const [editStructure, setEditStructure] = useState<'Wooden' | 'Octonorm'>('Wooden');
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
    setEditBoothNumber(bth.booth_number);
    setEditCompanyName(bth.client_name);
    setEditPhone(bth.phone || '');
    setEditSize(bth.stand_size || '3 × 3 m (9 sq.m)');
    const st = bth.booth_type?.toLowerCase().includes('octonorm') ? 'Octonorm' : 'Wooden';
    setEditStructure(st);
    setEditError('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBooth) return;

    if (!editBoothNumber.trim()) {
      setEditError('Booth number is required.');
      return;
    }
    if (!editCompanyName.trim()) {
      setEditError('Company name is required.');
      return;
    }

    setEditSubmitting(true);
    try {
      await updateBooth(editingBooth.id, {
        booth_number: editBoothNumber.trim(),
        client_name: editCompanyName.trim(),
        phone: editPhone.trim() || undefined,
        stand_size: editSize,
        booth_type: editStructure,
      });
      setEditingBooth(null);
      await loadData();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update booth.');
    } finally {
      setEditSubmitting(false);
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

  // Filter booths by structure
  const filteredBooths = booths.filter((b) => {
    if (structureFilter === 'wooden') {
      return !b.booth_type?.toLowerCase().includes('octonorm');
    }
    if (structureFilter === 'octonorm') {
      return b.booth_type?.toLowerCase().includes('octonorm');
    }
    return true;
  });

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

      {/* Filter and Search Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by client or booth #..."
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
              onClick={() => setStructureFilter('octonorm')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                structureFilter === 'octonorm'
                  ? 'bg-amber-500 text-zinc-950 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Octonorm
            </button>
          </div>
        </div>
      </div>

      {/* Directory Table */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-zinc-400 gap-3">
          <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          <span className="text-xs">Loading stalls directory...</span>
        </div>
      ) : filteredBooths.length === 0 ? (
        <div className="bg-[#15171e] border border-dashed border-white/[0.1] rounded-2xl p-12 text-center space-y-3">
          <p className="text-sm font-medium text-zinc-300">No stalls found</p>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            {search || selectedEventId
              ? 'No stalls match your active filters.'
              : 'Add your first booth to begin tracking checklist execution.'}
          </p>
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-xs transition-all cursor-pointer shadow-sm shadow-amber-500/20 mt-2"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Booth</span>
          </button>
        </div>
      ) : (
        <div className="bg-[#15171e] border border-white/[0.07] rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#121319] border-b border-white/[0.07] text-zinc-400 font-medium">
                <tr>
                  <th className="py-3 px-3.5">Booth #</th>
                  <th className="py-3 px-3.5">Company Name</th>
                  <th className="py-3 px-3.5">Mobile Number</th>
                  <th className="py-3 px-3.5">Booth Size</th>
                  <th className="py-3 px-3.5">Structure Type</th>
                  <th className="py-3 px-3.5">Checklist Progress</th>
                  <th className="py-3 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05] text-zinc-300">
                {filteredBooths.map((b) => {
                  const comp = b.tasks_completed ?? 0;
                  const total = b.task_count ?? 6;
                  const pct = total > 0 ? Math.round((comp / total) * 100) : 0;
                  const structure = b.booth_type?.toLowerCase().includes('octonorm')
                    ? 'Octonorm'
                    : 'Wooden';

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

                      <td className="py-3 px-3.5 font-mono text-zinc-400">
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

                      <td className="py-3 px-3.5 font-mono text-zinc-400">
                        {b.stand_size || '3 × 3 m'}
                      </td>

                      <td className="py-3 px-3.5">
                        <span className="px-2 py-0.5 rounded-md bg-[#191c25] border border-white/[0.08] font-medium text-zinc-300 text-[11px]">
                          {structure}
                        </span>
                      </td>

                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-24 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] text-zinc-400">
                            {comp}/{total} ({pct}%)
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onNavigate(`booth:${b.id}`)}
                            className="px-2.5 py-1 bg-white/[0.06] hover:bg-white/[0.12] text-zinc-200 text-[11px] font-semibold rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>Open</span>
                            <ChevronRight className="w-3 h-3 text-amber-400" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => openEditModal(b, e)}
                            className="p-1.5 hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors cursor-pointer"
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
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
        title={editingBooth ? `Edit Booth: #${editingBooth.booth_number}` : 'Edit Booth'}
        subtitle="Update the basic details for this booth"
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
              <label className="block text-zinc-300 font-semibold">Booth Number *</label>
              <input
                type="text"
                required
                value={editBoothNumber}
                onChange={(e) => setEditBoothNumber(e.target.value)}
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
            <label className="block text-zinc-300 font-semibold">Structure Type</label>
            <div className="grid grid-cols-2 gap-2">
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
                onClick={() => setEditStructure('Octonorm')}
                className={`p-2.5 rounded-xl border text-left cursor-pointer flex items-center justify-between ${
                  editStructure === 'Octonorm'
                    ? 'bg-amber-500/10 border-amber-500/60 text-amber-400 font-bold'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                }`}
              >
                <span>Octonorm</span>
                {editStructure === 'Octonorm' && <Check className="w-3.5 h-3.5 text-amber-400" />}
              </button>
            </div>
          </div>

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
    </div>
  );
}
