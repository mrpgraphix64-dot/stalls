import React, { useState, useEffect, useRef } from 'react';
import {
  Building,
  Layers,
  MapPin,
  Search,
  Check,
  AlertTriangle,
  ExternalLink,
  Plus,
  Loader2,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { Modal } from './Modal';
import { EventItem, ExhibitorItem, BoothItem } from './types';
import { createBooth, fetchExhibitors, createExhibitor } from './api';
import {
  VERIFIED_STALLS,
  STALL_SIZE_OPTIONS,
  STALL_TYPE_OPTIONS,
  matchFloorplanStall,
  OFFICIAL_FLOORPLAN_PDF,
} from './floorplanData';
import { FloorplanViewerModal } from './FloorplanViewerModal';

interface AddStallModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: EventItem[];
  defaultEventId?: string;
  existingBooths?: BoothItem[];
  onSuccess: (newBooth: BoothItem) => void;
}

export function AddStallModal({
  isOpen,
  onClose,
  events,
  defaultEventId = '',
  existingBooths = [],
  onSuccess,
}: AddStallModalProps) {
  // Form State
  const [selectedEventId, setSelectedEventId] = useState<string>(defaultEventId);
  const [companyName, setCompanyName] = useState<string>('');
  const [stallNumber, setStallNumber] = useState<string>('');
  const [standSize, setStandSize] = useState<string>('');
  const [boothType, setBoothType] = useState<string>('Custom Stall');

  // Exhibitors Directory Data & Search
  const [exhibitors, setExhibitors] = useState<ExhibitorItem[]>([]);
  const [exhibitorSearch, setExhibitorSearch] = useState<string>('');
  const [isExhibitorDropdownOpen, setIsExhibitorDropdownOpen] = useState<boolean>(false);
  const [loadingExhibitors, setLoadingExhibitors] = useState<boolean>(false);

  // Stall Number Dropdown & Suggestions
  const [isStallDropdownOpen, setIsStallDropdownOpen] = useState<boolean>(false);
  const [isFloorplanModalOpen, setIsFloorplanModalOpen] = useState<boolean>(false);

  // Form Handling
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const exhibitorRef = useRef<HTMLDivElement>(null);
  const stallRef = useRef<HTMLDivElement>(null);

  // Reset & initialize on open
  useEffect(() => {
    if (isOpen) {
      const initialEvent = defaultEventId || (events[0]?.id ?? '');
      setSelectedEventId(initialEvent);
      setCompanyName('');
      setExhibitorSearch('');
      setStallNumber('');
      setStandSize('');
      setBoothType('Custom Stall');
      setError('');
      loadExhibitorsList();
    }
  }, [isOpen, defaultEventId, events]);

  const loadExhibitorsList = async () => {
    try {
      setLoadingExhibitors(true);
      const data = await fetchExhibitors({ limit: 250 });
      setExhibitors(data);
    } catch (e) {
      console.warn('Failed to fetch exhibitors catalogue:', e);
    } finally {
      setLoadingExhibitors(false);
    }
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (exhibitorRef.current && !exhibitorRef.current.contains(e.target as Node)) {
        setIsExhibitorDropdownOpen(false);
      }
      if (stallRef.current && !stallRef.current.contains(e.target as Node)) {
        setIsStallDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // When a verified exhibitor is selected
  const handleSelectExhibitor = (ex: ExhibitorItem) => {
    setCompanyName(ex.company_name);
    setExhibitorSearch(ex.company_name);
    setIsExhibitorDropdownOpen(false);

    // If exhibitor has a known booth in the official catalogue, auto-suggest it
    if (ex.booth_number && !stallNumber) {
      applyStallNumber(ex.booth_number);
    }
  };

  // When a stall number is selected or typed
  const applyStallNumber = (num: string) => {
    setStallNumber(num);
    setIsStallDropdownOpen(false);

    // Match against floor plan catalogue to autofill size & type
    const matched = matchFloorplanStall(num);
    if (matched) {
      setStandSize(matched.size);
      setBoothType(matched.type);
    }
  };

  // Check for duplicate stall number under the current event
  const isDuplicateStall = Boolean(
    stallNumber.trim() &&
      existingBooths.some(
        (b) =>
          b.event_id === selectedEventId &&
          b.booth_number.trim().toLowerCase() === stallNumber.trim().toLowerCase() &&
          b.status !== 'archived'
      )
  );

  // Filter exhibitors for combobox
  const filteredExhibitors = exhibitors.filter((ex) =>
    ex.company_name.toLowerCase().includes(exhibitorSearch.toLowerCase().trim()) ||
    (ex.booth_number && ex.booth_number.toLowerCase().includes(exhibitorSearch.toLowerCase().trim()))
  );

  // Filter verified stalls for combobox
  const filteredStalls = VERIFIED_STALLS.filter((s) =>
    s.number.toLowerCase().includes(stallNumber.toLowerCase().trim())
  ).slice(0, 15);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId) {
      setError('Please select an exhibition.');
      return;
    }
    if (!companyName.trim()) {
      setError('Please select or enter an exhibitor / company name.');
      return;
    }
    if (!stallNumber.trim()) {
      setError('Please enter a stall number.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload: Partial<BoothItem> = {
        event_id: selectedEventId,
        client_name: companyName.trim(),
        booth_number: stallNumber.trim(),
        stand_size: standSize.trim() || undefined,
        booth_type: boothType.trim() || undefined,
        status: 'draft',
      };

      const newBooth = await createBooth(payload);
      onSuccess(newBooth);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create stall. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Add New Stall"
        subtitle="Select an exhibitor and assign their exhibition stall."
        maxWidth="max-w-[560px]"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Exhibition Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-300">
              Exhibition <span className="text-amber-500">*</span>
            </label>
            <div className="relative">
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 outline-none transition-colors appearance-none cursor-pointer"
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

          {/* 2. Exhibitor / Company (Searchable Combobox) */}
          <div className="space-y-1.5 relative" ref={exhibitorRef}>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-zinc-300">
                Exhibitor / Company <span className="text-amber-500">*</span>
              </label>
              <span className="text-[10px] text-zinc-500">
                {exhibitors.length} in catalogue
              </span>
            </div>

            <div className="relative">
              <input
                type="text"
                value={exhibitorSearch}
                onChange={(e) => {
                  setExhibitorSearch(e.target.value);
                  setCompanyName(e.target.value);
                  setIsExhibitorDropdownOpen(true);
                }}
                onFocus={() => setIsExhibitorDropdownOpen(true)}
                placeholder="Search or enter company name..."
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
              />
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>

            {/* Dropdown suggestions */}
            {isExhibitorDropdownOpen && (
              <div className="absolute z-50 left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl divide-y divide-zinc-800/60 text-xs animate-in fade-in duration-100">
                {exhibitorSearch.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      setCompanyName(exhibitorSearch.trim());
                      setIsExhibitorDropdownOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2.5 text-amber-400 hover:bg-zinc-800/80 flex items-center gap-2 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Use custom: <strong>"{exhibitorSearch.trim()}"</strong></span>
                  </button>
                )}

                {filteredExhibitors.length === 0 ? (
                  <div className="p-3 text-center text-zinc-500 text-[11px]">
                    No matching company in catalogue. You can still use the custom name above.
                  </div>
                ) : (
                  filteredExhibitors.slice(0, 30).map((ex) => (
                    <button
                      key={ex.id}
                      type="button"
                      onClick={() => handleSelectExhibitor(ex)}
                      className="w-full text-left px-3.5 py-2 hover:bg-zinc-800/80 flex items-center justify-between text-zinc-200 transition-colors"
                    >
                      <div className="truncate mr-2">
                        <span className="font-semibold text-zinc-100">{ex.company_name}</span>
                        {ex.city && <span className="text-[10px] text-zinc-500 ml-1.5">• {ex.city}</span>}
                      </div>
                      {ex.booth_number && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-amber-400 border border-zinc-700">
                          {ex.booth_number}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* 3. Stall Number Selector & Floor Plan Link */}
          <div className="space-y-1.5 relative" ref={stallRef}>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-zinc-300">
                Stall Number <span className="text-amber-500">*</span>
              </label>

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
                value={stallNumber}
                onChange={(e) => {
                  const val = e.target.value;
                  setStallNumber(val);
                  setIsStallDropdownOpen(true);
                  const matched = matchFloorplanStall(val);
                  if (matched) {
                    setStandSize(matched.size);
                    setBoothType(matched.type);
                  }
                }}
                onFocus={() => setIsStallDropdownOpen(true)}
                placeholder="e.g. D2, B5, A72, or A54-A49"
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors font-mono"
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

            {/* Duplicate Stall Warning */}
            {isDuplicateStall && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Notice: Stall <strong>{stallNumber}</strong> is already registered under this exhibition. Multiple client assignments or split stalls will share this number.</span>
              </div>
            )}

            {/* Stall Dropdown suggestions */}
            {isStallDropdownOpen && (
              <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl divide-y divide-zinc-800/60 text-xs animate-in fade-in duration-100">
                {stallNumber.trim() && (
                  <button
                    type="button"
                    onClick={() => applyStallNumber(stallNumber.trim())}
                    className="w-full text-left px-3 py-2 text-amber-400 hover:bg-zinc-800/80 flex items-center gap-1.5 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Assign: <strong>"{stallNumber.trim()}"</strong></span>
                  </button>
                )}

                {filteredStalls.map((s) => (
                  <button
                    key={s.number}
                    type="button"
                    onClick={() => applyStallNumber(s.number)}
                    className="w-full text-left px-3 py-2 hover:bg-zinc-800/80 flex items-center justify-between text-zinc-200 transition-colors"
                  >
                    <span className="font-mono font-bold text-zinc-100">{s.number}</span>
                    <span className="text-[10px] text-zinc-400">{s.size} • {s.type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 4 & 5. Stall Size & Stall Type (2 columns) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Stall Size */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">
                Stall Size <span className="text-zinc-500">(autofilled)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  list="stall-sizes"
                  value={standSize}
                  onChange={(e) => setStandSize(e.target.value)}
                  placeholder="e.g. 3m x 3m, 6m x 6m"
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl px-3 py-2.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors font-mono"
                />
                <datalist id="stall-sizes">
                  {STALL_SIZE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Stall Type */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">
                Stall Type <span className="text-zinc-500">(autofilled)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  list="stall-types"
                  value={boothType}
                  onChange={(e) => setBoothType(e.target.value)}
                  placeholder="e.g. Custom Stall, 3x3 Standard"
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl px-3 py-2.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
                />
                <datalist id="stall-types">
                  {STALL_TYPE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 text-xs font-bold rounded-xl transition-all shadow-md shadow-amber-500/10 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating Stall...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Stall</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Pop-up Floor Plan Viewer */}
      <FloorplanViewerModal
        isOpen={isFloorplanModalOpen}
        onClose={() => setIsFloorplanModalOpen(false)}
        highlightStall={stallNumber}
      />
    </>
  );
}
