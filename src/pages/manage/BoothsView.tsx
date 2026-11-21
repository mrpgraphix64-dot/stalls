import React, { useEffect, useState, useMemo, useRef } from 'react';
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
  Download,
  FileSpreadsheet,
  Loader2,
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
  fetchBoothsChecklistsPrintData,
} from './api';
import { BoothItem, EventItem, StallPrintData } from './types';
import { Modal } from './Modal';
import { AddBoothModal } from './AddBoothModal';
import { FloorplanViewerModal } from './FloorplanViewerModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { SortDirection, sortBoothsByNumber, isPendingOrEmpty } from './boothSort';
import { PrintChecklistModal } from './PrintChecklistModal';
import { EditBoothModal } from './EditBoothModal';
import { BoothWallIndicator } from './BoothWallIndicator';
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
  getBoothsViewState,
  saveBoothsViewState,
  consumeBoothsRestoration,
  restoreScrollAndHighlight,
  setBoothOrigin,
} from './scrollRestoration';

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

  // Restore previous filters/sorting if returning from Booth Details
  const initialSavedState = useMemo(() => getBoothsViewState(), []);

  // Quick Checklist Filter State
  const [checklistFilter, setChecklistFilter] = useState<ChecklistFilterType>(
    initialSavedState?.checklistFilter ?? (initialTab === 'discussions' ? 'discussions' : 'all')
  );

  useEffect(() => {
    // Only reset if there was no active saved state being restored
    if (!initialSavedState?.needsRestoration) {
      if (initialTab === 'discussions') {
        setChecklistFilter('discussions');
      } else if (initialTab === 'confirmed') {
        setChecklistFilter('all');
      }
    }
  }, [initialTab, initialSavedState]);

  // Filters
  const [search, setSearch] = useState<string>(initialSavedState?.searchQuery ?? '');
  const [selectedEventId, setSelectedEventId] = useState<string>(
    initialSavedState?.selectedEventId ?? defaultEventId
  );
  const [structureFilter, setStructureFilter] = useState<'all' | 'wooden' | 'frame' | 'customize'>(
    (initialSavedState?.structureFilter as any) ?? 'all'
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    initialSavedState?.sortDirection ?? 'asc'
  );

  const toggleSortDirection = () => {
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  // Smart Navigation & Scroll Position Preservation
  const handleOpenBooth = (boothId: string) => {
    saveBoothsViewState({
      scrollY: window.scrollY,
      searchQuery: search,
      checklistFilter,
      sortDirection,
      selectedEventId,
      structureFilter,
      activeTab: checklistFilter === 'discussions' ? 'discussions' : 'confirmed',
      lastOpenedBoothId: boothId,
      needsRestoration: true,
    });
    setBoothOrigin({
      route: checklistFilter === 'discussions' ? 'booths:discussions' : 'booths',
      title: 'Stalls Directory',
      timestamp: Date.now(),
    });
    onNavigate(`booth:${boothId}`);
  };

  const restorationAttemptedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!loading && booths.length > 0 && !restorationAttemptedRef.current) {
      const state = consumeBoothsRestoration();
      if (state && state.needsRestoration) {
        restorationAttemptedRef.current = true;
        restoreScrollAndHighlight(state.lastOpenedBoothId, state.scrollY, {
          dataAttr: 'data-booth-id',
        });
      }
    }
  }, [loading, booths]);

  // Modals
  const [isAddOpen, setIsAddOpen] = useState<boolean>(createModalOpen);
  const [editingBooth, setEditingBooth] = useState<BoothItem | null>(null);
  const [archivingBooth, setArchivingBooth] = useState<BoothItem | null>(null);
  const [archiveSubmitting, setArchiveSubmitting] = useState<boolean>(false);
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
  const [loadingPrint, setLoadingPrint] = useState<boolean>(false);
  const [loadingPdf, setLoadingPdf] = useState<boolean>(false);
  const [pdfProgressText, setPdfProgressText] = useState<string>('');
  const [loadingExcel, setLoadingExcel] = useState<boolean>(false);
  const [excelProgressText, setExcelProgressText] = useState<string>('');
  const [pdfExportData, setPdfExportData] = useState<StallPrintData[] | null>(null);

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
      setArchiveSubmitting(true);
      await archiveBooth(archivingBooth.id);
      setArchivingBooth(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to archive booth.');
    } finally {
      setArchiveSubmitting(false);
    }
  };

  // Helper to map booth type display
  const getStallTypeLabel = (rawType?: string): 'Wooden' | 'Frame' | 'Customize' => {
    const raw = (rawType || '').toLowerCase();
    if (raw.includes('frame') || raw.includes('octonorm')) return 'Frame';
    if (raw.includes('custom')) return 'Customize';
    return 'Wooden';
  };

  const filterCounts = useMemo(() => {
    const counts: Record<ChecklistFilterType, number> = {
      all: booths.length,
      done: 0,
      in_progress: 0,
      not_started: 0,
      discussions: 0,
    };

    for (const b of booths) {
      if (b.booking_stage === 'discussion') {
        counts.discussions++;
      } else {
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
  }, [booths]);

  // Filter booths by quick checklist filter and structure
  const filteredBooths = useMemo(() => {
    return booths.filter((b) => {
      // 1. Checklist Filter
      if (checklistFilter === 'done') {
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

      // 2. Structure Filter
      const typeLabel = getStallTypeLabel(b.booth_type);
      if (structureFilter === 'wooden') return typeLabel === 'Wooden';
      if (structureFilter === 'frame') return typeLabel === 'Frame';
      if (structureFilter === 'customize') return typeLabel === 'Customize';
      return true;
    });
  }, [booths, checklistFilter, structureFilter]);

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
      const res = await fetchBoothsChecklistsPrintData(boothIds, selectedEventId || undefined, includeDiscussions);
      const stalls = res.stalls || [];
      if (stalls.length === 0) {
        alert('No matching stalls available to export.');
        return;
      }
      setPdfExportData(stalls);
      setPdfProgressText('Rendering...');
      await new Promise((resolve) => setTimeout(resolve, 80));

      const sheets = Array.from(document.querySelectorAll<HTMLElement>('#booths-pdf-export-scratch .booths-pdf-sheet'));
      const eventName = events.find((e) => e.id === selectedEventId)?.name || 'Exhibition';
      const filename = getExportFilename(eventName, checklistFilter);
      await exportElementsToPdf(sheets, filename, (curr, total) => {
        setPdfProgressText(`${curr}/${total}`);
      });
    } catch (err: any) {
      alert(err.message || 'Failed to generate PDF. You can also use "Print" to Save as PDF.');
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
      const res = await fetchBoothsChecklistsPrintData(boothIds, selectedEventId || undefined, includeDiscussions);
      setPrintStallsData(res.stalls || []);
      const filterLabel = CHECKLIST_FILTER_OPTIONS.find((f) => f.id === checklistFilter)?.label || 'Stalls';
      const eventName = events.find((e) => e.id === selectedEventId)?.name || 'Exhibitions';
      setPrintModalTitle(
        checklistFilter === 'all'
          ? `All Stall Checklists: ${eventName}`
          : `${filterLabel}: ${eventName}`
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
      const res = await fetchBoothsChecklistsPrintData(boothIds, selectedEventId || undefined, includeDiscussions);
      const stalls = res.stalls || [];
      if (stalls.length === 0) {
        alert('No matching stalls available to export.');
        return;
      }
      setExcelProgressText('Generating Excel...');
      const evt = events.find((e) => e.id === selectedEventId);
      const eventMetadata = {
        name: evt?.name || 'All Exhibitions',
        venue: evt?.venue || null,
        city: evt?.city || null,
        startDate: evt?.start_date || null,
        endDate: evt?.end_date || null,
      };
      const workbook = await generateStallRequirementsWorkbook(stalls, eventMetadata);
      const filename = getExcelExportFilename(evt?.name || 'All_Stalls', checklistFilter);
      await downloadWorkbookAsXlsx(workbook, filename);
    } catch (err: any) {
      alert(err.message || 'Failed to export Excel workbook. Please try again.');
    } finally {
      setLoadingExcel(false);
      setExcelProgressText('');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 w-full min-w-0 pb-12">
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

      {/* Quick Filter Segmented Chips */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-1 shrink-0 -mx-1 px-1 sm:mx-0 sm:px-0 border-b border-white/[0.08] pb-3">
        {CHECKLIST_FILTER_OPTIONS.map((opt) => {
          const count = filterCounts[opt.id];
          const isSelected = checklistFilter === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setChecklistFilter(opt.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 shrink-0 whitespace-nowrap ${
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

      {/* Filter and Search Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by client, booth #, or remark..."
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

          {/* Download PDF Action */}
          <button
            type="button"
            disabled={loadingPdf || matchingStallsForExport.length === 0}
            onClick={handleDownloadPDF}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-zinc-950 text-xs font-bold rounded-xl transition-all shadow-sm shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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
            className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1.5 cursor-pointer transition-colors px-2.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed"
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
          <p className="text-sm font-medium text-zinc-300">
            No stalls match filter &ldquo;{CHECKLIST_FILTER_OPTIONS.find((f) => f.id === checklistFilter)?.label}&rdquo;{search ? ` and search &ldquo;${search}&rdquo;` : ''}.
          </p>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Try adjusting your search keywords, exhibition selection, or switch to All Stalls.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            {(checklistFilter !== 'all' || search || structureFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setChecklistFilter('all');
                  setSearch('');
                  setStructureFilter('all');
                }}
                className="px-3.5 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-amber-400 text-xs font-semibold rounded-xl transition-all cursor-pointer"
              >
                Reset filters
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsAddOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-xs transition-all cursor-pointer shadow-sm shadow-amber-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Booth</span>
            </button>
          </div>
        </div>
      ) : checklistFilter !== 'discussions' ? (
        /* 1. Confirmed Stalls List */
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
                  <th className="py-3.5 px-4 min-w-[220px]">Company Name</th>
                  <th className="py-3.5 px-4 w-[140px] min-w-[130px] shrink-0 whitespace-nowrap">Walls</th>
                  <th className="py-3.5 px-4 w-[170px] min-w-[160px] shrink-0 whitespace-nowrap">Size &amp; Structure</th>
                  <th className="py-3.5 px-4 w-[240px] min-w-[220px] shrink-0 whitespace-nowrap">Checklist Progress</th>
                  <th className="py-3.5 px-4 w-[150px] min-w-[140px] shrink-0 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05] text-zinc-300">
                {sortedBooths.map((b) => {
                  const comp = b.tasks_completed ?? 0;
                  const applicable = b.task_count ?? 0;
                  const na = b.tasks_na ?? 0;
                  const pct = applicable > 0 ? Math.round((comp / applicable) * 100) : 0;
                  const hasNoApplicable = applicable === 0;
                  const structure = getStallTypeLabel(b.booth_type);

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

                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-zinc-100 text-sm group-hover:text-amber-300 transition-colors block truncate" title={b.client_name}>
                          {b.client_name}
                        </span>
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
                        {hasNoApplicable ? (
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
              const applicable = b.task_count ?? 0;
              const na = b.tasks_na ?? 0;
              const pct = applicable > 0 ? Math.round((comp / applicable) * 100) : 0;
              const hasNoApplicable = applicable === 0;
              const structure = getStallTypeLabel(b.booth_type);

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
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {hasNoApplicable ? (
                        <span className="font-mono text-[11px] text-zinc-400 bg-zinc-800 border border-zinc-700/60 px-2 py-0.5 rounded">
                          No Applicable Tasks {na > 0 ? `(${na} N/A)` : ''}
                        </span>
                      ) : (
                        <>
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
                        </>
                      )}
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
          <div className="hidden sm:block overflow-x-auto w-full">
            <table className="w-full text-left text-xs min-w-[960px]">
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
                  const hasAllottedNumber = !isPendingOrEmpty(b.booth_number);
                  const dateStr = b.updated_at || b.created_at || '';
                  const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString() : '—';

                  return (
                    <tr
                      key={b.id}
                      data-booth-id={b.id}
                      onClick={() => handleOpenBooth(b.id)}
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
                            Not Assigned
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
              const hasAllottedNumber = !isPendingOrEmpty(b.booth_number);

              return (
                <div
                  key={b.id}
                  data-booth-id={b.id}
                  onClick={() => handleOpenBooth(b.id)}
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
                          Not Assigned
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
      <EditBoothModal
        isOpen={editingBooth !== null}
        onClose={() => setEditingBooth(null)}
        booth={editingBooth}
        events={events}
        existingBooths={booths}
        onSuccess={(updated) => {
          setEditingBooth(null);
          setBooths((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
          loadData();
        }}
      />

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
              disabled={archiveSubmitting}
              className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold rounded-xl cursor-pointer"
            >
              {archiveSubmitting ? 'Archiving...' : 'Archive Booth'}
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
        filterType={checklistFilter}
      />

      {/* Hidden scratch container for client-side direct PDF generation */}
      {pdfExportData && (
        <div
          id="booths-pdf-export-scratch"
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
              className="booths-pdf-sheet bg-white p-6"
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
