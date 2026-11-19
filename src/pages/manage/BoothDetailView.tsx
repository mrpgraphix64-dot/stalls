import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Building,
  Phone,
  Edit2,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  Palette,
  Printer,
  Hammer,
  Armchair,
  Zap,
  Truck,
  ExternalLink,
  Plus,
  Trash2,
  AlertTriangle,
  Check,
  Ban,
  Layers,
  Archive,
  FileText,
} from 'lucide-react';
import {
  fetchBooth,
  updateBooth,
  updateEvent,
  archiveBooth,
  deleteBooth,
  fetchTasks,
  setTaskStatus,
  fetchLinks,
  createLink,
  deleteLink,
  fetchItems,
  createItem,
  deleteItem,
  updateItem,
} from './api';
import { BoothItem, BoothTask, BoothLink, BoothItemRecord } from './types';
import { Modal } from './Modal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { FloorplanViewerModal } from './FloorplanViewerModal';

interface ChecklistProgress {
  total: number;
  applicable_count: number;
  completed: number;
  percentage: number;
}

interface BoothDetailViewProps {
  boothId: string;
  onNavigate: (route: string) => void;
}

const BOOTH_SIZE_OPTIONS = [
  '3 × 3 m (9 sq.m)',
  '6 × 3 m (18 sq.m)',
  '6 × 6 m (36 sq.m)',
  '27 sq. m',
  'Startup Stall (2 × 2 m)',
  'Custom Size',
];

