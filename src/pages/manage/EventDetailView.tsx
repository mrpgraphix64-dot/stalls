import React, { useEffect, useState, useRef, useMemo } from 'react';
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
  ArrowUp,
  ArrowDown,
  Search,
  Printer,
  Download,
  FileSpreadsheet,
  Check,
} from 'lucide-react';
import {
  fetchEvent,
  updateEvent,
  archiveEvent,
  deleteEvent,
  deleteBooth,
  archiveBooth,
  confirmBooth,
  fetchEventChecklistsPrintData,
  fetchBooth,
  fetchTasks,
  fetchItems,
  fetchLinks,
} from './api';
import { EventItem, EventStatus, BoothItem, StallPrintData } from './types';
import { Modal } from './Modal';
import { AddBoothModal } from './AddBoothModal';
import { FloorplanViewerModal } from './FloorplanViewerModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { SortDirection, sortBoothsByNumber, isPendingOrEmpty } from './boothSort';
import { PrintChecklistModal } from './PrintChecklistModal';
import { EditBoothModal } from './EditBoothModal';
import { BoothWallIndicator } from './BoothWallIndicator';
import { BoothWorkStatusBadges } from './BoothWorkStatusBadges';
import { StallChecklistSheet } from './StallChecklistSheet';
import {
  CHECKLIST_FILTER_OPTIONS,
  ChecklistFilterType,
  getExportFilename,
  exportElementsToPdf,
} from './pdfExport';
import {
  generateStallRequirementsWorkbook,
  downloadWorkbookAsXlsx,
  getExcelExportFilename,
} from './excelExport';
import {
  getEventViewState,
  saveEventViewState,
  consumeEventRestoration,
  restoreScrollAndHighlight,
  setBoothOrigin,
} from './scrollRestoration';

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
  const [successToast, setSuccessToast] = useState<string>('');

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(''), 3000);
  };

  // Modals
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState<boolean>(false);
  const [isDeleteEventOpen, setIsDeleteEventOpen] = useState<boolean>(false);
  const [deletingBooth, setDeletingBooth] = useState<BoothItem | null>(null);
  const [isFloorplanModalOpen, setIsFloorplanModalOpen] = useState<boolean>(false);
  const [isAddBoothOpen, setIsAddBoothOpen] = useState<boolean>(false);

  // Restore previous filters/sorting if returning from Booth Details
  const initialSavedState = useMemo(() => getEventViewState(eventId), [eventId]);

  // Sorting & Filtering for Booths Registered Under This Event
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialSavedState?.sortDirection ?? 'asc');
  const [searchQuery, setSearchQuery] = useState<string>(initialSavedState?.searchQuery ?? '');
  const [checklistFilter, setChecklistFilter] = useState<ChecklistFilterType>(initialSavedState?.checklistFilter ?? 'all');

  const toggleSortDirection = () => {
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  // Printable Stall Checklist State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [printStallsData, setPrintStallsData] = useState<StallPrintData[]>([]);
  const [printModalTitle, setPrintModalTitle] = useState<string>('');
  const [printModalSubtitle, setPrintModalSubtitle] = useState<string>('');
  const [loadingPrint, setLoadingPrint] = useState<boolean>(false);

  const handlePrintAllStalls = async () => {
    try {
      setLoadingPrint(true);
      const res = await fetchEventChecklistsPrintData(eventId);
      setPrintStallsData(res.stalls || []);
      setPrintModalTitle(`All Stall Checklists: ${event?.name || 'Exhibition'}`);
      setPrintModalSubtitle(`${res.stalls?.length || 0} Stalls Registered • 1 Stall Per A4 Page`);
      setIsPrintModalOpen(true);
    } catch (err: any) {
      alert(err.message || 'Failed to prepare stall checklists for printing.');
    } finally {
      setLoadingPrint(false);
    }
  };

  const handlePrintSingleBooth = async (bthSummary: BoothItem) => {
    try {
      setLoadingPrint(true);
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
          eventName: event?.name || bth.event_name || 'Exhibition',
          tasks: tskRes.tasks || [],
          productionItems: pItems || [],
          furnitureItems: fItems || [],
          electricalItems: eItems || [],
          goodiesItems: gItems || [],
          views3D: d3dViews || [],
        },
      ]);
      setPrintModalTitle(`Stall #${bth.booth_number} — ${bth.client_name}`);
      setPrintModalSubtitle(`${event?.name || 'Exhibition'} • ${bth.stand_size || '3 × 3 m'}`);
      setIsPrintModalOpen(true);
    } catch (err: any) {
      alert(err.message || 'Failed to prepare stall checklist for printing.');
    } finally {
      setLoadingPrint(false);
    }
  };

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

  const [loadingPdf, setLoadingPdf] = useState<boolean>(false);
  const [pdfProgressText, setPdfProgressText] = useState<string>('');
  const [loadingExcel, setLoadingExcel] = useState<boolean>(false);
  const [excelProgressText, setExcelProgressText] = useState<string>('');
  const [pdfExportData, setPdfExportData] = useState<StallPrintData[] | null>(null);
  const [editingBooth, setEditingBooth] = useState<BoothItem | null>(null);
  const [confirmingBooth, setConfirmingBooth] = useState<BoothItem | null>(null);
  const [confirmStallNumber, setConfirmStallNumber] = useState<string>('');
  const [confirmError, setConfirmError] = useState<string>('');
  const [confirmSubmitting, setConfirmSubmitting] = useState<boolean>(false);

  // Smart Navigation & Scroll Position Preservation
  const handleOpenBooth = (boothId: string) => {
    saveEventViewState(eventId, {
      scrollY: window.scrollY,
      searchQuery,
      checklistFilter,
      sortDirection,
      lastOpenedBoothId: boothId,
      needsRestoration: true,
    });
    setBoothOrigin({
      route: `event:${eventId}`,
      title: event?.name || 'Exhibition Details',
      timestamp: Date.now(),
    });
    onNavigate(`booth:${boothId}`);
  };

  const restorationAttemptedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!loading && event && !restorationAttemptedRef.current) {
      const state = consumeEventRestoration(eventId);
      if (state && state.needsRestoration) {
        restorationAttemptedRef.current = true;
        restoreScrollAndHighlight(state.lastOpenedBoothId, state.scrollY, {
          dataAttr: 'data-booth-id',
        });
      }
    }
  }, [loading, event, eventId]);

  const boothsList = event?.booths || [];

  const filterCounts = useMemo(() => {
    const counts: Record<ChecklistFilterType, number> = {
      all: boothsList.length,
      without_discussions: 0,
      done: 0,
      in_progress: 0,
      not_started: 0,
      discussions: 0,
    };

    for (const b of boothsList) {
      if (b.booking_stage === 'discussion') {
        counts.discussions++;
      } else {
        counts.without_discussions++;
        const applicable = b.task_count ?? 0;
        const comp = b.tasks_completed ?? 0;
        if (applicable > 0 && comp === applicable) {
          counts.done++;
        } else if (applicable > 0 && comp > 0 && comp < applicable) {
          counts.in_progress++;
        } else {
          counts.not_started++;
        }
      }
    }

    return counts;
  }, [boothsList]);

  const confirmedCount = boothsList.length - filterCounts.discussions;
  const discussionsCount = filterCounts.discussions;

  const filteredBooths = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return boothsList.filter((b) => {
      // 1. Checklist Filter
      if (checklistFilter === 'without_discussions') {
        if (b.booking_stage === 'discussion') return false;
      } else if (checklistFilter === 'done') {
        if (b.booking_stage === 'discussion') return false;
        const applicable = b.task_count ?? 0;
        const comp = b.tasks_completed ?? 0;
        if (!(applicable > 0 && comp === applicable)) return false;
      } else if (checklistFilter === 'in_progress') {
        if (b.booking_stage === 'discussion') return false;
        const applicable = b.task_count ?? 0;
        const comp = b.tasks_completed ?? 0;
        if (!(applicable > 0 && comp > 0 && comp < applicable)) return false;
      } else if (checklistFilter === 'not_started') {
        if (b.booking_stage === 'discussion') return false;
        const comp = b.tasks_completed ?? 0;
        if (comp > 0) return false;
      } else if (checklistFilter === 'discussions') {
        if (b.booking_stage !== 'discussion') return false;
      }

      // 2. Search Query
      if (!q) return true;
      return (
        (b.booth_number || '').toLowerCase().includes(q) ||
        (b.client_name || '').toLowerCase().includes(q) ||
        (b.phone || '').toLowerCase().includes(q) ||
        (b.stand_size || '').toLowerCase().includes(q)
      );
    });
  }, [boothsList, searchQuery, checklistFilter]);

  const sortedBooths = useMemo(() => {
    return sortBoothsByNumber(filteredBooths, sortDirection);
  }, [filteredBooths, sortDirection]);

  // Stalls to export for checklists (excludes ongoing discussions unless explicitly selected)
  const matchingStallsForExport = useMemo(() => {
    if (checklistFilter === 'discussions') {
      return sortedBooths;
    }
    return sortedBooths.filter((b) => b.booking_stage !== 'discussion');
  }, [sortedBooths, checklistFilter]);

  const handleDownloadPDF = async () => {
    if (loadingPdf || matchingStallsForExport.length === 0) return;
    try {
      setLoadingPdf(true);
      setPdfProgressText('Loading data...');
      const boothIds = matchingStallsForExport.map((b) => b.id);
      const includeDiscussions = checklistFilter === 'discussions';
      const res = await fetchEventChecklistsPrintData(eventId, boothIds, includeDiscussions);
      const stalls = res.stalls || [];
      if (stalls.length === 0) {
        alert('No matching stalls available to export.');
        return;
      }
      setPdfExportData(stalls);
      setPdfProgressText('Rendering...');
      // Allow React to mount the scratch container
      await new Promise((resolve) => setTimeout(resolve, 80));

      const sheets = Array.from(document.querySelectorAll<HTMLElement>('#event-pdf-export-scratch .event-pdf-sheet'));
      const filename = getExportFilename(event?.name || 'Exhibition', checklistFilter);
      await exportElementsToPdf(sheets, filename, (curr, total) => {
        setPdfProgressText(`${curr}/${total}`);
      });
    } catch (err: any) {
      alert(err.message || 'Failed to generate PDF. You can also use "Print All" to Save as PDF.');
    } finally {
      setPdfExportData(null);
      setLoadingPdf(false);
      setPdfProgressText('');
    }
  };

  const handlePrintFilteredStalls = async () => {
    if (loadingPrint || matchingStallsForExport.length === 0) return;
    try {
      setLoadingPrint(true);
      const boothIds = matchingStallsForExport.map((b) => b.id);
      const includeDiscussions = checklistFilter === 'discussions';
      const res = await fetchEventChecklistsPrintData(eventId, boothIds, includeDiscussions);
      setPrintStallsData(res.stalls || []);
      const filterLabel = CHECKLIST_FILTER_OPTIONS.find((f) => f.id === checklistFilter)?.label || 'Stalls';
      setPrintModalTitle(
        checklistFilter === 'all'
          ? `All Stall Checklists: ${event?.name || 'Exhibition'}`
          : `${filterLabel}: ${event?.name || 'Exhibition'}`
      );
      setPrintModalSubtitle(
        `${res.stalls?.length || 0} Stalls Included • 1 Stall Per A4 Page`
      );
      setIsPrintModalOpen(true);
    } catch (err: any) {
      alert(err.message || 'Failed to prepare stall checklists for printing.');
    } finally {
      setLoadingPrint(false);
    }
  };

  const handleExportExcel = async () => {
    if (loadingExcel || matchingStallsForExport.length === 0) return;
    try {
      setLoadingExcel(true);
      setExcelProgressText('Loading data...');
      const boothIds = matchingStallsForExport.map((b) => b.id);
      const includeDiscussions = checklistFilter === 'all' || checklistFilter === 'discussions';
      const res = await fetchEventChecklistsPrintData(eventId, boothIds, includeDiscussions);
      const stalls = res.stalls || [];
      if (stalls.length === 0) {
        alert('No matching stalls available to export.');
        return;
      }
      setExcelProgressText('Generating Excel...');
      const eventMetadata = {
        name: event?.name || 'Exhibition',
        venue: event?.venue || null,
        city: event?.city || null,
        startDate: event?.start_date || null,
        endDate: event?.end_date || null,
      };
      const workbook = await generateStallRequirementsWorkbook(stalls, eventMetadata);
      const filename = getExcelExportFilename(event?.name || 'Exhibition', checklistFilter);
      await downloadWorkbookAsXlsx(workbook, filename);
    } catch (err: any) {
      alert(err.message || 'Failed to export Excel workbook. Please try again.');
    } finally {
      setLoadingExcel(false);
      setExcelProgressText('');
    }
  };

  const openConfirmModal = (bth: BoothItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setConfirmingBooth(bth);
    setConfirmStallNumber(bth.booth_number && !isPendingOrEmpty(bth.booth_number) ? bth.booth_number : '');
    setConfirmError('');
  };

  const handleConfirmStallSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmingBooth) return;

    const num = confirmStallNumber.trim();
    if (!num || isPendingOrEmpty(num)) {
      setConfirmError('Please enter a valid Stall / Booth number to confirm.');
      return;
    }

    setConfirmSubmitting(true);
    setConfirmError('');
    try {
      const updated = await confirmBooth(confirmingBooth.id, num);
      setConfirmingBooth(null);
      setEvent((prev) => {
        if (!prev) return prev;
        const updatedBooths = (prev.booths || []).map((b) => (b.id === updated.id ? updated : b));
        return { ...prev, booths: updatedBooths };
      });
      await loadEvent();
    } catch (err: any) {
      setConfirmError(err.message || 'Failed to confirm stall.');
    } finally {
      setConfirmSubmitting(false);
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

  return (
    <div className="space-y-6 animate-in fade-in duration-200 w-full min-w-0">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-amber-500 text-zinc-950 px-4 py-2.5 rounded-xl font-bold text-xs shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom duration-200">
          <Check className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Navigation & Secondary Actions Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800/60">
        <button
          onClick={() => onNavigate('events')}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Exhibitions Directory</span>
        </button>

        {/* Secondary Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsFloorplanModalOpen(true)}
            className="px-3.5 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-amber-400 text-xs font-medium rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            title="View Official Vector Floor Plan"
          >
            <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
            <span>Floor Plan</span>
          </button>

          <button
            onClick={openEditModal}
            className="px-3.5 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-300 text-xs font-medium rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            title="Edit Event Details"
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
        </div>
      </div>

      {/* Event Overview Hero Card */}
      <div className="bg-[#15171e] border border-white/[0.07] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5 min-w-0">
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
              Exhibition Locus
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight">
              {event.name}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 pt-1">
              <span className="flex items-center gap-1.5 text-zinc-300">
                <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                {event.venue}, {event.city}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5 font-mono text-zinc-300">
                <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                {event.start_date} &rarr; {event.end_date}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Stats Badges */}
            <div className="flex items-center gap-2">
              <div className="bg-[#121319] border border-white/[0.06] rounded-xl px-4 py-2.5 text-center min-w-[80px]">
                <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider block">
                  Confirmed
                </span>
                <div className="text-xl font-black text-amber-400 font-mono">
                  {confirmedCount}
                </div>
              </div>

              <div className="bg-[#121319] border border-white/[0.06] rounded-xl px-4 py-2.5 text-center min-w-[80px]">
                <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider block">
                  Discussions
                </span>
                <div className="text-xl font-black text-sky-400 font-mono">
                  {discussionsCount}
                </div>
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="flex items-center gap-2 pl-0 sm:pl-2">
              <button
                type="button"
                disabled={loadingPrint || boothsList.length === 0}
                onClick={handlePrintAllStalls}
                className="px-3.5 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Print Clean A4 Checklists for All Stalls in this Exhibition (1 Stall per page)"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{loadingPrint ? 'Preparing...' : 'Print All Checklists'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAddBoothOpen(true)}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold rounded-xl transition-all shadow-sm shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Booth</span>
              </button>
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
      <div className="bg-[#15171e] border border-white/[0.07] rounded-2xl p-4 sm:p-6 space-y-4 shadow-sm w-full min-w-0">
        {/* Row 1: Quick Filter Segmented Chips */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-1 shrink-0 -mx-1 px-1 sm:mx-0 sm:px-0 border-b border-white/[0.06] pb-3">
          {CHECKLIST_FILTER_OPTIONS.map((opt) => {
            const count = filterCounts[opt.id];
            const isSelected = checklistFilter === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setChecklistFilter(opt.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  isSelected
                    ? 'bg-amber-500 text-zinc-950 shadow-sm font-bold shadow-amber-500/20'
                    : 'bg-white/[0.04] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.08] border border-white/[0.06]'
                }`}
              >
                <span>{opt.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    isSelected ? 'bg-zinc-950/20 text-zinc-950 font-bold' : 'bg-white/[0.08] text-zinc-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Row 2: Search & Actions Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400 shrink-0" />
              <h2 className="text-xs font-bold text-zinc-100 uppercase tracking-wider whitespace-nowrap">
                Booths Registered Under This Event ({searchQuery || checklistFilter !== 'all' ? `${sortedBooths.length} of ${boothsList.length}` : boothsList.length})
              </h2>
            </div>

            {boothsList.length > 2 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search stalls..."
                  className="bg-[#121319] border border-white/[0.08] rounded-xl pl-8 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500/80 w-36 sm:w-52 transition-all"
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Download PDF Action */}
            <button
              type="button"
              disabled={loadingPdf || matchingStallsForExport.length === 0}
              onClick={handleDownloadPDF}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-zinc-950 text-xs font-bold rounded-xl transition-all shadow-sm shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              title={
                matchingStallsForExport.length > 0
                  ? `Download combined PDF checklist for ${matchingStallsForExport.length} stall(s)`
                  : 'No stalls match current filter to download'
              }
            >
              {loadingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{loadingPdf ? (pdfProgressText || 'Saving...') : `Download PDF (${matchingStallsForExport.length})`}</span>
            </button>

            {/* Export Excel Action */}
            <button
              type="button"
              disabled={loadingExcel || matchingStallsForExport.length === 0}
              onClick={handleExportExcel}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              title={
                matchingStallsForExport.length > 0
                  ? `Export landscape Excel requirements workbook for ${matchingStallsForExport.length} stall(s)`
                  : 'No stalls match current filter to export'
              }
            >
              {loadingExcel ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-100" />
              )}
              <span>{loadingExcel ? (excelProgressText || 'Exporting...') : `Export Excel (${matchingStallsForExport.length})`}</span>
            </button>

            {/* Print Filtered Action */}
            <button
              type="button"
              disabled={loadingPrint || matchingStallsForExport.length === 0}
              onClick={handlePrintFilteredStalls}
              className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1.5 cursor-pointer transition-colors px-2.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              title={
                matchingStallsForExport.length > 0
                  ? `Print Clean A4 Checklists for ${matchingStallsForExport.length} stall(s)`
                  : 'No stalls match current filter to print'
              }
            >
              {loadingPrint ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Printer className="w-3.5 h-3.5" />
              )}
              <span>{loadingPrint ? 'Loading...' : `Print (${matchingStallsForExport.length})`}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddBoothOpen(true)}
              className="text-xs text-zinc-300 hover:text-white font-medium flex items-center gap-1 cursor-pointer transition-colors px-2.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>+ Add Booth</span>
            </button>
          </div>
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
          <div className="bg-[#15171e] border border-white/[0.08] rounded-2xl overflow-hidden shadow-sm">
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto w-full">
              <table className="w-full text-left text-xs min-w-[960px] table-auto">
                <thead className="bg-[#121319] border-b border-white/[0.08] text-zinc-400 font-medium">
                  <tr>
                    <th className="py-3.5 px-4 w-[115px] min-w-[105px] shrink-0" aria-sort={sortDirection === 'asc' ? 'ascending' : 'descending'}>
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
                    <th className="py-3.5 px-4 min-w-[280px]">Company Name</th>
                    <th className="py-3.5 px-4 w-[140px] min-w-[130px] shrink-0 whitespace-nowrap">Walls</th>
                    <th className="py-3.5 px-4 w-[170px] min-w-[160px] shrink-0 whitespace-nowrap">Size &amp; Structure</th>
                    <th className="py-3.5 px-4 w-[240px] min-w-[220px] shrink-0 whitespace-nowrap">Checklist Progress</th>
                    <th className="py-3.5 px-4 w-[150px] min-w-[140px] shrink-0 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05] text-zinc-300">
                  {sortedBooths.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center space-y-2">
                        <p className="text-zinc-300 font-medium text-xs">
                          No stalls match filter &ldquo;{CHECKLIST_FILTER_OPTIONS.find((f) => f.id === checklistFilter)?.label}&rdquo;{searchQuery ? ` and search &ldquo;${searchQuery}&rdquo;` : ''}.
                        </p>
                        {(checklistFilter !== 'all' || searchQuery) && (
                          <button
                            type="button"
                            onClick={() => {
                              setChecklistFilter('all');
                              setSearchQuery('');
                            }}
                            className="text-amber-400 hover:text-amber-300 text-xs font-semibold underline underline-offset-4 cursor-pointer"
                          >
                            Reset filters
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    sortedBooths.map((b) => {
                      const comp = b.tasks_completed ?? 0;
                      const applicable = b.task_count ?? 0;
                      const na = b.tasks_na ?? 0;
                      const pct = applicable > 0 ? Math.round((comp / applicable) * 100) : 0;
                      const hasNoApplicable = applicable === 0;
                      const rawSt = (b.booth_type || '').toLowerCase();
                      const structure = rawSt.includes('frame') || rawSt.includes('octonorm')
                        ? 'Frame'
                        : rawSt.includes('custom')
                        ? 'Customize'
                        : 'Wooden';

                      return (
                        <tr
                          key={b.id}
                          data-booth-id={b.id}
                          onClick={() => handleOpenBooth(b.id)}
                          className="group hover:bg-zinc-800/40 odd:bg-transparent even:bg-white/[0.015] cursor-pointer transition-colors"
                        >
                          <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                            {isPendingOrEmpty(b.booth_number) ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700/60 font-mono text-[11px] font-medium">
                                Not Assigned
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/25 font-mono font-bold text-amber-300 text-xs tracking-tight group-hover:border-amber-500/50 group-hover:bg-amber-500/20 transition-all">
                                {b.booth_number}
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 min-w-[280px]">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <span className="font-semibold text-zinc-100 text-sm group-hover:text-amber-300 transition-colors block truncate max-w-[220px] lg:max-w-[280px]" title={b.client_name}>
                                {b.client_name}
                              </span>
                              {b.booking_stage === 'discussion' && (
                                <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                  Discussion
                                </span>
                              )}
                              <BoothWorkStatusBadges booth={b} />
                            </div>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <BoothWallIndicator wallConfig={b.wall_configuration} />
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-400">
                              <span className="px-2 py-0.5 rounded bg-[#1a1d26] border border-white/[0.08] font-medium text-zinc-300 text-[11px]">
                                {structure}
                              </span>
                              <span className="text-zinc-600">•</span>
                              <span className="text-zinc-300">{b.stand_size || '3 × 3 m'}</span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {b.booking_stage === 'discussion' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono text-[11px]">
                                Discussion Only
                              </span>
                            ) : hasNoApplicable ? (
                              <span
                                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/60 font-mono text-[11px] font-medium"
                                title={na > 0 ? `${na} section${na > 1 ? 's' : ''} marked Not Required (N/A)` : 'No applicable tasks'}
                              >
                                <span>No Applicable Tasks</span>
                                {na > 0 && <span className="text-zinc-500 text-[10px]">({na} N/A)</span>}
                              </span>
                            ) : pct === 100 ? (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-mono text-[11px] font-medium">
                                  <Check className="w-3 h-3" />
                                  <span>{comp}/{applicable} Done</span>
                                </span>
                                {na > 0 && (
                                  <span
                                    className="text-[10px] text-zinc-400 font-mono bg-zinc-800/80 border border-zinc-700/50 px-1.5 py-0.5 rounded"
                                    title={`${na} section${na > 1 ? 's' : ''} marked Not Required`}
                                  >
                                    {na} N/A
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2.5">
                                <div className="w-20 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                                  <div
                                    className="h-full bg-amber-500 rounded-full"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="font-mono text-[11px] text-zinc-300">
                                  {comp}/{applicable} <span className="text-zinc-500">({pct}%)</span>
                                </span>
                                {na > 0 && (
                                  <span
                                    className="text-[10px] text-zinc-400 font-mono bg-zinc-800/80 border border-zinc-700/50 px-1.5 py-0.5 rounded"
                                    title={`${na} section${na > 1 ? 's' : ''} marked Not Required`}
                                  >
                                    {na} N/A
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              {b.booking_stage === 'discussion' && (
                                <button
                                  type="button"
                                  onClick={(e) => openConfirmModal(b, e)}
                                  className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-[11px] font-bold rounded-lg transition-all shadow-sm flex items-center gap-1 cursor-pointer mr-1"
                                  title="Confirm Stall & Initialize Checklist"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Confirm</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingBooth(b);
                                }}
                                className="p-1.5 hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors cursor-pointer"
                                title={b.booking_stage === 'discussion' ? 'Edit Discussion' : 'Edit Booth'}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePrintSingleBooth(b);
                                }}
                                className="p-1.5 hover:bg-amber-500/10 text-zinc-400 hover:text-amber-400 rounded-lg transition-colors cursor-pointer"
                                title="Print Stall Checklist Sheet"
                              >
                                <Printer className="w-3.5 h-3.5" />
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
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Card View */}
            <div className="block sm:hidden divide-y divide-white/[0.06]">
              {sortedBooths.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <p className="text-zinc-300 font-medium text-xs">
                    No stalls match filter &ldquo;{CHECKLIST_FILTER_OPTIONS.find((f) => f.id === checklistFilter)?.label}&rdquo;{searchQuery ? ` and search &ldquo;${searchQuery}&rdquo;` : ''}.
                  </p>
                  {(checklistFilter !== 'all' || searchQuery) && (
                    <button
                      type="button"
                      onClick={() => {
                        setChecklistFilter('all');
                        setSearchQuery('');
                      }}
                      className="text-amber-400 hover:text-amber-300 text-xs font-semibold underline underline-offset-4 cursor-pointer"
                    >
                      Reset filters
                    </button>
                  )}
                </div>
              ) : (
                sortedBooths.map((b) => {
                  const comp = b.tasks_completed ?? 0;
                  const applicable = b.task_count ?? 0;
                  const na = b.tasks_na ?? 0;
                  const pct = applicable > 0 ? Math.round((comp / applicable) * 100) : 0;
                  const hasNoApplicable = applicable === 0;
                  const rawSt = (b.booth_type || '').toLowerCase();
                  const structure = rawSt.includes('frame') || rawSt.includes('octonorm')
                    ? 'Frame'
                    : rawSt.includes('custom')
                    ? 'Customize'
                    : 'Wooden';

                  return (
                    <div
                      key={b.id}
                      data-booth-id={b.id}
                      onClick={() => handleOpenBooth(b.id)}
                      className="p-3.5 hover:bg-zinc-800/40 active:bg-zinc-800/60 cursor-pointer transition-colors space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {isPendingOrEmpty(b.booth_number) ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700/60 font-mono text-[10px] font-medium shrink-0">
                              Not Assigned
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 font-mono font-bold text-amber-300 text-xs tracking-tight shrink-0">
                              {b.booth_number}
                            </span>
                          )}
                          <span className="font-semibold text-zinc-100 text-sm truncate">
                            {b.client_name}
                          </span>
                          {b.booking_stage === 'discussion' && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                              Discussion
                            </span>
                          )}
                          <BoothWorkStatusBadges booth={b} />
                        </div>
                        <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-400">
                        <span className="px-1.5 py-0.5 rounded bg-[#1a1d26] border border-white/[0.08] font-medium text-zinc-300 text-[10px]">
                          {structure}
                        </span>
                        <span className="text-zinc-600">•</span>
                        <span className="font-mono text-zinc-300 text-[11px]">{b.stand_size || '3 × 3 m'}</span>
                        <span className="text-zinc-600">•</span>
                        <div className="inline-flex items-center">
                          <BoothWallIndicator wallConfig={b.wall_configuration} size="sm" />
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-1">
                        {b.booking_stage === 'discussion' ? (
                          <span className="text-[11px] font-mono text-sky-400">
                            Discussion Only
                          </span>
                        ) : hasNoApplicable ? (
                          <span className="font-mono text-[11px] text-zinc-400 bg-zinc-800 border border-zinc-700/60 px-2 py-0.5 rounded">
                            No Applicable Tasks {na > 0 ? `(${na} N/A)` : ''}
                          </span>
                        ) : (
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="flex-1 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                              <div
                                className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="font-mono text-[11px] text-zinc-400 shrink-0">
                              {comp}/{applicable} ({pct}%)
                              {na > 0 && <span className="ml-1 text-zinc-500 text-[10px]">[{na} N/A]</span>}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {b.booking_stage === 'discussion' && (
                            <button
                              type="button"
                              onClick={(e) => openConfirmModal(b, e)}
                              className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-[10px] font-bold rounded-lg transition-all shadow-sm flex items-center gap-1 cursor-pointer mr-0.5"
                              title="Confirm Stall"
                            >
                              <Check className="w-3 h-3" />
                              <span>Confirm</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingBooth(b);
                            }}
                            className="p-1.5 text-zinc-400 hover:text-zinc-200 active:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                            title="Edit Booth"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePrintSingleBooth(b);
                            }}
                            className="p-1.5 text-zinc-400 hover:text-amber-400 active:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                            title="Print Stall Checklist Sheet"
                          >
                            <Printer className="w-3.5 h-3.5" />
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
                })
              )}
            </div>
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
            const bNum = deletingBooth.booth_number || 'Stall';
            await deleteBooth(deletingBooth.id);
            setDeletingBooth(null);
            setEvent((prev) => prev ? { ...prev, booths: (prev.booths || []).filter((b) => b.id !== deletingBooth.id) } : null);
            showToast(`Stall #${bNum} deleted permanently.`);
            await loadEvent();
          }
        }}
        onArchiveInstead={async () => {
          if (deletingBooth) {
            const bNum = deletingBooth.booth_number || 'Stall';
            await archiveBooth(deletingBooth.id);
            setDeletingBooth(null);
            setEvent((prev) => prev ? { ...prev, booths: (prev.booths || []).filter((b) => b.id !== deletingBooth.id) } : null);
            showToast(`Stall #${bNum} archived.`);
            await loadEvent();
          }
        }}
      />

      {/* Bulk & Single Print Checklists Modal */}
      <PrintChecklistModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title={printModalTitle}
        subtitle={printModalSubtitle}
        stalls={printStallsData}
        filterType={checklistFilter}
      />

      {/* Edit Booth Modal */}
      <EditBoothModal
        isOpen={editingBooth !== null}
        onClose={() => setEditingBooth(null)}
        booth={editingBooth}
        events={event ? [event] : []}
        existingBooths={boothsList}
        onSuccess={(updated) => {
          setEditingBooth(null);
          setEvent((prev) => {
            if (!prev) return prev;
            const updatedBooths = (prev.booths || []).map((b) => (b.id === updated.id ? updated : b));
            return { ...prev, booths: updatedBooths };
          });
          loadEvent();
        }}
      />

      {/* Quick Confirm Stall Modal */}
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
              <span className="font-medium text-zinc-200">{event?.name || 'Selected Exhibition'}</span>
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
              <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>What happens next?</span>
            </p>
            <p className="text-zinc-300 text-[10px] leading-relaxed">
              This stall will convert to Confirmed status. The 5-section checklist (Design, Print Files, Production, Furniture, Electrical) will automatically initialize.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setConfirmingBooth(null)}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={confirmSubmitting}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl transition-all shadow-md shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              {confirmSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Confirming...</span>
                </>
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

      {/* Hidden scratch container for client-side direct PDF generation */}
      {pdfExportData && (
        <div
          id="event-pdf-export-scratch"
          style={{
            position: 'fixed',
            left: '-9999px',
            top: 0,
            width: '794px',
            background: '#ffffff',
            zIndex: -9999,
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        >
          {pdfExportData.map((stall, idx) => (
            <div
              key={stall.booth.id || idx}
              className="event-pdf-sheet bg-white p-6"
              style={{ width: '794px', minHeight: '1120px' }}
            >
              <StallChecklistSheet
                data={stall}
                isBulk={pdfExportData.length > 1}
                isLast={idx === pdfExportData.length - 1}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
