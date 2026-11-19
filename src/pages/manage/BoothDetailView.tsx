import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Layers,
  FolderOpen,
  ExternalLink,
  Edit2,
  Archive,
  Calendar,
  Building,
  User,
  Phone,
  Mail,
  Maximize2,
  Clock,
  Sparkles,
  Palette,
  Printer,
  Hammer,
  Armchair,
  Link2,
  CheckSquare,
  AlertTriangle,
  Zap,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  Plus,
  Truck,
  Check,
  ShieldCheck,
  DollarSign,
  History,
} from 'lucide-react';
import {
  fetchBooth,
  fetchEvents,
  updateBooth,
  archiveBooth,
  fetchTasks,
  setTaskStatus,
  createTask,
  deleteTask,
} from './api';
import { BoothItem, EventItem, BoothStatus, BoothTask, TasksSummary } from './types';
import { Modal } from './Modal';
import { DesignTab } from './tabs/DesignTab';
import { PrintTab } from './tabs/PrintTab';
import { ProductionTab } from './tabs/ProductionTab';
import { FurnitureTab } from './tabs/FurnitureTab';
import { ElectricalTab } from './tabs/ElectricalTab';
import { DriveLinksTab } from './tabs/DriveLinksTab';
import { ChecklistCostingTab } from './tabs/ChecklistCostingTab';
import { FloorplanViewerModal } from './FloorplanViewerModal';
import { matchFloorplanStall } from './floorplanData';

interface BoothDetailViewProps {
  boothId: string;
  onNavigate: (route: string) => void;
}

