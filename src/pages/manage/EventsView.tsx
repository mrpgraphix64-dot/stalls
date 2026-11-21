import React, { useEffect, useState, useRef, useMemo } from 'react';
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
  Trash2,
  FileText,
} from 'lucide-react';
import { fetchEvents, createEvent, updateEvent, archiveEvent, deleteEvent } from './api';
import { EventItem, EventStatus } from './types';
import { Modal } from './Modal';
import { DateRangePicker } from './DateRangePicker';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { FloorplanViewerModal } from './FloorplanViewerModal';
import {
  getEventsViewState,
  saveEventsViewState,
  consumeEventsRestoration,
  restoreScrollAndHighlight,
} from './scrollRestoration';

interface EventsViewProps {
  onNavigate: (route: string) => void;
  createModalOpen?: boolean;
  onCloseCreateModal?: () => void;
}

export function EventsView({ onNavigate, createModalOpen = false, onCloseCreateModal }: EventsViewProps) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Restore previous filters/sorting if returning from Event Details
  const initialSavedState = useMemo(() => getEventsViewState(), []);
  const [search, setSearch] = useState<string>(initialSavedState?.search ?? '');
  const [statusFilter, setStatusFilter] = useState<string>(initialSavedState?.statusFilter ?? 'all');

  // Smart Navigation & Scroll Position Preservation
  const handleOpenEvent = (evtId: string) => {
    saveEventsViewState({
      scrollY: window.scrollY,
      search,
      statusFilter,
      lastOpenedEventId: evtId,
      needsRestoration: true,
    });
    onNavigate(`event:${evtId}`);
  };

  const restorationAttemptedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!loading && events.length > 0 && !restorationAttemptedRef.current) {
      const state = consumeEventsRestoration();
      if (state && state.needsRestoration) {
        restorationAttemptedRef.current = true;
        restoreScrollAndHighlight(state.lastOpenedEventId, state.scrollY, {
          dataAttr: 'data-event-id',
        });
      }
    }
  }, [loading, events]);

  // Modals
  const [isAddOpen, setIsAddOpen] = useState<boolean>(createModalOpen);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [archivingEvent, setArchivingEvent] = useState<EventItem | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<EventItem | null>(null);
  const [floorplanEvent, setFloorplanEvent] = useState<EventItem | null>(null);

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
  const [formFloorPlanUrl, setFormFloorPlanUrl] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    venue?: string;
    city?: string;
    startDate?: string;
    endDate?: string;
    floorPlanUrl?: string;
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
    setFormFloorPlanUrl('');
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
    setFormFloorPlanUrl(evt.floor_plan_url || '');
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

    if (formFloorPlanUrl.trim()) {
      const trimmedPdf = formFloorPlanUrl.trim();
      if (!trimmedPdf.startsWith('http://') && !trimmedPdf.startsWith('https://') && !trimmedPdf.startsWith('/')) {
        errors.floorPlanUrl = 'Floor plan URL must start with http://, https://, or /';
      } else if (!/\.pdf($|\?|#)/i.test(trimmedPdf) && !/drive\.google\.com/i.test(trimmedPdf)) {
        errors.floorPlanUrl = 'Floor plan link must be a direct PDF file (.pdf) or authorized document link.';
      }
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
        floor_plan_url: formFloorPlanUrl.trim() || undefined,
      };

      if (editingEvent) {
        payload.setup_date = formSetupDate || undefined;
        payload.dismantling_date = formDismantlingDate || undefined;
        payload.status = formStatus;
        await updateEvent(editingEvent.id, payload);
        setEditingEvent(null);
        setSuccessToast('Exhibition updated successfully.');
      } else {
        const created = await createEvent(payload);
        setIsAddOpen(false);
        if (onCloseCreateModal) onCloseCreateModal();
        if (created && created.id) {
          onNavigate(`event:${created.id}`);
          return;
        }
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
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {events.length}
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">Organize exhibitions, manage locus venues, and track assigned booths</p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold rounded-xl transition-all shadow-sm shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ New Event</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search exhibitions by name, venue, or city..."
            className="w-full bg-[#15171e] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500/80 transition-all"
          />
        </form>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'upcoming', 'live', 'completed'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-xl capitalize whitespace-nowrap transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 font-semibold'
                  : 'bg-[#15171e] text-zinc-400 border border-white/[0.07] hover:text-zinc-200'
              }`}
            >
              {st === 'all' ? 'All Events' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-zinc-400 gap-3">
          <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          <span className="text-xs">Loading exhibitions...</span>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center space-y-3">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={loadEvents}
            className="px-4 py-2 bg-white/[0.06] hover:bg-white/[0.12] text-zinc-200 text-xs font-semibold rounded-xl"
          >
            Retry
          </button>
        </div>
      ) : events.length === 0 ? (
        <div className="bg-[#15171e] border border-dashed border-white/[0.1] rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto text-zinc-500">
            <Calendar className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-zinc-300">No events found</p>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            {search || statusFilter !== 'all'
              ? 'Try adjusting your search keywords or filter.'
              : 'Get started by creating your first exhibition event.'}
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold rounded-xl transition-all shadow-sm shadow-amber-500/20 mt-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Event</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {events.map((evt) => (
            <div
              key={evt.id}
              data-event-id={evt.id}
              onClick={() => handleOpenEvent(evt.id)}
              className="group cursor-pointer bg-[#15171e] hover:bg-[#191c25] border border-white/[0.07] hover:border-white/[0.14] rounded-2xl p-5 transition-all shadow-sm flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-zinc-100 group-hover:text-amber-400 transition-colors line-clamp-1">
                    {evt.name}
                  </h3>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {evt.confirmed_booth_count ?? evt.booth_count ?? 0} {((evt.confirmed_booth_count ?? evt.booth_count) === 1) ? 'stall' : 'stalls'}
                    </span>
                    {(evt.discussion_booth_count ?? 0) > 0 && (
                      <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20" title={`${evt.discussion_booth_count} ongoing discussion(s)`}>
                        +{evt.discussion_booth_count} disc.
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-zinc-400">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
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
                  <p className="text-xs text-zinc-500 line-clamp-2 italic pt-1 border-t border-white/[0.04]">
                    "{evt.notes}"
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] text-xs">
                <span className="text-[11px] font-medium text-amber-400 group-hover:underline flex items-center gap-1">
                  <span>Open Exhibition</span>
                  <ChevronRight className="w-3 h-3" />
                </span>

                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFloorplanEvent(evt);
                    }}
                    className="p-1.5 text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer"
                    title="View Floor Plan"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => openEditModal(evt, e)}
                    className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] rounded-lg transition-colors cursor-pointer"
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
                      className="p-1.5 text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Archive Event"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingEvent(evt);
                    }}
                    className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                    title="Delete Event"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
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

          {/* 3. Event Dates via DateRangePicker */}
          <DateRangePicker
            startDate={formStartDate}
            endDate={formEndDate}
            onChange={(s, e) => {
              setFormStartDate(s);
              setFormEndDate(e);
              if (fieldErrors.startDate) setFieldErrors((prev) => ({ ...prev, startDate: undefined }));
              if (fieldErrors.endDate) setFieldErrors((prev) => ({ ...prev, endDate: undefined }));
            }}
            error={fieldErrors.startDate || fieldErrors.endDate}
          />

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

          {/* 4. Floor Plan PDF URL (Optional) */}
          <div>
            <label className="block text-xs text-zinc-300 font-medium mb-1.5">
              Floor Plan PDF URL <span className="text-zinc-500 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={formFloorPlanUrl}
              onChange={(e) => {
                setFormFloorPlanUrl(e.target.value);
                if (fieldErrors.floorPlanUrl) setFieldErrors((prev) => ({ ...prev, floorPlanUrl: undefined }));
              }}
              placeholder="e.g. https://domain.com/layout.pdf or /floorplans/OVERALL_VENUE_LAYOUT_IT_EXPO_R5.pdf"
              className={`w-full bg-zinc-950 border ${
                fieldErrors.floorPlanUrl ? 'border-red-500/80 focus:border-red-500' : 'border-zinc-800 focus:border-amber-500/80'
              } rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none transition-colors h-10 font-mono`}
            />
            {fieldErrors.floorPlanUrl && <p className="text-[11px] text-red-400 mt-1">{fieldErrors.floorPlanUrl}</p>}
          </div>

          {/* 5. Notes (Optional) */}
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
      {/* Delete Event Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deletingEvent !== null}
        onClose={() => setDeletingEvent(null)}
        type="event"
        itemName={deletingEvent?.name || ''}
        itemSubtext={`${deletingEvent?.venue || ''}, ${deletingEvent?.city || ''}`}
        stallsCount={deletingEvent?.booth_count || 0}
        onConfirmDelete={async () => {
          if (deletingEvent) {
            await deleteEvent(deletingEvent.id);
            setDeletingEvent(null);
            await loadEvents();
          }
        }}
        onArchiveInstead={async () => {
          if (deletingEvent) {
            await archiveEvent(deletingEvent.id);
            setDeletingEvent(null);
            await loadEvents();
          }
        }}
      />

      {/* High-Resolution Floor Plan Viewer Modal */}
      <FloorplanViewerModal
        isOpen={floorplanEvent !== null}
        onClose={() => setFloorplanEvent(null)}
        eventId={floorplanEvent?.id}
        eventName={floorplanEvent?.name || 'Exhibition Floor Plan'}
        pdfUrl={floorplanEvent?.floor_plan_url || null}
        onUpdatePdfUrl={async (newUrl) => {
          if (floorplanEvent) {
            await updateEvent(floorplanEvent.id, { floor_plan_url: newUrl });
            setFloorplanEvent((prev) => (prev ? { ...prev, floor_plan_url: newUrl } : null));
            await loadEvents();
          }
        }}
      />
    </div>
  );
}
