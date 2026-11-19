import React, { useState, useEffect } from 'react';
import { Layers, AlertTriangle, Building, Phone, Check } from 'lucide-react';
import { Modal } from './Modal';
import { EventItem, BoothItem } from './types';
import { createBooth } from './api';

interface AddBoothModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: EventItem[];
  defaultEventId?: string;
  existingBooths?: BoothItem[];
  onSuccess: (newBooth: BoothItem) => void;
}

// Limited verified booth size options from public site and venue references
const BOOTH_SIZE_OPTIONS = [
  '3 × 3 m (9 sq.m)',
  '6 × 3 m (18 sq.m)',
  '6 × 6 m (36 sq.m)',
  '27 sq. m',
  'Startup Stall (2 × 2 m)',
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
  const [selectedEventId, setSelectedEventId] = useState<string>(defaultEventId);
  const [boothNumber, setBoothNumber] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [mobileNumber, setMobileNumber] = useState<string>('');
  const [boothSize, setBoothSize] = useState<string>('3 × 3 m (9 sq.m)');
  const [structureType, setStructureType] = useState<'Wooden' | 'Octonorm'>('Wooden');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [duplicateWarning, setDuplicateWarning] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setSelectedEventId(defaultEventId || (events[0]?.id ?? ''));
      setBoothNumber('');
      setCompanyName('');
      setMobileNumber('');
      setBoothSize('3 × 3 m (9 sq.m)');
      setStructureType('Wooden');
      setError('');
      setDuplicateWarning('');
    }
  }, [isOpen, defaultEventId, events]);

  // Check duplicate booth number within selected event
  useEffect(() => {
    const trimmed = boothNumber.trim().toUpperCase();
    if (!trimmed || !selectedEventId) {
      setDuplicateWarning('');
      return;
    }
    const duplicate = existingBooths.some(
      (b) => b.event_id === selectedEventId && b.booth_number.trim().toUpperCase() === trimmed
    );
    if (duplicate) {
      setDuplicateWarning(`Booth #${trimmed} is already registered under this exhibition.`);
    } else {
      setDuplicateWarning('');
    }
  }, [boothNumber, selectedEventId, existingBooths]);

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedEventId) {
      setError('Please select an exhibition.');
      return;
    }
    if (!boothNumber.trim()) {
      setError('Booth number is required.');
      return;
    }
    if (!companyName.trim() || companyName.trim().length < 2) {
      setError('Company name must be at least 2 characters.');
      return;
    }

    // Mobile number validation if provided (supports 10-digit Indian and optional international)
    const phoneClean = mobileNumber.trim();
    if (phoneClean && !/^(\+?\d{1,4}[- ]?)?\d{10}$/.test(phoneClean.replace(/[\s()-]/g, ''))) {
      setError('Please enter a valid mobile number (e.g. 9876543210 or +91 98765 43210).');
      return;
    }

    setSubmitting(true);
    try {
      const newBooth = await createBooth({
        event_id: selectedEventId,
        booth_number: boothNumber.trim(),
        client_name: companyName.trim(),
        phone: phoneClean || undefined,
        stand_size: boothSize,
        booth_type: structureType,
        status: 'draft',
      });

      onSuccess(newBooth);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create booth.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Booth"
      subtitle="Enter the basic details. Add the rest later."
      maxWidth="max-w-[560px]"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs" noValidate>
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Exhibition Selector (Only shown if opened globally without preselected event) */}
        {!defaultEventId ? (
          <div className="space-y-1.5">
            <label className="block text-zinc-300 font-medium">
              Select Exhibition <span className="text-amber-500">*</span>
            </label>
            <select
              required
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full bg-[#1c1f2a] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500/80 cursor-pointer transition-all"
            >
              {events.map((evt) => (
                <option key={evt.id} value={evt.id}>
                  {evt.name} — {evt.city} ({evt.start_date})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="bg-[#1c1f2a] border border-white/[0.08] rounded-xl px-3.5 py-2 flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-medium text-zinc-500">Exhibition:</span>
            <span className="font-semibold text-zinc-200 truncate ml-2">
              {selectedEvent?.name ?? 'Current Exhibition'} ({selectedEvent?.city})
            </span>
          </div>
        )}

        {/* Row 1: Booth Number — Company Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <label className="block text-zinc-300 font-medium">
              Booth Number <span className="text-amber-500">*</span>
            </label>
            <input
              type="text"
              required
              value={boothNumber}
              onChange={(e) => setBoothNumber(e.target.value)}
              placeholder="e.g. A-12, B-05, A54-A49"
              className={`w-full bg-[#1c1f2a] border ${
                duplicateWarning ? 'border-amber-500/80' : 'border-white/[0.08] focus:border-amber-500/80'
              } rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none font-mono transition-all`}
            />
            {duplicateWarning && (
              <p className="text-[10px] text-amber-400 font-medium">{duplicateWarning}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-zinc-300 font-medium">
              Company Name <span className="text-amber-500">*</span>
            </label>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. MagnusMinds Technologies"
              className="w-full bg-[#1c1f2a] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500/80 transition-all"
            />
          </div>
        </div>

        {/* Row 2: Mobile Number — Booth Size */}
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
            <label className="block text-zinc-300 font-medium">Booth Size</label>
            <select
              value={boothSize}
              onChange={(e) => setBoothSize(e.target.value)}
              className="w-full bg-[#1c1f2a] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500/80 cursor-pointer transition-all"
            >
              {BOOTH_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 3: Structure Type */}
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
              {structureType === 'Wooden' && <Check className="w-4 h-4 text-amber-400" />}
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
                <div className="text-[10px] text-zinc-500 font-normal">Modular aluminum system</div>
              </div>
              {structureType === 'Octonorm' && <Check className="w-4 h-4 text-amber-400" />}
            </button>
          </div>
        </div>

        {/* Footer: Cancel | Add Booth */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.07]">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl transition-all shadow-sm shadow-amber-500/20 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
          >
            {submitting ? 'Adding...' : 'Add Booth'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