export function BoothDetailView({ boothId, onNavigate }: BoothDetailViewProps) {
  const [booth, setBooth] = useState<BoothItem | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Checklist State for the interactive top checklist
  const [tasks, setTasks] = useState<BoothTask[]>([]);
  const [taskSummary, setTaskSummary] = useState<{
    total: number;
    applicable: number;
    completed: number;
    percentage: number;
  }>({ total: 10, applicable: 10, completed: 0, percentage: 0 });
  const [tasksLoading, setTasksLoading] = useState<boolean>(false);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState<boolean>(false);
  const [newTaskName, setNewTaskName] = useState<string>('');
  const [newTaskPhase, setNewTaskPhase] = useState<string>('Site Execution');

  // Accordion Expand/Collapse State
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    checklist: true,
    design: true,
    print: false,
    production: false,
    furniture: false,
    installation: false,
    moreDetails: false,
  });

  const [furnitureSubCategory, setFurnitureSubCategory] = useState<'furniture' | 'electrical'>('furniture');
  const [moreDetailsTab, setMoreDetailsTab] = useState<'drive' | 'costing' | 'logs'>('drive');

  // Modals
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState<boolean>(false);
  const [isFloorplanModalOpen, setIsFloorplanModalOpen] = useState<boolean>(false);

  // Edit Form State
  const [formEventId, setFormEventId] = useState<string>('');
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

  const loadBooth = async () => {
    try {
      setLoading(true);
      setError('');
      const [boothData, eventsData] = await Promise.all([fetchBooth(boothId), fetchEvents()]);
      setBooth(boothData);
      setEvents(eventsData);
      await loadChecklist(boothData.id);
    } catch (err: any) {
      setError(err.message || 'Failed to load booth details.');
    } finally {
      setLoading(false);
    }
  };

  const loadChecklist = async (id: string) => {
    try {
      setTasksLoading(true);
      const res = await fetchTasks(id);
      setTasks(res.tasks || []);
      const app = res.applicable_count ?? (res.tasks?.filter((t) => t.status !== 'not_applicable').length || res.total);
      const comp = res.completed ?? (res.tasks?.filter((t) => t.status === 'completed' || t.is_completed === 1).length || 0);
      const pct = app > 0 ? Math.round((comp / app) * 100) : 0;
      setTaskSummary({
        total: res.total,
        applicable: app,
        completed: comp,
        percentage: pct,
      });
    } catch (e) {
      console.warn('Failed to load tasks checklist:', e);
    } finally {
      setTasksLoading(false);
    }
  };

  useEffect(() => {
    loadBooth();
  }, [boothId]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleTaskStatusChange = async (taskId: string, newStatus: 'pending' | 'completed' | 'not_applicable') => {
    try {
      const res = await setTaskStatus(taskId, newStatus);
      // Update local task state immediately
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus, is_completed: newStatus === 'completed' ? 1 : 0 } : t))
      );
      const app = res.applicable_count ?? res.total;
      setTaskSummary({
        total: res.total,
        applicable: app,
        completed: res.completed,
        percentage: Math.round(res.percentage),
      });
    } catch (err: any) {
      alert(err.message || 'Failed to update task status.');
    }
  };

  const handleCreateCustomTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskName.trim()) return;
    try {
      await createTask({
        booth_id: boothId,
        task_name: newTaskName.trim(),
        phase: newTaskPhase,
      });
      setNewTaskName('');
      setIsAddTaskOpen(false);
      await loadChecklist(boothId);
    } catch (err: any) {
      alert(err.message || 'Failed to create task.');
    }
  };

  const openEditModal = () => {
    if (!booth) return;
    setFormEventId(booth.event_id);
    setFormBoothNumber(booth.booth_number);
    setFormClientName(booth.client_name);
    setFormContactPerson(booth.contact_person || '');
    setFormPhone(booth.phone || '');
    setFormEmail(booth.email || '');
    setFormStandSize(booth.stand_size || '');
    setFormBoothType(booth.booth_type || 'Custom Stall');
    setFormBudget(booth.budget ? String(booth.budget) : '');
    setFormQuotedAmount(booth.quoted_amount ? String(booth.quoted_amount) : '');
    setFormMainDriveUrl(booth.main_drive_folder_url || '');
    setFormStatus(booth.status);
    setFormNotes(booth.notes || '');
    setFormError('');
    setIsEditOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEventId || !formBoothNumber.trim() || !formClientName.trim()) {
      setFormError('Please select an event, and enter a booth number and client name.');
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

      await updateBooth(boothId, payload);
      setIsEditOpen(false);
      await loadBooth();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update booth.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleArchiveConfirm = async () => {
    if (!booth) return;
    try {
      setFormSubmitting(true);
      await archiveBooth(booth.id);
      setIsArchiveConfirmOpen(false);
      onNavigate('booths');
    } catch (err: any) {
      alert(err.message || 'Failed to archive booth.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleQuickStatusChange = async (newStatus: BoothStatus) => {
    if (!booth) return;
    try {
      await updateBooth(booth.id, { status: newStatus });
      setBooth((prev) => (prev ? { ...prev, status: newStatus } : null));
    } catch (err: any) {
      alert(err.message || 'Failed to update status.');
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-zinc-400 gap-3">
        <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        <span className="text-sm">Loading stall workspace...</span>
      </div>
    );
  }

  if (error || !booth) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center space-y-3">
        <p className="text-red-400 text-sm">{error || 'Stall not found.'}</p>
        <button
          onClick={() => onNavigate('booths')}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg"
        >
          &larr; Return to Booths Directory
        </button>
      </div>
    );
  }

  const isVerified = Boolean(matchFloorplanStall(booth.booth_number));

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header & Navigation */}
      <div className="space-y-4 pb-2 border-b border-zinc-800/80">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <button
            onClick={() => onNavigate('booths')}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Stalls</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {booth.main_drive_folder_url ? (
              <a
                href={booth.main_drive_folder_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Open Drive Folder</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <button
                onClick={openEditModal}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-medium rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>+ Add Drive Folder</span>
              </button>
            )}

            <button
              onClick={() => setIsFloorplanModalOpen(true)}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-medium rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>View Floor Plan</span>
              <ExternalLink className="w-3 h-3 text-amber-400" />
            </button>

            <button
              onClick={openEditModal}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-medium rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Details</span>
            </button>

            {booth.status !== 'archived' && (
              <button
                onClick={() => setIsArchiveConfirmOpen(true)}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 hover:text-red-400 text-xs font-medium rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Archive</span>
              </button>
            )}
          </div>
        </div>

        {/* Stall & Exhibitor Main Hero Card */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="px-3 py-1 rounded-xl bg-gradient-to-tr from-amber-500/20 to-amber-600/10 border border-amber-500/40 text-amber-300 font-mono font-bold text-sm">
                  Stall {booth.booth_number}
                </span>

                {isVerified && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    Floor Plan Verified
                  </span>
                )}

                <span className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold uppercase tracking-wider border ${getStatusBadge(booth.status)}`}>
                  {booth.status.replace('_', ' ')}
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-100 tracking-tight">
                {booth.client_name}
              </h1>

              <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-zinc-400 pt-0.5">
                {booth.event_name && (
                  <button
                    onClick={() => onNavigate(`event:${booth.event_id}`)}
                    className="hover:text-amber-400 font-medium transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{booth.event_name}</span>
                  </button>
                )}
                {booth.stand_size && (
                  <span>• {booth.stand_size}</span>
                )}
                {booth.booth_type && (
                  <span className="text-zinc-500">• {booth.booth_type}</span>
                )}
              </div>
            </div>

            {/* Overall Progress Widget */}
            <div className="w-full lg:w-72 bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-300">Operations Readiness</span>
                <span className="font-mono font-bold text-amber-400">{taskSummary.percentage}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-300"
                  style={{ width: `${taskSummary.percentage}%` }}
                />
              </div>
              <div className="text-[11px] text-zinc-400 flex items-center justify-between">
                <span>{taskSummary.completed} of {taskSummary.applicable} applicable tasks completed</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Interactive Operations Checklist Card */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">
              Operations Checklist
            </h2>
            <span className="text-xs font-mono text-zinc-400">
              ({taskSummary.completed}/{taskSummary.applicable} Completed)
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsAddTaskOpen(!isAddTaskOpen)}
            className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Task</span>
          </button>
        </div>

        {/* Add custom task form */}
        {isAddTaskOpen && (
          <form onSubmit={handleCreateCustomTask} className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl flex flex-wrap items-center gap-2 animate-in fade-in duration-100">
            <input
              type="text"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              placeholder="Enter requirement / task name..."
              className="flex-1 min-w-[200px] bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 outline-none"
            />
            <select
              value={newTaskPhase}
              onChange={(e) => setNewTaskPhase(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 outline-none cursor-pointer"
            >
              <option value="Site Execution">Site Execution</option>
              <option value="Design">Design</option>
              <option value="Print">Print</option>
              <option value="Production">Production</option>
              <option value="Handover">Handover</option>
            </select>
            <button
              type="submit"
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setIsAddTaskOpen(false)}
              className="px-2 py-1.5 text-zinc-400 hover:text-zinc-200 text-xs cursor-pointer"
            >
              Cancel
            </button>
          </form>
        )}

        {/* Checklist Tasks Table */}
        <div className="divide-y divide-zinc-800/80">
          {tasks.map((task) => {
            const currentStatus = task.status || (task.is_completed === 1 ? 'completed' : 'pending');
            return (
              <div
                key={task.id}
                className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-zinc-800/30 px-2 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      currentStatus === 'completed'
                        ? 'bg-emerald-400'
                        : currentStatus === 'not_applicable'
                        ? 'bg-zinc-600'
                        : 'bg-amber-400 animate-pulse'
                    }`}
                  />
                  <span
                    className={`text-xs font-medium ${
                      currentStatus === 'completed'
                        ? 'line-through text-zinc-500'
                        : currentStatus === 'not_applicable'
                        ? 'text-zinc-500 italic'
                        : 'text-zinc-200'
                    }`}
                  >
                    {task.task_name}
                  </span>
                  <span className="text-[10px] text-zinc-500 hidden md:inline-block font-mono">
                    [{task.phase}]
                  </span>
                </div>

                {/* 3-State Toggle: Pending | Completed | Not Applicable */}
                <div className="flex items-center gap-1 self-end sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => handleTaskStatusChange(task.id, 'pending')}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                      currentStatus === 'pending'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Pending
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTaskStatusChange(task.id, 'completed')}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                      currentStatus === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Completed
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTaskStatusChange(task.id, 'not_applicable')}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                      currentStatus === 'not_applicable'
                        ? 'bg-zinc-700 text-zinc-300 border border-zinc-600'
                        : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    N/A
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. The 5 Main Work Accordions */}
      <div className="space-y-4">
        {/* Accordion 1: Design & Artwork */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => toggleSection('design')}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-zinc-800/40 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <Palette className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-100">Section 1 — Design & Artwork</h3>
                <p className="text-xs text-zinc-400">3D Render Drive link, client reference files & approval status</p>
              </div>
            </div>
            {expandedSections.design ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
          </button>

          {expandedSections.design && (
            <div className="p-5 border-t border-zinc-800 bg-zinc-950/40">
              <DesignTab boothId={booth.id} />
            </div>
          )}
        </div>

        {/* Accordion 2: Printing & Graphics */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => toggleSection('print')}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-zinc-800/40 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
                <Printer className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-100">Section 2 — Printing & Graphics</h3>
                <p className="text-xs text-zinc-400">Print panels, dimensions, substrate material & print-ready Drive files</p>
              </div>
            </div>
            {expandedSections.print ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
          </button>

          {expandedSections.print && (
            <div className="p-5 border-t border-zinc-800 bg-zinc-950/40">
              <PrintTab boothId={booth.id} />
            </div>
          )}
        </div>

        {/* Accordion 3: Structure & Production */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => toggleSection('production')}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-zinc-800/40 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400">
                <Hammer className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-100">Section 3 — Structure & Production</h3>
                <p className="text-xs text-zinc-400">Carpentry, fabrication specs, structural drawings & readiness status</p>
              </div>
            </div>
            {expandedSections.production ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
          </button>

          {expandedSections.production && (
            <div className="p-5 border-t border-zinc-800 bg-zinc-950/40">
              <ProductionTab boothId={booth.id} />
            </div>
          )}
        </div>

        {/* Accordion 4: Furniture & Electrical */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => toggleSection('furniture')}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-zinc-800/40 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <Armchair className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-100">Section 4 — Furniture & Electrical</h3>
                <p className="text-xs text-zinc-400">Chairs, tables, counters, spot lights, power points & LED screens</p>
              </div>
            </div>
            {expandedSections.furniture ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
          </button>

          {expandedSections.furniture && (
            <div className="p-5 border-t border-zinc-800 bg-zinc-950/40 space-y-4">
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
                <button
                  type="button"
                  onClick={() => setFurnitureSubCategory('furniture')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    furnitureSubCategory === 'furniture'
                      ? 'bg-amber-500 text-zinc-950 shadow'
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Armchair className="w-3.5 h-3.5" />
                  <span>Furniture Inventory</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFurnitureSubCategory('electrical')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    furnitureSubCategory === 'electrical'
                      ? 'bg-amber-500 text-zinc-950 shadow'
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Electrical & AV/Screens</span>
                </button>
              </div>

              {furnitureSubCategory === 'furniture' ? (
                <FurnitureTab boothId={booth.id} />
              ) : (
                <ElectricalTab boothId={booth.id} />
              )}
            </div>
          )}
        </div>

        {/* Accordion 5: Installation & Handover */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => toggleSection('installation')}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-zinc-800/40 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-100">Section 5 — Installation & Handover</h3>
                <p className="text-xs text-zinc-400">Dispatch from workshop, venue arrival, setup completion & handover sign-off</p>
              </div>
            </div>
            {expandedSections.installation ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
          </button>

          {expandedSections.installation && (
            <div className="p-5 border-t border-zinc-800 bg-zinc-950/40 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => handleQuickStatusChange('in_production')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    booth.status === 'in_production'
                      ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                  }`}
                >
                  <div className="font-bold">1. In Production</div>
                  <div className="text-[11px] text-zinc-500 mt-1">Workshop fabrication</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickStatusChange('installed')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    booth.status === 'installed'
                      ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                  }`}
                >
                  <div className="font-bold">2. Installed</div>
                  <div className="text-[11px] text-zinc-500 mt-1">Erected at venue</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickStatusChange('handover')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    booth.status === 'handover'
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                  }`}
                >
                  <div className="font-bold">3. Handover</div>
                  <div className="text-[11px] text-zinc-500 mt-1">Client inspection</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickStatusChange('completed')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    booth.status === 'completed'
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                  }`}
                >
                  <div className="font-bold">4. Completed</div>
                  <div className="text-[11px] text-zinc-500 mt-1">Event live & signed off</div>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 4. Secondary "More Details & Financials" Accordion */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => toggleSection('moreDetails')}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-zinc-800/40 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-400">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-200">More Details — Costing, Links Library & Logs</h3>
                <p className="text-xs text-zinc-400">Google Drive library, budget vs actual variance and timestamped activity history</p>
              </div>
            </div>
            {expandedSections.moreDetails ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
          </button>

          {expandedSections.moreDetails && (
            <div className="p-5 border-t border-zinc-800 bg-zinc-950/40 space-y-4">
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
                <button
                  type="button"
                  onClick={() => setMoreDetailsTab('drive')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    moreDetailsTab === 'drive'
                      ? 'bg-amber-500 text-zinc-950 shadow'
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Google Drive Links Library</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMoreDetailsTab('costing')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    moreDetailsTab === 'costing'
                      ? 'bg-amber-500 text-zinc-950 shadow'
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Costing & Expenses</span>
                </button>
              </div>

              {moreDetailsTab === 'drive' ? (
                <DriveLinksTab boothId={booth.id} />
              ) : (
                <ChecklistCostingTab boothId={booth.id} booth={booth} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Booth Modal */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit Stall Details" maxWidth="max-w-[560px]">
        <form onSubmit={handleSaveEdit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
              {formError}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-300">Exhibition</label>
            <select
              value={formEventId}
              onChange={(e) => setFormEventId(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 outline-none"
            >
              {events.map((evt) => (
                <option key={evt.id} value={evt.id}>
                  {evt.name} — {evt.city}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">Stall Number</label>
              <input
                type="text"
                value={formBoothNumber}
                onChange={(e) => setFormBoothNumber(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">Exhibitor / Company Name</label>
              <input
                type="text"
                value={formClientName}
                onChange={(e) => setFormClientName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">Stand Size</label>
              <input
                type="text"
                value={formStandSize}
                onChange={(e) => setFormStandSize(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">Stall Type</label>
              <input
                type="text"
                value={formBoothType}
                onChange={(e) => setFormBoothType(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-300">Main Google Drive Folder URL</label>
            <input
              type="url"
              value={formMainDriveUrl}
              onChange={(e) => setFormMainDriveUrl(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">Contact Person</label>
              <input
                type="text"
                value={formContactPerson}
                onChange={(e) => setFormContactPerson(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">Phone</label>
              <input
                type="text"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">Status</label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as BoothStatus)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-2 text-xs text-zinc-100"
              >
                <option value="draft">Draft</option>
                <option value="approved">Approved</option>
                <option value="in_production">In Production</option>
                <option value="installed">Installed</option>
                <option value="handover">Handover</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="px-4 py-2 bg-zinc-800 text-zinc-300 text-xs font-semibold rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold rounded-xl cursor-pointer"
            >
              {formSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Archive Confirm Modal */}
      <Modal isOpen={isArchiveConfirmOpen} onClose={() => setIsArchiveConfirmOpen(false)} title="Archive Stall" maxWidth="max-w-md">
        <div className="space-y-4">
          <p className="text-xs text-zinc-400">
            Are you sure you want to archive <strong>Stall {booth.booth_number} ({booth.client_name})</strong>? All records, artwork links, and checklist tasks will remain safely stored in the database.
          </p>
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setIsArchiveConfirmOpen(false)}
              className="px-4 py-2 bg-zinc-800 text-zinc-300 text-xs font-semibold rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleArchiveConfirm}
              disabled={formSubmitting}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl cursor-pointer"
            >
              {formSubmitting ? 'Archiving...' : 'Yes, Archive'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Pop-up Floor Plan Viewer */}
      <FloorplanViewerModal
        isOpen={isFloorplanModalOpen}
        onClose={() => setIsFloorplanModalOpen(false)}
        highlightStall={booth.booth_number}
      />
    </div>
  );
}
