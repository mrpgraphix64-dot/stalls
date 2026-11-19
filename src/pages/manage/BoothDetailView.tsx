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
  DollarSign,
  FileText,
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
} from 'lucide-react';
import { fetchBooth, fetchEvents, updateBooth, archiveBooth } from './api';
import { BoothItem, EventItem, BoothStatus } from './types';
import { Modal } from './Modal';
import { DesignTab } from './tabs/DesignTab';
import { PrintTab } from './tabs/PrintTab';
import { ProductionTab } from './tabs/ProductionTab';
import { FurnitureTab } from './tabs/FurnitureTab';
import { ElectricalTab } from './tabs/ElectricalTab';
import { DriveLinksTab } from './tabs/DriveLinksTab';
import { ChecklistCostingTab } from './tabs/ChecklistCostingTab';

interface BoothDetailViewProps {
  boothId: string;
  onNavigate: (route: string) => void;
}

export function BoothDetailView({ boothId, onNavigate }: BoothDetailViewProps) {
  const [booth, setBooth] = useState<BoothItem | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('overview');

  // Modals
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState<boolean>(false);

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
    } catch (err: any) {
      setError(err.message || 'Failed to load booth details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBooth();
  }, [boothId]);

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
      setFormError('Please select an event and enter booth number and client name.');
      return;
    }

    setFormSubmitting(true);
    setFormError('');

    try {
      await updateBooth(boothId, {
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
      });
      setIsEditOpen(false);
      await loadBooth();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update stall details.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleArchiveConfirm = async () => {
    try {
      setFormSubmitting(true);
      await archiveBooth(boothId);
      setIsArchiveConfirmOpen(false);
      onNavigate('booths');
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-zinc-400 gap-3">
        <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        <span className="text-sm">Loading stall command center...</span>
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

  const tabs: { id: string; label: string; icon: any; step?: string }[] = [
    { id: 'overview', label: 'Overview', icon: Layers },
    { id: 'design', label: '3D Design', icon: Palette },
    { id: 'print', label: 'Print Artwork', icon: Printer },
    { id: 'production', label: 'Structure & Production', icon: Hammer },
    { id: 'furniture', label: 'Furniture Inventory', icon: Armchair },
    { id: 'electrical', label: 'Electrical & AV', icon: Zap },
    { id: 'drive', label: 'Drive Links', icon: Link2 },
    { id: 'checklist', label: 'Checklist & Costing', icon: CheckSquare },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Bar Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800/60">
        <button
          onClick={() => onNavigate('booths')}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Stalls Directory
        </button>

        <div className="flex items-center gap-2">
          {booth.event_id && (
            <button
              onClick={() => onNavigate(`event:${booth.event_id}`)}
              className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-xs font-medium rounded-xl transition-colors flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              View Exhibition Hub
            </button>
          )}
          <button
            onClick={openEditModal}
            className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-medium rounded-xl transition-colors flex items-center gap-1.5"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Edit Stall
          </button>
          {booth.status !== 'archived' && (
            <button
              onClick={() => setIsArchiveConfirmOpen(true)}
              className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 hover:text-red-400 text-xs font-medium rounded-xl transition-colors flex items-center gap-1.5"
            >
              <Archive className="w-3.5 h-3.5" />
              Archive
            </button>
          )}
        </div>
      </div>

      {/* Hero Header Card */}
      <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-6 shadow-md space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span
                className={`px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md border ${getStatusBadge(
                  booth.status
                )}`}
              >
                {booth.status.replace('_', ' ')}
              </span>
              <span className="text-xs font-mono text-zinc-500">ID: {booth.id}</span>
            </div>
            <h1 className="text-2xl font-extrabold text-zinc-100 tracking-tight flex items-center gap-2">
              <span className="text-amber-400">{booth.booth_number}</span>
              <span className="text-zinc-600 font-light">—</span>
              <span>{booth.client_name}</span>
            </h1>
            <p className="text-xs text-zinc-400 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-amber-500/80 shrink-0" />
              {booth.event_name ? `${booth.event_name} (${booth.event_city})` : 'Unassigned Exhibition'}
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-3 shrink-0 text-center">
            <div className="px-3 border-r border-zinc-800">
              <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Size</span>
              <div className="text-sm font-bold text-zinc-200 mt-0.5">{booth.stand_size || '—'}</div>
            </div>
            <div className="px-3">
              <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Type</span>
              <div className="text-sm font-bold text-amber-400 mt-0.5">{booth.booth_type || 'Custom'}</div>
            </div>
          </div>
        </div>

        {/* PRIMARY GOOGLE DRIVE FOLDER BANNER (V1 Core Requirement) */}
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-wider flex items-center gap-1.5">
                Main Google Drive Project Hub
                <span className="text-[10px] font-normal px-2 py-0.2 rounded bg-amber-500/20 text-amber-300">
                  Google Drive Links Only
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400 mt-0.5 font-mono truncate max-w-md">
                {booth.main_drive_folder_url || 'No Google Drive folder linked yet'}
              </p>
            </div>
          </div>

          {booth.main_drive_folder_url ? (
            <a
              href={booth.main_drive_folder_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-md shadow-amber-500/10 flex items-center gap-1.5 shrink-0"
            >
              <span>Open Google Drive Folder</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          ) : (
            <button
              onClick={openEditModal}
              className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-amber-500/30 font-semibold text-xs rounded-xl transition-colors shrink-0"
            >
              + Link Drive Folder
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-zinc-800/80 pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.step && (
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-800/80 text-zinc-500">
                  {tab.step}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Client & Contact Information */}
          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-amber-400" />
              Client & Contact Details
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-zinc-800/60">
                <span className="text-zinc-500">Brand / Client:</span>
                <span className="font-semibold text-zinc-100">{booth.client_name}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-800/60">
                <span className="text-zinc-500">Contact Person:</span>
                <span className="font-medium text-zinc-200">{booth.contact_person || '—'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-800/60">
                <span className="text-zinc-500">Phone Number:</span>
                <span className="font-mono text-zinc-200">
                  {booth.phone ? (
                    <a href={`tel:${booth.phone}`} className="text-amber-400 hover:underline">
                      {booth.phone}
                    </a>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-zinc-500">Email Address:</span>
                <span className="text-zinc-200">
                  {booth.email ? (
                    <a href={`mailto:${booth.email}`} className="text-amber-400 hover:underline">
                      {booth.email}
                    </a>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Stand Specifications & Budget */}
          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
              <Maximize2 className="w-4 h-4 text-amber-400" />
              Fabrication & Financials
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-zinc-800/60">
                <span className="text-zinc-500">Stall Dimensions:</span>
                <span className="font-semibold text-zinc-100">{booth.stand_size || '—'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-800/60">
                <span className="text-zinc-500">Fabrication Type:</span>
                <span className="font-medium text-zinc-200">{booth.booth_type || 'Custom Stall'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-800/60">
                <span className="text-zinc-500">Target Budget:</span>
                <span className="font-mono font-semibold text-zinc-200">
                  {booth.budget ? `₹ ${booth.budget.toLocaleString('en-IN')}` : '—'}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-zinc-500">Quoted Amount:</span>
                <span className="font-mono font-bold text-amber-400">
                  {booth.quoted_amount ? `₹ ${booth.quoted_amount.toLocaleString('en-IN')}` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Special Instructions & Notes */}
          {booth.notes && (
            <div className="md:col-span-2 bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-5 space-y-2 text-xs">
              <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                Notes & Client Specifications
              </h3>
              <p className="whitespace-pre-line text-zinc-300 leading-relaxed">{booth.notes}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'design' && <DesignTab boothId={booth.id} />}

      {activeTab === 'print' && <PrintTab boothId={booth.id} />}

      {activeTab === 'production' && <ProductionTab boothId={booth.id} />}

      {activeTab === 'furniture' && <FurnitureTab boothId={booth.id} />}

      {activeTab === 'electrical' && <ElectricalTab boothId={booth.id} />}

      {activeTab === 'drive' && (
        <DriveLinksTab
          boothId={booth.id}
          mainDriveFolderUrl={booth.main_drive_folder_url}
          onOpenEditBooth={openEditModal}
        />
      )}

      {activeTab === 'checklist' && (
        <ChecklistCostingTab boothId={booth.id} booth={booth} />
      )}

      {/* Edit Booth Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={`Edit Stall: ${booth.booth_number} (${booth.client_name})`}
      >
        <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
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
              {events.map((evt) => (
                <option key={evt.id} value={evt.id}>
                  {evt.name} ({evt.city})
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
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
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
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
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
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Phone</label>
              <input
                type="text"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Email</label>
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Stand Dimensions</label>
              <input
                type="text"
                value={formStandSize}
                onChange={(e) => setFormStandSize(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
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
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-zinc-100 focus:outline-none focus:border-amber-500/60 font-mono text-[11px]"
            />
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
              <label className="block text-zinc-300 font-medium mb-1">Budget (₹)</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={formBudget}
                onChange={(e) => setFormBudget(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Quoted (₹)</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={formQuotedAmount}
                onChange={(e) => setFormQuotedAmount(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Notes</label>
            <textarea
              rows={2}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold rounded-xl transition-all shadow-md shadow-amber-500/10 disabled:opacity-50"
            >
              {formSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Archive Booth Modal */}
      <Modal
        isOpen={isArchiveConfirmOpen}
        onClose={() => setIsArchiveConfirmOpen(false)}
        title="Confirm Safe Archiving"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <p className="text-zinc-300">
            Are you sure you want to archive stall{' '}
            <span className="font-bold text-zinc-100">{booth.booth_number}</span> ({booth.client_name})?
          </p>
          <p className="text-zinc-500">
            This will mark the stall as archived. All Google Drive links and notes remain preserved.
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
              {formSubmitting ? 'Archiving...' : 'Archive Stall'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