export function BoothDetailView({ boothId, onNavigate }: BoothDetailViewProps) {
  const [booth, setBooth] = useState<BoothItem | null>(null);
  const [tasks, setTasks] = useState<BoothTask[]>([]);
  const [tasksSummary, setTasksSummary] = useState<ChecklistProgress>({
    total: 6,
    applicable_count: 6,
    completed: 0,
    percentage: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [successToast, setSuccessToast] = useState<string>('');

  // Expandable sections state
  const [expanded, setExpanded] = useState<{ [key: string]: boolean }>({
    design: true,
    print: false,
    production: false,
    furniture: false,
    electrical: false,
    installation: false,
  });

  const toggleSection = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Section Data States
  // 1. Design
  const [designLinks, setDesignLinks] = useState<BoothLink[]>([]);
  const [designUrlInput, setDesignUrlInput] = useState<string>('');
  const [designTitleInput, setDesignTitleInput] = useState<string>('3D View / Render');
  const [designNotes, setDesignNotes] = useState<string>('');

  // 2. Print
  const [printLinks, setPrintLinks] = useState<BoothLink[]>([]);
  const [printTitleInput, setPrintTitleInput] = useState<string>('');
  const [printUrlInput, setPrintUrlInput] = useState<string>('');

  // 3. Production
  const [prodItems, setProdItems] = useState<BoothItemRecord[]>([]);
  const [prodNameInput, setProdNameInput] = useState<string>('');
  const [prodQtyInput, setProdQtyInput] = useState<number>(1);

  // 4. Furniture
  const [furnItems, setFurnItems] = useState<BoothItemRecord[]>([]);
  const [furnNameInput, setFurnNameInput] = useState<string>('');
  const [furnQtyInput, setFurnQtyInput] = useState<number>(1);

  // 5. Electrical
  const [elecItems, setElecItems] = useState<BoothItemRecord[]>([]);
  const [elecNameInput, setElecNameInput] = useState<string>('');
  const [elecQtyInput, setElecQtyInput] = useState<number>(1);

  // 6. Installation
  const [installNotes, setInstallNotes] = useState<string>('');

  // Edit Booth Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState<boolean>(false);
  const [isFloorplanModalOpen, setIsFloorplanModalOpen] = useState<boolean>(false);
  const [editBoothNumber, setEditBoothNumber] = useState<string>('');
  const [editCompanyName, setEditCompanyName] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editSize, setEditSize] = useState<string>('');
  const [editStructure, setEditStructure] = useState<'Wooden' | 'Octonorm'>('Wooden');
  const [editSubmitting, setEditSubmitting] = useState<boolean>(false);
  const [editError, setEditError] = useState<string>('');

  // Load booth data and section items
  const loadAllData = async () => {
    try {
      setLoading(true);
      setError('');
      const [bth, tskRes, dLinks, pLinks, pItems, fItems, eItems] = await Promise.all([
        fetchBooth(boothId),
        fetchTasks(boothId),
        fetchLinks(boothId, 'render_3d').catch(() => []),
        fetchLinks(boothId, 'print_ready').catch(() => []),
        fetchItems(boothId, 'production').catch(() => []),
        fetchItems(boothId, 'furniture').catch(() => []),
        fetchItems(boothId, 'electrical').catch(() => []),
      ]);

      setBooth(bth);
      setDesignNotes(bth.notes || '');
      setTasks(tskRes.tasks);
      setTasksSummary({
        total: tskRes.total,
        applicable_count: tskRes.applicable_count ?? tskRes.total,
        completed: tskRes.completed,
        percentage: tskRes.percentage,
      });

      setDesignLinks(dLinks);
      setPrintLinks(pLinks);
      setProdItems(pItems);
      setFurnItems(fItems);
      setElecItems(eItems);
    } catch (err: any) {
      setError(err.message || 'Failed to load booth information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [boothId]);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(''), 3000);
  };

  // Find task matching section key
  const getTaskForSection = (sectionKey: string): BoothTask | undefined => {
    const key = sectionKey.toLowerCase();
    return tasks.find((t) => {
      const name = t.task_name.toLowerCase();
      if (key === 'design') return name.includes('design');
      if (key === 'print') return name.includes('print');
      if (key === 'production') return name.includes('production') || name.includes('structure');
      if (key === 'furniture') return name.includes('furniture');
      if (key === 'electrical') return name.includes('electrical');
      if (key === 'installation') return name.includes('install') || name.includes('handover');
      return false;
    });
  };

  // Handle task status change (toggle completed or not_applicable)
  const handleToggleTaskStatus = async (sectionKey: string, targetStatus?: 'pending' | 'completed' | 'not_applicable') => {
    const task = getTaskForSection(sectionKey);
    if (!task) return;

    let newStatus: 'pending' | 'completed' | 'not_applicable' = 'completed';
    const currentStatus = task.status || (task.is_completed ? 'completed' : 'pending');

    if (targetStatus) {
      newStatus = targetStatus;
    } else {
      if (currentStatus === 'completed') {
        newStatus = 'pending';
      } else {
        newStatus = 'completed';
      }
    }

    try {
      const res = await setTaskStatus(task.id, newStatus);
      // Update local state immediately
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: newStatus, is_completed: newStatus === 'completed' ? 1 : 0 } : t))
      );
      setTasksSummary({
        total: res.total,
        applicable_count: res.applicable_count ?? res.total,
        completed: res.completed,
        percentage: res.percentage,
      });
      showToast(`${sectionKey.toUpperCase()}: Marked as ${newStatus === 'not_applicable' ? 'Not Required' : newStatus}`);
    } catch (err: any) {
      alert(err.message || 'Failed to update task status.');
    }
  };

  // 1. Design Link Handlers
  const handleAddDesignLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!designUrlInput.trim()) return;

    try {
      const newLnk = await createLink({
        booth_id: boothId,
        category: 'render_3d',
        title: designTitleInput.trim() || '3D View / Render',
        drive_url: designUrlInput.trim(),
      });
      setDesignLinks((prev) => [newLnk, ...prev]);
      setDesignUrlInput('');
      showToast('Design Drive link added.');
    } catch (err: any) {
      alert(err.message || 'Failed to add design link.');
    }
  };

  const handleDeleteLink = async (linkId: string, isDesign: boolean) => {
    try {
      await deleteLink(linkId);
      if (isDesign) {
        setDesignLinks((prev) => prev.filter((l) => l.id !== linkId));
      } else {
        setPrintLinks((prev) => prev.filter((l) => l.id !== linkId));
      }
      showToast('Link removed.');
    } catch (err: any) {
      alert(err.message || 'Failed to remove link.');
    }
  };

  // 2. Print Link Handlers
  const handleAddPrintLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!printUrlInput.trim()) return;

    try {
      const newLnk = await createLink({
        booth_id: boothId,
        category: 'print_ready',
        title: printTitleInput.trim() || 'Print Artwork',
        drive_url: printUrlInput.trim(),
      });
      setPrintLinks((prev) => [...prev, newLnk]);
      setPrintTitleInput('');
      setPrintUrlInput('');
      showToast('Print file link added.');
    } catch (err: any) {
      alert(err.message || 'Failed to add print file link.');
    }
  };

  // 3, 4, 5. Items Handlers (Production, Furniture, Electrical)
  const handleAddItem = async (category: 'production' | 'furniture' | 'electrical') => {
    let name = '';
    let qty = 1;

    if (category === 'production') {
      name = prodNameInput.trim();
      qty = prodQtyInput;
    } else if (category === 'furniture') {
      name = furnNameInput.trim();
      qty = furnQtyInput;
    } else if (category === 'electrical') {
      name = elecNameInput.trim();
      qty = elecQtyInput;
    }

    if (!name) return;

    try {
      const newItem = await createItem({
        booth_id: boothId,
        category,
        item_name: name,
        quantity: Math.max(1, qty),
        unit: 'nos',
      });

      if (category === 'production') {
        setProdItems((prev) => [...prev, newItem]);
        setProdNameInput('');
        setProdQtyInput(1);
      } else if (category === 'furniture') {
        setFurnItems((prev) => [...prev, newItem]);
        setFurnNameInput('');
        setFurnQtyInput(1);
      } else if (category === 'electrical') {
        setElecItems((prev) => [...prev, newItem]);
        setElecNameInput('');
        setElecQtyInput(1);
      }

      showToast(`Added ${name} (${qty})`);
    } catch (err: any) {
      alert(err.message || 'Failed to add item.');
    }
  };

  const handleDeleteItem = async (itemId: string, category: 'production' | 'furniture' | 'electrical') => {
    try {
      await deleteItem(itemId);
      if (category === 'production') setProdItems((prev) => prev.filter((i) => i.id !== itemId));
      if (category === 'furniture') setFurnItems((prev) => prev.filter((i) => i.id !== itemId));
      if (category === 'electrical') setElecItems((prev) => prev.filter((i) => i.id !== itemId));
      showToast('Item removed.');
    } catch (err: any) {
      alert(err.message || 'Failed to remove item.');
    }
  };

  // Open Edit Modal
  const openEditModal = () => {
    if (!booth) return;
    setEditBoothNumber(booth.booth_number);
    setEditCompanyName(booth.client_name);
    setEditPhone(booth.phone || '');
    setEditSize(booth.stand_size || '3 × 3 m (9 sq.m)');
    const st = booth.booth_type?.toLowerCase().includes('octonorm') ? 'Octonorm' : 'Wooden';
    setEditStructure(st);
    setEditError('');
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const updated = await updateBooth(boothId, {
        booth_number: editBoothNumber.trim(),
        client_name: editCompanyName.trim(),
        phone: editPhone.trim() || undefined,
        stand_size: editSize,
        booth_type: editStructure,
      });
      setBooth(updated);
      setIsEditModalOpen(false);
      showToast('Booth details updated.');
    } catch (err: any) {
      setEditError(err.message || 'Failed to update booth.');
    } finally {
      setEditSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-zinc-400 gap-3">
        <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        <span className="text-xs">Loading booth checklist...</span>
      </div>
    );
  }

  if (error || !booth) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center space-y-3">
        <p className="text-red-400 text-sm">{error || 'Booth not found.'}</p>
        <button
          onClick={() => onNavigate('booths')}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg"
        >
          Back to Stalls Directory
        </button>
      </div>
    );
  }

  // Calculate 6-card completion status
  const sectionsList = [
    { key: 'design', label: '1. Design', icon: Palette, desc: '3D concept render and client visual approval Drive link' },
    { key: 'print', label: '2. Print Files', icon: Printer, desc: 'Print-ready graphics and backdrop artwork Drive links' },
    { key: 'production', label: '3. Production', icon: Hammer, desc: 'Carpentry, structure framing specifications and paintwork' },
    { key: 'furniture', label: '4. Furniture', icon: Armchair, desc: 'Chairs, tables, counters and display units' },
    { key: 'electrical', label: '5. Electrical', icon: Zap, desc: 'Spotlights, 5A/15A power points and TV screens' },
    { key: 'installation', label: '6. Installation', icon: Truck, desc: 'Dispatch, on-site erection and final client handover' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200 max-w-5xl mx-auto pb-12">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-amber-500 text-zinc-950 px-4 py-2.5 rounded-xl font-bold text-xs shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom duration-200">
          <Check className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Top Navigation & Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/[0.07]">
        <button
          onClick={() => (booth.event_id ? onNavigate(`event:${booth.event_id}`) : onNavigate('booths'))}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to {booth.event_name ? booth.event_name : 'Stalls Directory'}</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsFloorplanModalOpen(true)}
            className="px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-amber-400 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Floor Plan</span>
          </button>

          <button
            onClick={openEditModal}
            className="px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-zinc-200 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>

          {booth.status !== 'archived' && (
            <button
              onClick={() => setIsArchiveConfirmOpen(true)}
              className="p-1.5 hover:bg-amber-500/10 text-zinc-400 hover:text-amber-400 rounded-xl transition-colors cursor-pointer border border-white/[0.08]"
              title="Archive Stall"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="p-1.5 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 rounded-xl transition-colors cursor-pointer border border-white/[0.08]"
            title="Delete Stall Permanently"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Simplified Top Header */}
      <div className="bg-[#15171e] border border-white/[0.07] rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight">
              {booth.client_name}
            </h1>
            <div className="flex flex-wrap items-center gap-2.5 text-xs text-zinc-400">
              <span className="font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-md">
                Booth #{booth.booth_number}
              </span>
              <span>•</span>
              <span className="text-zinc-300 font-mono">{booth.stand_size || '3 × 3 m'}</span>
              <span>•</span>
              <span className="text-zinc-300 font-medium">
                {booth.booth_type?.toLowerCase().includes('octonorm') ? 'Octonorm' : 'Wooden'}
              </span>
              {booth.event_name && (
                <>
                  <span>•</span>
                  <span className="text-zinc-400 truncate max-w-xs">{booth.event_name}</span>
                </>
              )}
              {booth.phone && (
                <>
                  <span>•</span>
                  <a
                    href={`tel:${booth.phone}`}
                    className="text-amber-400 hover:underline flex items-center gap-1 font-mono"
                  >
                    <Phone className="w-3 h-3" />
                    <span>{booth.phone}</span>
                  </a>
                </>
              )}
            </div>
          </div>

          {/* Overall Checklist Progress Badge */}
          <div className="bg-[#121319] border border-white/[0.06] rounded-xl p-3.5 min-w-[210px] text-right space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400 font-medium">Checklist Progress</span>
              <span className="font-bold text-amber-400 font-mono">
                {tasksSummary.completed} of {tasksSummary.applicable_count} ({tasksSummary.percentage}%)
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/[0.08] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-300"
                style={{ width: `${tasksSummary.percentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Checklist: 6 Expandable Cards */}
      <div className="space-y-3">
        {sectionsList.map((sec) => {
          const Icon = sec.icon;
          const isExp = expanded[sec.key];
          const task = getTaskForSection(sec.key);
          const status = task?.status || (task?.is_completed ? 'completed' : 'pending');
          const isDone = status === 'completed';
          const isNA = status === 'not_applicable';

          return (
            <div
              key={sec.key}
              className={`bg-[#15171e] border rounded-2xl overflow-hidden transition-all shadow-sm ${
                isDone
                  ? 'border-emerald-500/30'
                  : isNA
                  ? 'border-white/[0.04] opacity-75'
                  : 'border-white/[0.07] hover:border-white/[0.14]'
              }`}
            >
              {/* Card Header Row */}
              <div className="px-5 py-3.5 flex items-center justify-between gap-3 bg-[#121319]/80 border-b border-white/[0.04]">
                <div
                  onClick={() => toggleSection(sec.key)}
                  className="flex items-center gap-3.5 flex-1 cursor-pointer select-none"
                >
                  <div
                    className={`p-2 rounded-xl border ${
                      isDone
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : isNA
                        ? 'bg-white/[0.04] border-white/[0.08] text-zinc-500'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3
                        className={`text-sm font-bold tracking-wide ${
                          isDone ? 'text-zinc-100 line-through decoration-emerald-500/60' : 'text-zinc-100'
                        }`}
                      >
                        {sec.label}
                      </h3>
                      {isDone && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Completed
                        </span>
                      )}
                      {isNA && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white/[0.05] text-zinc-400 border border-white/[0.08]">
                          Not Required
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">{sec.desc}</p>
                  </div>
                </div>

                {/* Right Action Controls: Checkbox & NA Toggle */}
                <div className="flex items-center gap-2">
                  {/* Not Required Toggle */}
                  <button
                    type="button"
                    title={isNA ? 'Re-enable as required' : 'Mark as Not Required'}
                    onClick={() => handleToggleTaskStatus(sec.key, isNA ? 'pending' : 'not_applicable')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer ${
                      isNA
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/40'
                        : 'bg-white/[0.04] text-zinc-400 border-white/[0.08] hover:text-zinc-200 hover:bg-white/[0.08]'
                    }`}
                  >
                    N/A
                  </button>

                  {/* Completion Checkbox */}
                  <button
                    type="button"
                    onClick={() => handleToggleTaskStatus(sec.key)}
                    disabled={isNA}
                    className={`p-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold ${
                      isDone
                        ? 'bg-emerald-500 text-zinc-950 border-emerald-500 shadow-sm'
                        : isNA
                        ? 'bg-zinc-950 border-zinc-800 text-zinc-600 opacity-50 cursor-not-allowed'
                        : 'bg-zinc-950 border-zinc-700 text-zinc-300 hover:border-amber-500 hover:text-amber-400'
                    }`}
                  >
                    {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                    <span className="hidden sm:inline">{isDone ? 'Done' : 'Mark Done'}</span>
                  </button>

                  {/* Expand / Collapse Chevron */}
                  <button
                    type="button"
                    onClick={() => toggleSection(sec.key)}
                    className="p-1 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                  >
                    {isExp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Card Expanded Content */}
              {isExp && (
                <div className="p-5 border-t border-zinc-800 bg-zinc-950/40 space-y-4 animate-in fade-in duration-150">
                  {/* SECTION 1: DESIGN */}
                  {sec.key === 'design' && (
                    <div className="space-y-4">
                      {/* Existing Design Links */}
                      {designLinks.length > 0 ? (
                        <div className="space-y-2">
                          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                            Design Google Drive Files
                          </span>
                          <div className="space-y-2">
                            {designLinks.map((lnk) => (
                              <div
                                key={lnk.id}
                                className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs"
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <Palette className="w-4 h-4 text-amber-400 shrink-0" />
                                  <span className="font-semibold text-zinc-200 truncate">{lnk.title}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <a
                                    href={lnk.drive_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg font-medium inline-flex items-center gap-1.5 transition-colors"
                                  >
                                    <span>Open Drive</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteLink(lnk.id, true)}
                                    className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
                                    title="Remove link"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {/* Add Design Link Form */}
                      <form onSubmit={handleAddDesignLink} className="space-y-2.5">
                        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                          {designLinks.length > 0 ? '+ Add Another 3D Design Link' : 'Add Design Google Drive Link'}
                        </span>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={designTitleInput}
                            onChange={(e) => setDesignTitleInput(e.target.value)}
                            placeholder="Title (e.g. 3D View / Render)"
                            className="sm:w-1/3 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                          />
                          <input
                            type="url"
                            required
                            value={designUrlInput}
                            onChange={(e) => setDesignUrlInput(e.target.value)}
                            placeholder="Paste Google Drive URL (https://drive.google.com/...)"
                            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                          />
                          <button
                            type="submit"
                            className="px-4 py-2 bg-amber-500 text-zinc-950 font-bold rounded-xl text-xs hover:bg-amber-400 transition-colors cursor-pointer shrink-0"
                          >
                            Save Link
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* SECTION 2: PRINT FILES */}
                  {sec.key === 'print' && (
                    <div className="space-y-4">
                      {/* Existing Print Links */}
                      {printLinks.length > 0 ? (
                        <div className="space-y-2">
                          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                            Print-Ready Artwork Links
                          </span>
                          <div className="space-y-2">
                            {printLinks.map((lnk) => (
                              <div
                                key={lnk.id}
                                className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs"
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <Printer className="w-4 h-4 text-blue-400 shrink-0" />
                                  <span className="font-semibold text-zinc-200 truncate">{lnk.title}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <a
                                    href={lnk.drive_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg font-medium inline-flex items-center gap-1.5 transition-colors"
                                  >
                                    <span>Open Drive</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteLink(lnk.id, false)}
                                    className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
                                    title="Remove link"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-500">No print artwork links added yet.</p>
                      )}

                      {/* Add Print File Link Form */}
                      <form onSubmit={handleAddPrintLink} className="space-y-2.5 pt-2 border-t border-zinc-800/80">
                        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                          + Add Print File Link
                        </span>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            required
                            value={printTitleInput}
                            onChange={(e) => setPrintTitleInput(e.target.value)}
                            placeholder="Panel Name (e.g. Back Wall, Side Banner, Fascia)"
                            className="sm:w-1/3 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                          />
                          <input
                            type="url"
                            required
                            value={printUrlInput}
                            onChange={(e) => setPrintUrlInput(e.target.value)}
                            placeholder="Paste Google Drive File Link..."
                            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                          />
                          <button
                            type="submit"
                            className="px-4 py-2 bg-blue-500 text-zinc-950 font-bold rounded-xl text-xs hover:bg-blue-400 transition-colors cursor-pointer shrink-0"
                          >
                            Add Print Link
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* SECTION 3: PRODUCTION */}
                  {sec.key === 'production' && (
                    <div className="space-y-4">
                      {/* Production Items List */}
                      {prodItems.length > 0 ? (
                        <div className="space-y-2">
                          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                            Structure & Carpentry Requirements
                          </span>
                          <div className="space-y-1.5">
                            {prodItems.map((itm) => (
                              <div
                                key={itm.id}
                                className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs"
                              >
                                <span className="font-semibold text-zinc-200">{itm.item_name}</span>
                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                                    Qty: {itm.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteItem(itm.id, 'production')}
                                    className="p-1 text-zinc-500 hover:text-red-400"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-500">No production items added yet.</p>
                      )}

                      {/* Add Production Item Form */}
                      <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                          + Add Production Requirement
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={prodNameInput}
                            onChange={(e) => setProdNameInput(e.target.value)}
                            placeholder="e.g. Backdrop Wooden Frame (10ft x 8ft)"
                            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                          />
                          <input
                            type="number"
                            min="1"
                            value={prodQtyInput}
                            onChange={(e) => setProdQtyInput(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-20 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 text-center font-mono focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddItem('production')}
                            className="px-4 py-2 bg-amber-500 text-zinc-950 font-bold rounded-xl text-xs hover:bg-amber-400 transition-colors cursor-pointer shrink-0"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SECTION 4: FURNITURE */}
                  {sec.key === 'furniture' && (
                    <div className="space-y-4">
                      {/* Furniture Items List */}
                      {furnItems.length > 0 ? (
                        <div className="space-y-2">
                          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                            Furniture Inventory
                          </span>
                          <div className="space-y-1.5">
                            {furnItems.map((itm) => (
                              <div
                                key={itm.id}
                                className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs"
                              >
                                <span className="font-semibold text-zinc-200">{itm.item_name}</span>
                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                                    Qty: {itm.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteItem(itm.id, 'furniture')}
                                    className="p-1 text-zinc-500 hover:text-red-400"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-500">No furniture items assigned yet.</p>
                      )}

                      {/* Add Furniture Form with Quick Pills */}
                      <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                          + Add Furniture Item
                        </span>
                        <div className="flex flex-wrap gap-1.5 pb-1">
                          {['Executive Chair', 'Coffee Table', 'Reception Counter', 'Bar Stool', 'Lockable Cabinet'].map(
                            (pill) => (
                              <button
                                key={pill}
                                type="button"
                                onClick={() => setFurnNameInput(pill)}
                                className="px-2 py-0.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-[10px] text-zinc-400 hover:text-zinc-200 border border-zinc-800"
                              >
                                {pill}
                              </button>
                            )
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={furnNameInput}
                            onChange={(e) => setFurnNameInput(e.target.value)}
                            placeholder="e.g. Chair, Table, Counter"
                            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                          />
                          <input
                            type="number"
                            min="1"
                            value={furnQtyInput}
                            onChange={(e) => setFurnQtyInput(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-20 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 text-center font-mono focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddItem('furniture')}
                            className="px-4 py-2 bg-emerald-500 text-zinc-950 font-bold rounded-xl text-xs hover:bg-emerald-400 transition-colors cursor-pointer shrink-0"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SECTION 5: ELECTRICAL */}
                  {sec.key === 'electrical' && (
                    <div className="space-y-4">
                      {/* Electrical Items List */}
                      {elecItems.length > 0 ? (
                        <div className="space-y-2">
                          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                            Electrical & Lighting Items
                          </span>
                          <div className="space-y-1.5">
                            {elecItems.map((itm) => (
                              <div
                                key={itm.id}
                                className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs"
                              >
                                <span className="font-semibold text-zinc-200">{itm.item_name}</span>
                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                                    Qty: {itm.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteItem(itm.id, 'electrical')}
                                    className="p-1 text-zinc-500 hover:text-red-400"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-500">No electrical items assigned yet.</p>
                      )}

                      {/* Add Electrical Form with Quick Pills */}
                      <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                          + Add Electrical Item
                        </span>
                        <div className="flex flex-wrap gap-1.5 pb-1">
                          {['Spotlight (50W)', 'Power Socket (5A/16A)', '50-inch LED TV', 'LED Strip Light', 'Spike Guard'].map(
                            (pill) => (
                              <button
                                key={pill}
                                type="button"
                                onClick={() => setElecNameInput(pill)}
                                className="px-2 py-0.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-[10px] text-zinc-400 hover:text-zinc-200 border border-zinc-800"
                              >
                                {pill}
                              </button>
                            )
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={elecNameInput}
                            onChange={(e) => setElecNameInput(e.target.value)}
                            placeholder="e.g. Spotlight, Power Socket, TV"
                            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                          />
                          <input
                            type="number"
                            min="1"
                            value={elecQtyInput}
                            onChange={(e) => setElecQtyInput(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-20 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 text-center font-mono focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddItem('electrical')}
                            className="px-4 py-2 bg-amber-500 text-zinc-950 font-bold rounded-xl text-xs hover:bg-amber-400 transition-colors cursor-pointer shrink-0"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SECTION 6: INSTALLATION */}
                  {sec.key === 'installation' && (
                    <div className="space-y-3">
                      <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                        Site Execution & Handover
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1">
                          <div className="font-semibold text-zinc-200">1. Fabrication Dispatch</div>
                          <div className="text-[11px] text-zinc-500">Material loaded from workshop</div>
                        </div>
                        <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1">
                          <div className="font-semibold text-zinc-200">2. Venue Setup Completed</div>
                          <div className="text-[11px] text-zinc-500">Carpentry, graphics & lighting erected</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit Booth Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Booth Details"
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
              onClick={() => setIsEditModalOpen(false)}
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

      {/* Delete Stall Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        type="stall"
        itemName={`Stall #${booth.booth_number} — ${booth.client_name}`}
        itemSubtext={`${booth.event_name || 'Exhibition'} • ${booth.stand_size || ''}`}
        onConfirmDelete={async () => {
          await deleteBooth(boothId);
          setIsDeleteModalOpen(false);
          onNavigate(booth.event_id ? `event:${booth.event_id}` : 'booths');
        }}
        onArchiveInstead={async () => {
          await archiveBooth(boothId);
          setIsDeleteModalOpen(false);
          onNavigate(booth.event_id ? `event:${booth.event_id}` : 'booths');
        }}
      />

      {/* Archive Stall Confirmation Modal */}
      <Modal
        isOpen={isArchiveConfirmOpen}
        onClose={() => setIsArchiveConfirmOpen(false)}
        title="Confirm Safe Archiving"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <p className="text-zinc-300">
            Are you sure you want to archive booth{' '}
            <span className="font-bold text-zinc-100">{booth.booth_number}</span> (
            {booth.client_name})?
          </p>
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setIsArchiveConfirmOpen(false)}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                await archiveBooth(boothId);
                setIsArchiveConfirmOpen(false);
                onNavigate(booth.event_id ? `event:${booth.event_id}` : 'booths');
              }}
              className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold rounded-xl cursor-pointer"
            >
              Archive Booth
            </button>
          </div>
        </div>
      </Modal>

      {/* Floor Plan Viewer Modal */}
      <FloorplanViewerModal
        isOpen={isFloorplanModalOpen}
        onClose={() => setIsFloorplanModalOpen(false)}
        eventId={booth.event_id}
        eventName={booth.event_name || 'Exhibition Floor Plan'}
        pdfUrl={booth.event_floor_plan_url || null}
        highlightStall={booth.booth_number}
        onUpdatePdfUrl={async (newUrl) => {
          if (booth.event_id) {
            await updateEvent(booth.event_id, { floor_plan_url: newUrl });
            await loadAllData();
          }
        }}
      />
    </div>
  );
}
