import React, { useEffect, useState, useRef } from 'react';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Clock,
  Building,
  Edit2,
  Archive,
  ChevronRight,
  Plus,
  Loader2,
  AlertTriangle,
  FileText,
  ExternalLink,
  Layers,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { fetchEvent, updateEvent, archiveEvent, deleteEvent, deleteBooth, archiveBooth } from './api';
import { EventItem, EventStatus, BoothItem } from './types';
import { Modal } from './Modal';
import { AddBoothModal } from './AddBoothModal';
import { FloorplanViewerModal } from './FloorplanViewerModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';

interface EventDetailViewProps {
  eventId: string;
  onNavigate: (route: string) => void;
  onOpenCreateBoothForEvent?: (eventId: string) => void;
}

export function EventDetailView({
  eventId,
  onNavigate,
  onOpenCreateBoothForEvent,
}: EventDetailViewProps) {
  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Modals
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState<boolean>(false);
  const [isDeleteEventOpen, setIsDeleteEventOpen] = useState<boolean>(false);
  const [deletingBooth, setDeletingBooth] = useState<BoothItem | null>(null);
  const [isFloorplanModalOpen, setIsFloorplanModalOpen] = useState<boolean>(false);
  const [isAddBoothOpen, setIsAddBoothOpen] = useState<boolean>(false);

  // Edit Form State
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
    setFormFloorPlanUrl(event.floor_plan_url || '');
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
        floor_plan_url: formFloorPlanUrl.trim() || undefined,
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

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-zinc-400 gap-3">
        <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        <span className="text-xs">Loading exhibition details...</span>
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
          Back to Events Directory
        </button>
      </div>
    );
  }

  const boothsList = event.booths || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200 max-w-5xl mx-auto">
      {/* Navigation & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800/60">
        <button
          onClick={() => onNavigate('events')}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Exhibitions Directory</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsFloorplanModalOpen(true)}
            className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-medium rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
            <span>View Floor Plan</span>
          </button>

          <button
            type="button"
            onClick={() => setIsFloorplanModalOpen(true)}
            className="px-3.5 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-amber-400 text-xs font-medium rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            title="View Official Vector Floor Plan"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Floor Plan</span>
          </button>

          <button
            onClick={openEditModal}
            className="px-3.5 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-300 text-xs font-medium rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit Event</span>
          </button>

          {event.status !== 'archived' && (
            <button
              onClick={() => setIsArchiveConfirmOpen(true)}
              className="px-3 py-2 bg-white/[0.04] hover:bg-amber-500/10 border border-white/[0.08] text-zinc-400 hover:text-amber-400 text-xs font-medium rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              title="Archive Event"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsDeleteEventOpen(true)}
            className="px-3 py-2 bg-white/[0.04] hover:bg-red-500/10 border border-white/[0.08] text-zinc-400 hover:text-red-400 text-xs font-medium rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            title="Delete Event"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Prominent + Add Booth button */}
          <button
            type="button"
            onClick={() => setIsAddBoothOpen(true)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold rounded-xl transition-all shadow-sm shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Booth</span>
          </button>
        </div>
      </div>

      {/* Event Overview Hero Card */}
      <div className="bg-[#15171e] border border-white/[0.07] rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
              Exhibition Locus
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight">
              {event.name}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 pt-1">
              <span className="flex items-center gap-1.5 text-zinc-300">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                {event.venue}, {event.city}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5 font-mono text-zinc-300">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                {event.start_date} &rarr; {event.end_date}
              </span>
            </div>
          </div>

          <div className="bg-[#121319] border border-white/[0.06] rounded-xl px-4 py-3 shrink-0 text-center">
            <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
              Total Managed Stalls
            </span>
            <div className="text-2xl font-black text-amber-400 font-mono">
              {boothsList.length}
            </div>
          </div>
        </div>

        {event.notes && (
          <div className="bg-[#191c25] rounded-xl p-3 border border-white/[0.04] text-xs text-zinc-400">
            <span className="font-semibold text-zinc-300">Notes: </span>
            {event.notes}
          </div>
        )}
      </div>

      {/* Booths List under this Event */}
      <div className="bg-[#15171e] border border-white/[0.07] rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <h2 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">
              Booths Registered Under This Event ({boothsList.length})
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setIsAddBoothOpen(true)}
            className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Booth</span>
          </button>
        </div>

        {boothsList.length === 0 ? (
          <div className="bg-[#191c25] border border-dashed border-white/[0.08] rounded-xl p-10 text-center space-y-3">
            <p className="text-sm font-medium text-zinc-300">No booths added to this event yet</p>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Add client booths attending {event.name} to track design links, print graphics, and checklist execution.
            </p>
            <button
              type="button"
              onClick={() => setIsAddBoothOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm shadow-amber-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Booth</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto border border-white/[0.07] rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#121319] border-b border-white/[0.07] text-zinc-400 font-medium">
                <tr>
                  <th className="py-3 px-3.5">Booth #</th>
                  <th className="py-3 px-3.5">Company Name</th>
                  <th className="py-3 px-3.5">Mobile</th>
                  <th className="py-3 px-3.5">Size</th>
                  <th className="py-3 px-3.5">Structure</th>
                  <th className="py-3 px-3.5">Checklist Progress</th>
                  <th className="py-3 px-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05] text-zinc-300">
                {boothsList.map((b) => {
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
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingBooth(b);
                            }}
                            className="p-1 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
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
        )}
      </div>

      {/* Add Booth Modal (Directly integrated with preselected event) */}
      <AddBoothModal
        isOpen={isAddBoothOpen}
        onClose={() => setIsAddBoothOpen(false)}
        events={[event]}
        defaultEventId={event.id}
        existingBooths={boothsList}
        onSuccess={(newBooth) => {
          setIsAddBoothOpen(false);
          loadEvent();
          onNavigate(`booth:${newBooth.id}`);
        }}
      />

      {/* Edit Event Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Exhibition"
        subtitle="Update exhibition details and dates"
        maxWidth="max-w-[560px]"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4 text-xs" noValidate>
          {formError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-zinc-300 font-semibold">Event Name *</label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-zinc-300 font-semibold">Venue *</label>
              <input
                type="text"
                required
                value={formVenue}
                onChange={(e) => setFormVenue(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-zinc-300 font-semibold">City *</label>
              <input
                type="text"
                required
                value={formCity}
                onChange={(e) => setFormCity(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-zinc-300 font-semibold">Start Date *</label>
              <input
                type="date"
                required
                value={formStartDate}
                onChange={(e) => setFormStartDate(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-zinc-300 font-semibold">End Date *</label>
              <input
                type="date"
                required
                min={formStartDate || undefined}
                value={formEndDate}
                onChange={(e) => setFormEndDate(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-zinc-300 font-semibold">Floor Plan PDF URL (Optional)</label>
            <input
              type="text"
              value={formFloorPlanUrl}
              onChange={(e) => {
                setFormFloorPlanUrl(e.target.value);
                if (fieldErrors.floorPlanUrl) setFieldErrors((prev) => ({ ...prev, floorPlanUrl: undefined }));
              }}
              placeholder="e.g. https://.../layout.pdf or /floorplans/..."
              className={`w-full bg-zinc-950 border ${
                fieldErrors.floorPlanUrl ? 'border-red-500/80' : 'border-zinc-800 focus:border-amber-500/80'
              } rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 font-mono`}
            />
            {fieldErrors.floorPlanUrl && <p className="text-[11px] text-red-400">{fieldErrors.floorPlanUrl}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="block text-zinc-300 font-semibold">Notes (Optional)</label>
            <textarea
              rows={2}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl"
            >
              {formSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Archive Event Confirmation Modal */}
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
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setIsArchiveConfirmOpen(false)}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleArchiveConfirm}
              disabled={formSubmitting}
              className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold rounded-xl"
            >
              {formSubmitting ? 'Archiving...' : 'Archive Event'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Floor Plan Viewer Modal */}
      <FloorplanViewerModal
        isOpen={isFloorplanModalOpen}
        onClose={() => setIsFloorplanModalOpen(false)}
        eventId={event?.id}
        eventName={event?.name || 'Exhibition Floor Plan'}
        pdfUrl={event?.floor_plan_url || null}
        onUpdatePdfUrl={async (newUrl) => {
          if (event) {
            await updateEvent(event.id, { floor_plan_url: newUrl });
            await loadEvent();
          }
        }}
      />

      {/* Delete Event Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteEventOpen}
        onClose={() => setIsDeleteEventOpen(false)}
        type="event"
        itemName={event.name}
        itemSubtext={`${event.venue}, ${event.city}`}
        stallsCount={boothsList.length}
        onConfirmDelete={async () => {
          if (event) {
            await deleteEvent(event.id);
            setIsDeleteEventOpen(false);
            onNavigate('events');
          }
        }}
        onArchiveInstead={async () => {
          if (event) {
            await archiveEvent(event.id);
            setIsDeleteEventOpen(false);
            onNavigate('events');
          }
        }}
      />

      {/* Delete Stall Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deletingBooth !== null}
        onClose={() => setDeletingBooth(null)}
        type="stall"
        itemName={`Stall #${deletingBooth?.booth_number || ''} — ${deletingBooth?.client_name || ''}`}
        itemSubtext={`${event.name} • ${deletingBooth?.stand_size || ''}`}
        onConfirmDelete={async () => {
          if (deletingBooth) {
            await deleteBooth(deletingBooth.id);
            setDeletingBooth(null);
            await loadEvent();
          }
        }}
        onArchiveInstead={async () => {
          if (deletingBooth) {
            await archiveBooth(deletingBooth.id);
            setDeletingBooth(null);
            await loadEvent();
          }
        }}
      />
    </div>
  );
}
