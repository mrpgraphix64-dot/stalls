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
  Filter,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react';
import { fetchBooths, fetchEvents, createBooth, updateBooth, archiveBooth } from './api';
import { BoothItem, EventItem, BoothStatus } from './types';
import { Modal } from './Modal';

interface BoothsViewProps {
  onNavigate: (route: string) => void;
  createModalOpen?: boolean;
  defaultEventId?: string;
  onCloseCreateModal?: () => void;
}

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
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Modals
  const [isAddOpen, setIsAddOpen] = useState<boolean>(createModalOpen);
  const [editingBooth, setEditingBooth] = useState<BoothItem | null>(null);
  const [archivingBooth, setArchivingBooth] = useState<BoothItem | null>(null);

  // Form State
  const [formEventId, setFormEventId] = useState<string>(defaultEventId);
  const [formBoothNumber, setFormBoothNumber] = useState<string>('');
  const [formClientName, setFormClientName] = useState<string>('');
  const [formContactPerson, setFormContactPerson] = useState<string>('');
  const [formPhone, setFormPhone] = useState<string>('');
  const [formEmail, setFormEmail] = useState<string>('');
  const [formStandSize, setFormStandSize] = useState<string>('');
  const [formBoothType, setFormBoothType] = useState<string>('Custom Stall');
  const [formBudget, setFormBudget] = useState<string>('');
  const [formQuotedAmount, setFormQuotedAmount] = useState<string>('');
  const [formMainDriveUrl, setFormMainDriveUrl] = useState<string>('');
  const [formStatus, setFormStatus] = useState<BoothStatus>('draft');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);

  useEffect(() => {
    setIsAddOpen(createModalOpen);
    if (defaultEventId) {
      setFormEventId(defaultEventId);
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
          status: selectedStatus !== 'all' ? selectedStatus : undefined,
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
  }, [selectedEventId, selectedStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const openCreateModal = () => {
    setFormEventId(selectedEventId || (events[0]?.id ?? ''));
    setFormBoothNumber('');
    setFormClientName('');
    setFormContactPerson('');
    setFormPhone('');
    setFormEmail('');
    setFormStandSize('');
    setFormBoothType('Custom Stall');
    setFormBudget('');
    setFormQuotedAmount('');
    setFormMainDriveUrl('');
    setFormStatus('draft');
    setFormNotes('');
    setFormError('');
    setIsAddOpen(true);
  };

  const openEditModal = (bth: BoothItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingBooth(bth);
    setFormEventId(bth.event_id);
    setFormBoothNumber(bth.booth_number);
    setFormClientName(bth.client_name);
    setFormContactPerson(bth.contact_person || '');
    setFormPhone(bth.phone || '');
    setFormEmail(bth.email || '');
    setFormStandSize(bth.stand_size || '');
    setFormBoothType(bth.booth_type || 'Custom Stall');
    setFormBudget(bth.budget ? String(bth.budget) : '');
    setFormQuotedAmount(bth.quoted_amount ? String(bth.quoted_amount) : '');
    setFormMainDriveUrl(bth.main_drive_folder_url || '');
    setFormStatus(bth.status);
    setFormNotes(bth.notes || '');
    setFormError('');
  };

  const handleSaveBooth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEventId || !formBoothNumber.trim() || !formClientName.trim()) {
      setFormError('Please select an event and enter a stall number and client name.');
      return;
    }

    setFormSubmitting(true);
    setFormError('');

    try {
      const payload: Partial<BoothItem> = {
        event_id: formEventId,
        booth_number: formBoothNumber.trim(),
        client_name: formClientName.trim(),
        contact_person: formContactPerson.trim() || undefined,
        phone: formPhone.trim() || undefined,
        email: formEmail.trim() || undefined,
        stand_size: formStandSize.trim() || undefined,
        booth_type: formBoothType.trim() || undefined,
        budget: formBudget ? parseFloat(formBudget) : undefined,
        quoted_amount: formQuotedAmount ? parseFloat(formQuotedAmount) : undefined,
        main_drive_folder_url: formMainDriveUrl.trim() || undefined,
        status: formStatus,
        notes: formNotes.trim() || undefined,
      };

      if (editingBooth) {
        await updateBooth(editingBooth.id, payload);
        setEditingBooth(null);
      } else {
        await createBooth(payload);
        setIsAddOpen(false);
        if (onCloseCreateModal) onCloseCreateModal();
      }

      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save booth.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleArchiveConfirm = async () => {
    if (!archivingBooth) return;
    try {
      setFormSubmitting(true);
      await archiveBooth(archivingBooth.id);
      setArchivingBooth(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to archive booth.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const getStatusBadge = (status: BoothStatus) => {
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
      case 'archived':
        return 'bg-zinc-800 text-zinc-500 border-zinc-700';
      case 'draft':
      default:
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800/60">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
            Stalls & Booths Directory
            <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
              {booths.length}
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">Centralized directory of all exhibition stalls and Google Drive link hubs</p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 text-xs font-bold rounded-xl transition-all shadow-md shadow-amber-500/10 flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Register Stall
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by client, booth #, or contact..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500/60"
          />
        </form>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Event Filter */}
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/60"
          >
            <option value="">All Exhibitions</option>
            {events.map((evt) => (
              <option key={evt.id} value={evt.id}>
                {evt.name} ({evt.city})
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/60 capitalize"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="design">Design</option>
            <option value="approved">Approved</option>
            <option value="in_production">In Production</option>
            <option value="installed">Installed</option>
            <option value="handover">Handover</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-zinc-400 gap-3">
          <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          <span className="text-sm">Loading stalls directory...</span>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center space-y-3">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg"
          >
            Retry
          </button>
        </div>
      ) : booths.length === 0 ? (
        <div className="bg-zinc-900/40 border border-dashed border-zinc-800 rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
            <Layers className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-zinc-300">No stalls found</p>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            {search || selectedEventId || selectedStatus !== 'all'
              ? 'Try adjusting your search criteria or filters.'
              : 'Register your first stall to begin managing client designs and fabrication.'}
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-amber-400 text-xs font-semibold rounded-xl transition-colors mt-2"
          >
            <Plus className="w-4 h-4" />
            Register Stall
          </button>
        </div>
      ) : (
        <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 font-medium bg-zinc-950/40">
                  <th className="py-3.5 px-4">Stall / Booth #</th>
                  <th className="py-3.5 px-4">Client Name</th>
                  <th className="py-3.5 px-4">Exhibition</th>
                  <th className="py-3.5 px-4">Size & Type</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Google Drive</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {booths.map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => onNavigate(`booth:${b.id}`)}
                    className="group hover:bg-zinc-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-bold text-zinc-100 group-hover:text-amber-400 transition-colors">
                      {b.booth_number}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-zinc-200">{b.client_name}</div>
                      {b.contact_person && (
                        <div className="text-[11px] text-zinc-500">
                          {b.contact_person} {b.phone ? `• ${b.phone}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {b.event_name ? (
                        <div>
                          <div className="text-zinc-300 font-medium truncate max-w-[180px]">{b.event_name}</div>
                          <div className="text-[11px] text-zinc-500">{b.event_city}</div>
                        </div>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-zinc-400">
                      <div>{b.stand_size || '—'}</div>
                      <div className="text-[11px] text-zinc-500">{b.booth_type || 'Custom'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md border ${getStatusBadge(
                          b.status
                        )}`}
                      >
                        {b.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      {b.main_drive_folder_url ? (
                        <a
                          href={b.main_drive_folder_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/20 text-[11px] font-medium transition-colors"
                          title="Open Main Google Drive Folder"
                        >
                          <FolderOpen className="w-3 h-3" />
                          <span>Open Folder</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ) : (
                        <span className="text-zinc-600 text-[11px]">— No link</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => openEditModal(b, e)}
                          className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
                          title="Edit Stall"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {b.status !== 'archived' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setArchivingBooth(b);
                            }}
                            className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors"
                            title="Archive Stall"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <div className="pl-1 text-zinc-500 group-hover:text-amber-400 transition-colors">
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Booth Modal */}
      <Modal
        isOpen={isAddOpen || editingBooth !== null}
        onClose={() => {
          setIsAddOpen(false);
          setEditingBooth(null);
          if (onCloseCreateModal) onCloseCreateModal();
        }}
        title={editingBooth ? `Edit Stall: ${editingBooth.booth_number} (${editingBooth.client_name})` : 'Register New Exhibition Stall'}
      >
        <form onSubmit={handleSaveBooth} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-zinc-300 font-medium mb-1">
              Select Exhibition Event <span className="text-amber-500">*</span>
            </label>
            <select
              required
              value={formEventId}
              onChange={(e) => setFormEventId(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
            >
              <option value="">-- Choose Exhibition --</option>
              {events.map((evt) => (
                <option key={evt.id} value={evt.id}>
                  {evt.name} ({evt.city} • Starts {evt.start_date})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">
                Stall / Booth # <span className="text-amber-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formBoothNumber}
                onChange={(e) => setFormBoothNumber(e.target.value)}
                placeholder="e.g. Hall 3 - B04 or Stand A12"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">
                Client / Brand Name <span className="text-amber-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formClientName}
                onChange={(e) => setFormClientName(e.target.value)}
                placeholder="e.g. Tata Motors EV, Havells"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Contact Person</label>
              <input
                type="text"
                value={formContactPerson}
                onChange={(e) => setFormContactPerson(e.target.value)}
                placeholder="Client POC"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Phone</label>
              <input
                type="text"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="+91 ..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Email</label>
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="client@brand.com"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Stand Dimensions / Size</label>
              <input
                type="text"
                value={formStandSize}
                onChange={(e) => setFormStandSize(e.target.value)}
                placeholder="e.g. 12x8m (96 sqm) or 6x3m"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Structure Type</label>
              <select
                value={formBoothType}
                onChange={(e) => setFormBoothType(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
              >
                <option value="Custom Stall">Custom Stall</option>
                <option value="Octanorm / Modular">Octanorm / Modular</option>
                <option value="Island (4-Side Open)">Island (4-Side Open)</option>
                <option value="Peninsula (3-Side Open)">Peninsula (3-Side Open)</option>
                <option value="Corner (2-Side Open)">Corner (2-Side Open)</option>
                <option value="Inline / Row (1-Side Open)">Inline / Row (1-Side Open)</option>
              </select>
            </div>
          </div>

          {/* Main Google Drive Folder URL */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3.5 space-y-1.5">
            <label className="block text-amber-400 font-semibold flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5" />
              Main Google Drive Folder URL
            </label>
            <input
              type="url"
              value={formMainDriveUrl}
              onChange={(e) => setFormMainDriveUrl(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60 font-mono text-[11px]"
            />
            <p className="text-[11px] text-zinc-400">
              Paste the team Google Drive folder link for this stall. All 3D renders, working artwork, and print PDFs will be stored here.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Status</label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as BoothStatus)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60 capitalize"
              >
                <option value="draft">Draft</option>
                <option value="design">Design</option>
                <option value="approved">Approved</option>
                <option value="in_production">In Production</option>
                <option value="installed">Installed</option>
                <option value="handover">Handover</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Estimated Budget (₹)</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={formBudget}
                onChange={(e) => setFormBudget(e.target.value)}
                placeholder="400000"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Quoted Amount (₹)</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={formQuotedAmount}
                onChange={(e) => setFormQuotedAmount(e.target.value)}
                placeholder="550000"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Notes & Special Requirements</label>
            <textarea
              rows={2}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Fascia branding, LED screen size, carpet color, height restrictions..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => {
                setIsAddOpen(false);
                setEditingBooth(null);
                if (onCloseCreateModal) onCloseCreateModal();
              }}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold rounded-xl transition-all shadow-md shadow-amber-500/10 disabled:opacity-50"
            >
              {formSubmitting ? 'Saving...' : editingBooth ? 'Save Changes' : 'Register Stall'}
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
            Are you sure you want to archive stall{' '}
            <span className="font-bold text-zinc-100">{archivingBooth?.booth_number}</span> (
            {archivingBooth?.client_name})?
          </p>
          <p className="text-zinc-500">
            This will mark the stall as archived. All Google Drive links and notes are preserved. You can access archived stalls by selecting the "Archived" status filter.
          </p>
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setArchivingBooth(null)}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleArchiveConfirm}
              disabled={formSubmitting}
              className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold rounded-xl transition-colors"
            >
              {formSubmitting ? 'Archiving...' : 'Archive Stall'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
