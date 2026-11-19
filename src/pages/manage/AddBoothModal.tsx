import React, { useState, useEffect, useRef } from 'react';
import {
  Layers,
  AlertTriangle,
  Building,
  Phone,
  Check,
  Search,
  ExternalLink,
  Plus,
  Loader2,
  Calendar,
} from 'lucide-react';
import { Modal } from './Modal';
import { EventItem, BoothItem, ExhibitorItem } from './types';
import { createBooth, fetchExhibitors } from './api';
import {
  VERIFIED_STALLS,
  matchFloorplanStall,
  OFFICIAL_FLOORPLAN_PDF,
} from './floorplanData';
import { FloorplanViewerModal } from './FloorplanViewerModal';

interface AddBoothModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: EventItem[];
  defaultEventId?: string;
  existingBooths?: BoothItem[];
  onSuccess: (newBooth: BoothItem) => void;
}

const BOOTH_SIZE_OPTIONS = [
  '3 × 3 m (9 sq.m)',
  '6 × 3 m (18 sq.m)',
  '6 × 6 m (36 sq.m)',
  '27 sq. m',
  'Startup Stall (3 × 2 m)',
  'Custom Size',
];

export function AddBoothModal({
  isOpen,
  onClose,
  events,
  defaultEventId = '',
  existingBooths = [],
  onSuccess,
}: AddBoothModalProps) {
  // Form State
  const [selectedEventId, setSelectedEventId] = useState<string>(defaultEventId);
  const [companyName, setCompanyName] = useState<string>('');
  const [stallNumber, setStallNumber] = useState<string>('');
  const [mobileNumber, setMobileNumber] = useState<string>('');
  const [boothSize, setBoothSize] = useState<string>('3 × 3 m (9 sq.m)');
  const [structureType, setStructureType] = useState<'Wooden' | 'Octonorm'>('Wooden');

  // Catalogue & Autocomplete State
  const [exhibitors, setExhibitors] = useState<ExhibitorItem[]>([]);
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState<boolean>(false);
  const [isStallDropdownOpen, setIsStallDropdownOpen] = useState<boolean>(false);
  const [isFloorplanModalOpen, setIsFloorplanModalOpen] = useState<boolean>(false);

  // Form Submission
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [duplicateWarning, setDuplicateWarning] = useState<string>('');

  const companyRef = useRef<HTMLDivElement>(null);
  const stallRef = useRef<HTMLDivElement>(null);

  // Initialize and load catalogue
  useEffect(() => {
    if (isOpen) {
      setSelectedEventId(defaultEventId || (events[0]?.id ?? ''));
      setCompanyName('');
      setStallNumber('');
      setMobileNumber('');
      setBoothSize('3 × 3 m (9 sq.m)');
      setStructureType('Wooden');
      setError('');
      setDuplicateWarning('');
      setIsCompanyDropdownOpen(false);
      setIsStallDropdownOpen(false);
      loadExhibitors();
    }
  }, [isOpen, defaultEventId, events]);

  const loadExhibitors = async () => {
    try {
      const data = await fetchExhibitors({ limit: 200 });
      setExhibitors(data || []);
    } catch (e) {
      // Non-blocking fallback
      setExhibitors([]);
    }
  };

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (companyRef.current && !companyRef.current.contains(e.target as Node)) {
        setIsCompanyDropdownOpen(false);
      }
      if (stallRef.current && !stallRef.current.contains(e.target as Node)) {
        setIsStallDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Duplicate stall detection
  useEffect(() => {
    const trimmed = stallNumber.trim().toUpperCase();
    if (!trimmed || !selectedEventId) {
      setDuplicateWarning('');
      return;
    }
    const duplicate = existingBooths.some(
      (b) =>
        b.event_id === selectedEventId &&
        b.booth_number.trim().toUpperCase() === trimmed &&
        b.status !== 'archived'
    );
    if (duplicate) {
      setDuplicateWarning(`Notice: Stall #${trimmed} is already registered under this exhibition.`);
    } else {
      setDuplicateWarning('');
    }
  }, [stallNumber, selectedEventId, existingBooths]);

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  // Filtered companies: show max 5-6 suggestions to prevent tall menus
  const filteredExhibitors = companyName.trim()
    ? exhibitors
        .filter((ex) =>
          ex.company_name.toLowerCase().includes(companyName.toLowerCase().trim()) ||
          (ex.booth_number && ex.booth_number.toLowerCase().includes(companyName.toLowerCase().trim()))
        )
        .slice(0, 5)
    : [];

  // Filtered stalls: show max 5-6 suggestions
  const filteredStalls = stallNumber.trim()
    ? VERIFIED_STALLS.filter((s) =>
        s.number.toLowerCase().includes(stallNumber.toLowerCase().trim())
      ).slice(0, 6)
    : VERIFIED_STALLS.slice(0, 6);

  // Handle company pick
  const handleSelectCompany = (ex: ExhibitorItem) => {
    setCompanyName(ex.company_name);
    setIsCompanyDropdownOpen(false);
    if (ex.booth_number && !stallNumber) {
      handleSelectStall(ex.booth_number);
    }
  };

  // Handle stall pick or typing
  const handleSelectStall = (num: string) => {
    setStallNumber(num);
    setIsStallDropdownOpen(false);
    const matched = matchFloorplanStall(num);
    if (matched) {
      // Map to standard booth sizes
      if (matched.size.includes('6m x 6m') || matched.size.includes('36')) {
        setBoothSize('6 × 6 m (36 sq.m)');
      } else if (matched.size.includes('6m x 3m') || matched.size.includes('18')) {
        setBoothSize('6 × 3 m (18 sq.m)');
      } else if (matched.size.includes('27')) {
        setBoothSize('27 sq. m');
      } else if (matched.size.includes('3m x 2m') || matched.category === 'startup') {
        setBoothSize('Startup Stall (3 × 2 m)');
      } else {
        setBoothSize('3 × 3 m (9 sq.m)');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedEventId) {
      setError('Please select an exhibition.');
      return;
    }
    if (!stallNumber.trim()) {
      setError('Stall number is required.');
      return;
    }
    if (!companyName.trim() || companyName.trim().length < 2) {
      setError('Company name must be at least 2 characters.');
      return;
    }

    const phoneClean = mobileNumber.trim();
    if (phoneClean && !/^(\+?\d{1,4}[- ]?)?\d{10}$/.test(phoneClean.replace(/[\s()-]/g, ''))) {
      setError('Please enter a valid mobile number (e.g. 9876543210 or +91 98765 43210).');
      return;
    }

    setSubmitting(true);
    try {
      const newBooth = await createBooth({
        event_id: selectedEventId,
        booth_number: stallNumber.trim(),
        client_name: companyName.trim(),
        phone: phoneClean || undefined,
        stand_size: boothSize,
        booth_type: structureType,
        status: 'draft',
      });

      onSuccess(newBooth);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to register stall.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Add Stall"
        subtitle="Quickly register a stall under this exhibition."
        maxWidth="max-w-[540px]"
      >
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[80vh]" noValidate>
          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto space-y-4 px-1 py-1 text-xs">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* 1. Exhibition */}
            {!defaultEventId ? (
              <div className="space-y-1.5">
                <label className="block text-zinc-300 font-medium">
                  Exhibition <span className="text-amber-500">*</span>
                </label>
                <div className="relative">
                  <select
                    required
                    value={selectedEventId}
                    onChange={(e) => setSelectedEventId(e.target.value)}
                    className="w-full bg-[#1c1f2a] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500/80 cursor-pointer appearance-none transition-all"
                  >
                    {events.map((evt) => (
                      <option key={evt.id} value={evt.id} className="bg-zinc-900 text-zinc-100">
                        {evt.name} — {evt.city} ({evt.start_date})
                      </option>
                    ))}
                  </select>
                  <Calendar className="w-4 h-4 text-zinc-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            ) : (
              <div className="bg-[#1c1f2a] border border-white/[0.08] rounded-xl px-3.5 py-2 flex items-center justify-between text-zinc-400">
                <span className="text-[11px] font-medium text-zinc-500">Exhibition:</span>
                <span className="font-semibold text-zinc-200 truncate ml-2">
                  {selectedEvent?.name ?? 'Current Exhibition'} ({selectedEvent?.city})
                </span>
              </div>
            )}

            {/* 2. Company Name with compact autocomplete */}
            <div className="space-y-1.5 relative" ref={companyRef}>
              <div className="flex items-center justify-between">
                <label className="block text-zinc-300 font-medium">
                  Company Name <span className="text-amber-500">*</span>
                </label>
                {exhibitors.length > 0 && (
                  <span className="text-[10px] text-zinc-500">
                    {exhibitors.length} in catalogue
                  </span>
                )}
              </div>
              <div className="relative">
                <Building className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => {
                    setCompanyName(e.target.value);
                    setIsCompanyDropdownOpen(true);
                  }}
                  onFocus={() => {
                    if (companyName.trim()) setIsCompanyDropdownOpen(true);
                  }}
                  placeholder="e.g. MagnusMinds Technologies or type company..."
                  className="w-full bg-[#1c1f2a] border border-white/[0.08] rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500/80 transition-all"
                />
              </div>

              {/* Compact Company Dropdown (max-h ~180px, max 5 items) */}
              {isCompanyDropdownOpen && filteredExhibitors.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1 max-h-44 overflow-y-auto bg-[#1c1f2a] border border-white/[0.12] rounded-xl shadow-2xl divide-y divide-white/[0.06] text-xs">
                  {filteredExhibitors.map((ex) => (
                    <button
                      key={ex.id}
                      type="button"
                      onClick={() => handleSelectCompany(ex)}
                      className="w-full text-left px-3.5 py-2 hover:bg-white/[0.06] flex items-center justify-between text-zinc-200 transition-colors cursor-pointer"
                    >
                      <div className="truncate mr-2">
                        <span className="font-semibold text-zinc-100">{ex.company_name}</span>
                        {ex.city && <span className="text-[10px] text-zinc-500 ml-1.5">• {ex.city}</span>}
                      </div>
                      {ex.booth_number && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-amber-400 border border-white/[0.08]">
                          Stall {ex.booth_number}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Stall Number with Floor Plan Link beside Label */}
            <div className="space-y-1.5 relative" ref={stallRef}>
              <div className="flex items-center justify-between">
                <label className="block text-zinc-300 font-medium">
                  Stall Number <span className="text-amber-500">*</span>
                </label>

                {/* Floor Plan Link placed directly beside stall-number label */}
                <button
                  type="button"
                  onClick={() => setIsFloorplanModalOpen(true)}
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span>View Floor Plan</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  required
                  value={stallNumber}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStallNumber(val);
                    setIsStallDropdownOpen(true);
                    const matched = matchFloorplanStall(val);
                    if (matched) {
                      handleSelectStall(val);
                    }
                  }}
                  onFocus={() => setIsStallDropdownOpen(true)}
                  placeholder="e.g. A-12, B-05, D-02 or type directly..."
                  className={`w-full bg-[#1c1f2a] border ${
                    duplicateWarning ? 'border-amber-500/80' : 'border-white/[0.08] focus:border-amber-500/80'
                  } rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none font-mono transition-all`}
                />
                {matchFloorplanStall(stallNumber) && (
                  <span
                    title="Verified on Official Floor Plan"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400 text-[10px] font-semibold bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded"
                  >
                    Verified
                  </span>
                )}
              </div>

              {duplicateWarning && (
                <p className="text-[10px] text-amber-400 font-medium">{duplicateWarning}</p>
              )}

              {/* Compact Stall Suggestions Dropdown (max-h ~200px, max 5-6 items) */}
              {isStallDropdownOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-[#1c1f2a] border border-white/[0.12] rounded-xl shadow-2xl divide-y divide-white/[0.06] text-xs">
                  {stallNumber.trim() && (
                    <button
                      type="button"
                      onClick={() => handleSelectStall(stallNumber.trim())}
                      className="w-full text-left px-3 py-2 text-amber-400 hover:bg-white/[0.06] flex items-center gap-1.5 font-medium cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Use typed: <strong>"{stallNumber.trim()}"</strong></span>
                    </button>
                  )}

                  {filteredStalls.map((s) => (
                    <button
                      key={s.number}
                      type="button"
                      onClick={() => handleSelectStall(s.number)}
                      className="w-full text-left px-3 py-2 hover:bg-white/[0.06] flex items-center justify-between text-zinc-200 transition-colors cursor-pointer"
                    >
                      <span className="font-mono font-bold text-zinc-100">{s.number}</span>
                      <span className="text-[10px] text-zinc-400">{s.size} • {s.type}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 4. Row: Mobile Number — Stall Size */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="block text-zinc-300 font-medium">
                  Mobile Number <span className="text-zinc-500 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full bg-[#1c1f2a] border border-white/[0.08] rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500/80 font-mono transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-zinc-300 font-medium">Stall Size</label>
                <select
                  value={boothSize}
                  onChange={(e) => setBoothSize(e.target.value)}
                  className="w-full bg-[#1c1f2a] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500/80 cursor-pointer transition-all"
                >
                  {BOOTH_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size} className="bg-zinc-900 text-zinc-100">
                      {size}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 5. Structure Type: Wooden / Octonorm */}
            <div className="space-y-1.5">
              <label className="block text-zinc-300 font-medium">Structure Type</label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setStructureType('Wooden')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    structureType === 'Wooden'
                      ? 'bg-amber-500/10 border-amber-500/60 text-amber-400 font-bold'
                      : 'bg-[#1c1f2a] border-white/[0.08] text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div>
                    <div className="text-xs">Wooden</div>
                    <div className="text-[10px] text-zinc-500 font-normal">Custom fabrication</div>
                  </div>
                  {structureType === 'Wooden' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </button>

                <button
                  type="button"
                  onClick={() => setStructureType('Octonorm')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    structureType === 'Octonorm'
                      ? 'bg-amber-500/10 border-amber-500/60 text-amber-400 font-bold'
                      : 'bg-[#1c1f2a] border-white/[0.08] text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div>
                    <div className="text-xs">Octonorm</div>
                    <div className="text-[10px] text-zinc-500 font-normal">Modular shell scheme</div>
                  </div>
                  {structureType === 'Octonorm' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </button>
              </div>
            </div>
          </div>

          {/* Sticky Modal Footer */}
          <div className="pt-3 mt-3 border-t border-white/[0.08] flex items-center justify-end gap-2.5 shrink-0 bg-[#15171e]">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] text-xs font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-amber-950/30 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Registering...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Stall</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Embedded High-Resolution Vector Floor Plan Modal */}
      <FloorplanViewerModal
        isOpen={isFloorplanModalOpen}
        onClose={() => setIsFloorplanModalOpen(false)}
        eventName={selectedEvent?.name || 'Tech Expo Gujarat 2026'}
        pdfUrl={selectedEvent?.floor_plan_url || null}
        highlightStall={stallNumber || undefined}
      />
    </>
  );
}
