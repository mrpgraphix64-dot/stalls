import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Clock,
  Building,
  Plus,
  ExternalLink,
  Edit2,
  Archive,
  ChevronRight,
  FileText,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { fetchEvent, updateEvent, archiveEvent } from './api';
import { EventItem, BoothItem, EventStatus } from './types';
import { Modal } from './Modal';
import { FloorplanViewerModal } from './FloorplanViewerModal';

interface EventDetailViewProps {
  eventId: string;
  onNavigate: (route: string) => void;
  onOpenCreateBoothForEvent: (eventId: string) => void;
}

export function EventDetailView({ eventId, onNavigate, onOpenCreateBoothForEvent }: EventDetailViewProps) {
  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Modals
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState<boolean>(false);
  const [isFloorplanModalOpen, setIsFloorplanModalOpen] = useState<boolean>(false);

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

  const loadEvent = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchEvent(eventId);
      setEvent(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load event details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  const openEditModal = () => {
    if (!event) return;
    setFormName(event.name);
    setFormVenue(event.venue);
    setFormCity(event.city);
    setFormStartDate(event.start_date);
    setFormEndDate(event.end_date);
    setFormSetupDate(event.setup_date || '');
    setFormDismantlingDate(event.dismantling_date || '');
    setFormStatus(event.status);
    setFormNotes(event.notes || '');
    setFormError('');
    setFieldErrors({});
    setIsEditOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: typeof fieldErrors = {};

    if (!formName.trim() || formName.trim().length < 2) {
      errors.name = 'Event name must be at least 2 characters.';
    }
    if (!formVenue.trim() || formVenue.trim().length < 2) {
      errors.venue = 'Venue is required.';
    }
    if (!formCity.trim() || formCity.trim().length < 2) {
      errors.city = 'City is required.';
    }
    if (!formStartDate) {
      errors.startDate = 'Start date is required.';
    }
    if (!formEndDate) {
      errors.endDate = 'End date is required.';
    } else if (formStartDate && formEndDate < formStartDate) {
      errors.endDate = 'End date cannot be earlier than start date.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError('Please resolve the highlighted field errors.');
      return;
    }

    setFormSubmitting(true);
    setFormError('');
    setFieldErrors({});

    try {
      await updateEvent(eventId, {
        name: formName.trim(),
        venue: formVenue.trim(),
        city: formCity.trim(),
        start_date: formStartDate,
        end_date: formEndDate,
        setup_date: formSetupDate || undefined,
        dismantling_date: formDismantlingDate || undefined,
        status: formStatus,
        notes: formNotes.trim() || undefined,
      });
      setIsEditOpen(false);
      await loadEvent();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update event.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleArchiveConfirm = async () => {
    try {
      setFormSubmitting(true);
      await archiveEvent(eventId);
      setIsArchiveConfirmOpen(false);
      onNavigate('events');
    } catch (err: any) {
      alert(err.message || 'Failed to archive event.');
    } finally {
      setFormSubmitting(false);
    }
  };

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
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'archived':
        return 'bg-zinc-800 text-zinc-500 border-zinc-700';
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-zinc-400 gap-3">
        <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        <span className="text-sm">Loading exhibition hub...</span>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center space-y-3">
        <p className="text-red-400 text-sm">{error || 'Event not found.'}</p>
        <button
          onClick={() => onNavigate('events')}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg"
        >
          &larr; Return to Events Directory
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Navigation & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800/60">
        <button
          onClick={() => onNavigate('events')}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Exhibitions Directory
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsFloorplanModalOpen(true)}
            className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-medium rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
            <span>View Floor Plan</span>
          </button>
          <button
            onClick={openEditModal}
            className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-medium rounded-xl transition-colors flex items-center gap-1.5"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Edit Event
          </button>
          {event.status !== 'archived' && (
            <button
              onClick={() => setIsArchiveConfirmOpen(true)}
              className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 hover:text-red-400 text-xs font-medium rounded-xl transition-colors flex items-center gap-1.5"
            >
              <Archive className="w-3.5 h-3.5" />
              Archive
            </button>
          )}
          <button
            onClick={() => onOpenCreateBoothForEvent(event.id)}
            className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 text-xs font-bold rounded-xl transition-all shadow-md shadow-amber-500/10 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Booth to this Event
          </button>
        </div>
      </div>

      {/* Event Overview Hero Card */}
      <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-6 shadow-md space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span
                className={`px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md border ${getStatusBadge(
                  event.status
                )}`}
              >
                {event.status.replace('_', ' ')}
              </span>
              <span className="text-xs font-mono text-zinc-500">ID: {event.id}</span>
            </div>
            <h1 className="text-2xl font-extrabold text-zinc-100 tracking-tight">{event.name}</h1>
          </div>

          <div className="flex items-center gap-4 bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-3 shrink-0">
            <div className="text-center px-3 border-r border-zinc-800">
              <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Stalls</span>
              <div className="text-xl font-bold text-amber-400">{event.booth_count ?? 0}</div>
            </div>
            <div className="text-center px-3">
              <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Duration</span>
              <div className="text-xs font-mono font-medium text-zinc-300 mt-1">
                {event.start_date.slice(5)} &rarr; {event.end_date.slice(5)}
              </div>
            </div>
          </div>
        </div>

        {/* Schedule & Venue Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-zinc-800/60 text-xs">
          <div className="bg-zinc-950/40 rounded-xl p-3 border border-zinc-800/40 space-y-1">
            <span className="text-zinc-500 font-medium text-[11px] flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              Venue & City
            </span>
            <p className="font-semibold text-zinc-200">{event.venue}</p>
            <p className="text-zinc-400">{event.city}</p>
          </div>

          <div className="bg-zinc-950/40 rounded-xl p-3 border border-zinc-800/40 space-y-1">
            <span className="text-zinc-500 font-medium text-[11px] flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              Exhibition Dates
            </span>
            <p className="font-semibold font-mono text-zinc-200">{event.start_date}</p>
            <p className="text-zinc-400 font-mono text-[11px]">to {event.end_date}</p>
          </div>

          <div className="bg-zinc-950/40 rounded-xl p-3 border border-zinc-800/40 space-y-1">
            <span className="text-zinc-500 font-medium text-[11px] flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              Fabrication / Setup
            </span>
            <p className="font-semibold font-mono text-zinc-200">{event.setup_date || '—'}</p>
            <p className="text-zinc-500 text-[11px]">Handover by event eve</p>
          </div>

          <div className="bg-zinc-950/40 rounded-xl p-3 border border-zinc-800/40 space-y-1">
            <span className="text-zinc-500 font-medium text-[11px] flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-purple-400" />
              Dismantling
            </span>
            <p className="font-semibold font-mono text-zinc-200">{event.dismantling_date || '—'}</p>
            <p className="text-zinc-500 text-[11px]">Clearance deadline</p>
          </div>
        </div>

        {event.notes && (
          <div className="bg-zinc-950/40 rounded-xl p-3.5 border border-zinc-800/40 text-xs text-zinc-300 space-y-1">
            <span className="text-zinc-500 font-medium text-[11px] flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-amber-500" />
              Event Logistics & Special Instructions
            </span>
            <p className="whitespace-pre-line text-zinc-300">{event.notes}</p>
          </div>
        )}
      </div>

      {/* Booths Registered under this Event */}
      <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">
              Stalls In This Exhibition ({event.booths?.length ?? 0})
            </h2>
          </div>
          <button
            onClick={() => onOpenCreateBoothForEvent(event.id)}
            className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Another Stall
          </button>
        </div>

        {(!event.booths || event.booths.length === 0) ? (
          <div className="bg-zinc-950/50 border border-dashed border-zinc-800 rounded-xl p-8 text-center space-y-3">
            <p className="text-sm font-medium text-zinc-400">No stalls registered under this event yet</p>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Add booths for clients attending {event.name} to start tracking design links, fabrication, and handover.
            </p>
            <button
              onClick={() => onOpenCreateBoothForEvent(event.id)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-amber-400 text-xs font-semibold rounded-xl transition-colors mt-1"
            >
              <Plus className="w-4 h-4" />
              Register First Stall
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 font-medium">
                  <th className="pb-2.5">Stall / Booth #</th>
                  <th className="pb-2.5">Client Name</th>
                  <th className="pb-2.5">Contact Person</th>
                  <th className="pb-2.5">Stand Size</th>
                  <th className="pb-2.5">Status</th>
                  <th className="pb-2.5 text-right">Main Drive Folder</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {event.booths.map((b) => (
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
                      {b.contact_person ? `${b.contact_person} ${b.phone ? `(${b.phone})` : ''}` : '—'}
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
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-md border border-amber-500/20 text-[10px] font-medium transition-colors"
                          title="Open Google Drive Folder"
                        >
                          <span>Open Drive</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ) : (
                        <span className="text-zinc-600 text-[11px]">— No link</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Event Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Exhibition"
        subtitle="Update event details and scheduling"
        maxWidth="max-w-[580px]"
      >
        <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs" noValidate>
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

          {/* 4. Optional Setup & Dismantling Dates */}
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
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500/80 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none capitalize transition-colors h-10"
              >
                <option value="upcoming">Upcoming</option>
                <option value="in_progress">In Progress</option>
                <option value="live">Live / Ongoing</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          {/* 5. Notes */}
          <div>
            <label className="block text-xs text-zinc-300 font-medium mb-1.5">
              Notes & Special Instructions <span className="text-zinc-500 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="e.g. VIP hall, special access permits required"
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/30 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none resize-none transition-colors"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="px-4 py-2 bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 font-medium rounded-xl transition-colors text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-semibold rounded-xl transition-all shadow-md shadow-amber-500/10 disabled:opacity-50 text-xs"
            >
              {formSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Archive Event Modal */}
      <Modal
        isOpen={isArchiveConfirmOpen}
        onClose={() => setIsArchiveConfirmOpen(false)}
        title="Confirm Safe Archiving"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <p className="text-zinc-300">
            Are you sure you want to archive <span className="font-bold text-zinc-100">{event.name}</span>?
          </p>
          <p className="text-zinc-500">
            This will mark the event and its associated stalls as archived. You can still view archived records by filtering for "Archived".
          </p>
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setIsArchiveConfirmOpen(false)}
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

      {/* Pop-up Floor Plan Viewer */}
      <FloorplanViewerModal
        isOpen={isFloorplanModalOpen}
        onClose={() => setIsFloorplanModalOpen(false)}
      />
    </div>
  );
}
