import React, { useEffect, useState, useRef } from 'react';
import {
  Calendar,
  Plus,
  Search,
  MapPin,
  Clock,
  Building,
  Edit2,
  Archive,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { fetchEvents, createEvent, updateEvent, archiveEvent } from './api';
import { EventItem, EventStatus } from './types';
import { Modal } from './Modal';

interface EventsViewProps {
  onNavigate: (route: string) => void;
  createModalOpen?: boolean;
  onCloseCreateModal?: () => void;
}

export function EventsView({ onNavigate, createModalOpen = false, onCloseCreateModal }: EventsViewProps) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals
  const [isAddOpen, setIsAddOpen] = useState<boolean>(createModalOpen);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [archivingEvent, setArchivingEvent] = useState<EventItem | null>(null);

  // Form State
  const [formName, setFormName] = useState<string>('');
  const [formVenue, setFormVenue] = useState<string>('');
  const [formCity, setFormCity] = useState<string>('');
  const [formStartDate, setFormStartDate] = useState<string>('');
  const [formEndDate, setFormEndDate] = useState<string>('');
  const [formSetupDate, setFormSetupDate] = useState<string>('');
  const [formDismantlingDate, setFormDismantlingDate] = useState<string>('');
  const [formStatus, setFormStatus] = useState<EventStatus>('upcoming');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    venue?: string;
    city?: string;
    startDate?: string;
    endDate?: string;
  }>({});
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string>('');

  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (createModalOpen) {
      openCreateModal();
    } else {
      setIsAddOpen(false);
    }
  }, [createModalOpen]);

  useEffect(() => {
    if (isAddOpen || editingEvent) {
      const timer = setTimeout(() => {
        nameInputRef.current?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isAddOpen, editingEvent]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchEvents({
        search: search.trim() || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setEvents(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load events.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadEvents();
  };

  const openCreateModal = () => {
    setFormName('');
    setFormVenue('');
    setFormCity('');
    setFormStartDate('');
    setFormEndDate('');
    setFormSetupDate('');
    setFormDismantlingDate('');
    setFormStatus('upcoming');
    setFormNotes('');
    setFormError('');
    setFieldErrors({});
    setIsAddOpen(true);
  };

  const openEditModal = (evt: EventItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEvent(evt);
    setFormName(evt.name);
    setFormVenue(evt.venue);
    setFormCity(evt.city);
    setFormStartDate(evt.start_date);
    setFormEndDate(evt.end_date);
    setFormSetupDate(evt.setup_date || '');
    setFormDismantlingDate(evt.dismantling_date || '');
    setFormStatus(evt.status);
    setFormNotes(evt.notes || '');
    setFormError('');
    setFieldErrors({});
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: typeof fieldErrors = {};
    if (!formName.trim()) {
      errors.name = 'Event / Exhibition name is required.';
    }
    if (!formVenue.trim()) {
      errors.venue = 'Venue location is required.';
    }
    if (!formCity.trim()) {
      errors.city = 'City is required.';
    }
    if (!formStartDate) {
      errors.startDate = 'Start date is required.';
    }
    if (!formEndDate) {
      errors.endDate = 'End date is required.';
    }
    if (formStartDate && formEndDate && formEndDate < formStartDate) {
      errors.endDate = 'End date cannot be earlier than start date.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError('Please resolve the errors highlighted below.');
      return;
    }

    setFormSubmitting(true);
    setFormError('');
    setFieldErrors({});

    try {
      const payload: Partial<EventItem> = {
        name: formName.trim(),
        venue: formVenue.trim(),
        city: formCity.trim(),
        start_date: formStartDate,
        end_date: formEndDate,
        notes: formNotes.trim() || undefined,
      };

      if (editingEvent) {
        payload.setup_date = formSetupDate || undefined;
        payload.dismantling_date = formDismantlingDate || undefined;
        payload.status = formStatus;
        await updateEvent(editingEvent.id, payload);
        setEditingEvent(null);
        setSuccessToast('Exhibition updated successfully.');
      } else {
        await createEvent(payload);
        setIsAddOpen(false);
        if (onCloseCreateModal) onCloseCreateModal();
        setSuccessToast('Exhibition created successfully.');
      }

      await loadEvents();
      setTimeout(() => setSuccessToast(''), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save event.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleArchiveConfirm = async () => {
    if (!archivingEvent) return;
    try {
      setFormSubmitting(true);
      await archiveEvent(archivingEvent.id);
      setArchivingEvent(null);
      await loadEvents();
    } catch (err: any) {
      alert(err.message || 'Failed to archive event.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const getStatusBadge = (status: EventStatus) => {
    switch (status) {
      case 'live':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse';
      case 'in_progress':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'completed':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'archived':
        return 'bg-zinc-800 text-zinc-500 border-zinc-700';
      case 'upcoming':
      default:
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {successToast && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast('')} className="text-zinc-500 hover:text-zinc-300 text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800/60">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
            Exhibitions & Events
            <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
              {events.length}
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">Manage scheduled trade shows, dates, venues, and registered stalls</p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 text-xs font-bold rounded-xl transition-all shadow-md shadow-amber-500/10 flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Exhibition
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, venue, or city..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500/60 transition-colors"
          />
        </form>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'upcoming', 'live', 'in_progress', 'completed', 'archived'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize whitespace-nowrap transition-colors ${
                statusFilter === st
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-zinc-400 gap-3">
          <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          <span className="text-sm">Loading events...</span>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center space-y-3">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={loadEvents}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg"
          >
            Retry
          </button>
        </div>
      ) : events.length === 0 ? (
        <div className="bg-zinc-900/40 border border-dashed border-zinc-800 rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
            <Calendar className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-zinc-300">No events found</p>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            {search || statusFilter !== 'all'
              ? 'Try adjusting your search keywords or status filter.'
              : 'Get started by creating your first exhibition event.'}
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-amber-400 text-xs font-semibold rounded-xl transition-colors mt-2"
          >
            <Plus className="w-4 h-4" />
            Add First Event
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {events.map((evt) => (
            <div
              key={evt.id}
              onClick={() => onNavigate(`event:${evt.id}`)}
              className="group cursor-pointer bg-zinc-900/90 hover:bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 rounded-2xl p-5 transition-all shadow-sm flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-bold text-zinc-100 group-hover:text-amber-400 transition-colors line-clamp-1">
                    {evt.name}
                  </h3>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md border shrink-0 ${getStatusBadge(
                      evt.status
                    )}`}
                  >
                    {evt.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-zinc-400">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-500/80 shrink-0" />
                    <span className="truncate">
                      {evt.venue}, {evt.city}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-400">
                    <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    <span>
                      {evt.start_date} &rarr; {evt.end_date}
                    </span>
                  </div>
                </div>

                {evt.notes && (
                  <p className="text-xs text-zinc-500 line-clamp-2 italic pt-1 border-t border-zinc-800/40">
                    "{evt.notes}"
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-zinc-800/60 text-xs">
                <div className="flex items-center gap-1 text-zinc-400">
                  <Building className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="font-semibold text-zinc-200">{evt.booth_count ?? 0}</span>
                  <span className="text-zinc-500">{evt.booth_count === 1 ? 'stall' : 'stalls'}</span>
                </div>

                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => openEditModal(evt, e)}
                    className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
                    title="Edit Event"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  {evt.status !== 'archived' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setArchivingEvent(evt);
                      }}
                      className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors"
                      title="Archive Event"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <div className="pl-1 text-zinc-500 group-hover:text-amber-400 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Event Modal */}
      <Modal
        isOpen={isAddOpen || editingEvent !== null}
        onClose={() => {
          setIsAddOpen(false);
          setEditingEvent(null);
          if (onCloseCreateModal) onCloseCreateModal();
        }}
        title={editingEvent ? 'Edit Exhibition' : 'Create Exhibition'}
        subtitle={editingEvent ? 'Update event details and scheduling' : 'Add a new event to manage its booths'}
        maxWidth="max-w-[580px]"
      >
        <form onSubmit={handleSaveEvent} className="space-y-3.5 text-xs" noValidate>
          {formError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* 1. Event Name (Full Width) */}
          <div>
            <label className="block text-xs text-zinc-300 font-medium mb-1.5">
              Event / Exhibition Name <span className="text-amber-500">*</span>
            </label>
            <input
              ref={nameInputRef}
              type="text"
              required
              value={formName}
              onChange={(e) => {
                setFormName(e.target.value);
                if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
              }}
              placeholder="e.g. Bharat Mobility Global Expo 2027"
              className={`w-full bg-zinc-950 border ${
                fieldErrors.name ? 'border-red-500/80 focus:border-red-500' : 'border-zinc-800 focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/30'
              } rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none transition-colors h-10`}
            />
            {fieldErrors.name && <p className="text-[11px] text-red-400 mt-1">{fieldErrors.name}</p>}
          </div>

          {/* 2. Venue & City (Two columns on desktop, stacked on mobile) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs text-zinc-300 font-medium mb-1.5">
                Venue <span className="text-amber-500">*</span>
              </label>
              <div className="relative">
                <MapPin className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={formVenue}
                  onChange={(e) => {
                    setFormVenue(e.target.value);
                    if (fieldErrors.venue) setFieldErrors((prev) => ({ ...prev, venue: undefined }));
                  }}
                  placeholder="e.g. Pragati Maidan / BIEC"
                  className={`w-full bg-zinc-950 border ${
                    fieldErrors.venue ? 'border-red-500/80 focus:border-red-500' : 'border-zinc-800 focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/30'
                  } rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none transition-colors h-10`}
                />
              </div>
              {fieldErrors.venue && <p className="text-[11px] text-red-400 mt-1">{fieldErrors.venue}</p>}
            </div>
            <div>
              <label className="block text-xs text-zinc-300 font-medium mb-1.5">
                City <span className="text-amber-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formCity}
                onChange={(e) => {
                  setFormCity(e.target.value);
                  if (fieldErrors.city) setFieldErrors((prev) => ({ ...prev, city: undefined }));
                }}
                placeholder="e.g. New Delhi, Mumbai"
                className={`w-full bg-zinc-950 border ${
                  fieldErrors.city ? 'border-red-500/80 focus:border-red-500' : 'border-zinc-800 focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/30'
                } rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none transition-colors h-10`}
              />
              {fieldErrors.city && <p className="text-[11px] text-red-400 mt-1">{fieldErrors.city}</p>}
            </div>
          </div>

          {/* 3. Event Dates (Two columns on desktop, stacked on mobile) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs text-zinc-300 font-medium mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-500/80" />
                Event Start Date <span className="text-amber-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formStartDate}
                onChange={(e) => {
                  setFormStartDate(e.target.value);
                  if (fieldErrors.startDate) setFieldErrors((prev) => ({ ...prev, startDate: undefined }));
                  if (formEndDate && e.target.value && formEndDate < e.target.value) {
                    setFieldErrors((prev) => ({ ...prev, endDate: 'End date cannot be earlier than start date.' }));
                  } else if (fieldErrors.endDate === 'End date cannot be earlier than start date.') {
                    setFieldErrors((prev) => ({ ...prev, endDate: undefined }));
                  }
                }}
                className={`w-full bg-zinc-950 border ${
                  fieldErrors.startDate ? 'border-red-500/80 focus:border-red-500' : 'border-zinc-800 focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/30'
                } rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none [color-scheme:dark] transition-colors h-10`}
              />
              {fieldErrors.startDate && <p className="text-[11px] text-red-400 mt-1">{fieldErrors.startDate}</p>}
            </div>
            <div>
              <label className="block text-xs text-zinc-300 font-medium mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-500/80" />
                Event End Date <span className="text-amber-500">*</span>
              </label>
              <input
                type="date"
                required
                min={formStartDate || undefined}
                value={formEndDate}
                onChange={(e) => {
                  setFormEndDate(e.target.value);
                  if (fieldErrors.endDate) setFieldErrors((prev) => ({ ...prev, endDate: undefined }));
                  if (formStartDate && e.target.value && e.target.value < formStartDate) {
                    setFieldErrors((prev) => ({ ...prev, endDate: 'End date cannot be earlier than start date.' }));
                  }
                }}
                className={`w-full bg-zinc-950 border ${
                  fieldErrors.endDate ? 'border-red-500/80 focus:border-red-500' : 'border-zinc-800 focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/30'
                } rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none [color-scheme:dark] transition-colors h-10`}
              />
              {fieldErrors.endDate && <p className="text-[11px] text-red-400 mt-1">{fieldErrors.endDate}</p>}
            </div>
          </div>

          {/* Edit Only Optional Fields: Setup Date, Dismantling Date, and Status */}
          {editingEvent && (
            <div className="space-y-3.5 pt-1 border-t border-zinc-800/60">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs text-zinc-400 font-medium mb-1.5">
                    Setup / Fabrication Date <span className="text-zinc-600 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="date"
                    value={formSetupDate}
                    onChange={(e) => setFormSetupDate(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500/80 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none [color-scheme:dark] transition-colors h-10"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 font-medium mb-1.5">
                    Dismantling Date <span className="text-zinc-600 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="date"
                    value={formDismantlingDate}
                    onChange={(e) => setFormDismantlingDate(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500/80 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none [color-scheme:dark] transition-colors h-10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-300 font-medium mb-1.5">Event Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as EventStatus)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500/80 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none h-10 capitalize cursor-pointer transition-colors"
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="in_progress">In Progress</option>
                  <option value="live">Live / Ongoing</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
          )}

          {/* 4. Notes (Optional) */}
          <div>
            <label className="block text-xs text-zinc-400 font-medium mb-1.5">
              Notes <span className="text-zinc-600 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Hall logistics, gate access rules, badge requirements..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/30 transition-colors resize-none"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={() => {
                setIsAddOpen(false);
                setEditingEvent(null);
                if (onCloseCreateModal) onCloseCreateModal();
              }}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 text-xs font-bold rounded-xl transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {formSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {editingEvent ? 'Saving...' : 'Creating Event...'}
                </>
              ) : (
                editingEvent ? 'Save Changes' : 'Create Event'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Archive Event Confirmation Modal */}
      <Modal
        isOpen={archivingEvent !== null}
        onClose={() => setArchivingEvent(null)}
        title="Confirm Safe Archiving"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <p className="text-zinc-300">
            Are you sure you want to archive <span className="font-bold text-zinc-100">{archivingEvent?.name}</span>?
          </p>
          <p className="text-zinc-500">
            This will mark the event and its associated stalls as archived. No data will be deleted, and you can still view archived records by filtering for "Archived".
          </p>
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setArchivingEvent(null)}
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
              {formSubmitting ? 'Archiving...' : 'Archive Event'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
