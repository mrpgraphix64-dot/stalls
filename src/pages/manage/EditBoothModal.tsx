import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Building,
  Check,
  ExternalLink,
  Layers,
  Phone,
  HelpCircle,
  Info,
} from 'lucide-react';
import { Modal } from './Modal';
import { BoothItem, EventItem } from './types';
import { updateBooth } from './api';
import { isPendingOrEmpty } from './boothSort';
import { FloorplanViewerModal } from './FloorplanViewerModal';

interface EditBoothModalProps {
  isOpen: boolean;
  onClose: () => void;
  booth: BoothItem | null;
  events?: EventItem[];
  existingBooths?: BoothItem[];
  onSuccess: (updatedBooth: BoothItem) => void;
}

export const BOOTH_SIZE_OPTIONS = [
  '3 × 3 m (9 sq.m)',
  '6 × 3 m (18 sq.m)',
  '6 × 6 m (36 sq.m)',
  '27 sq. m',
  'Startup Stall (3 × 2 m)',
  'Custom Size',
];

export function EditBoothModal({
  isOpen,
  onClose,
  booth,
  events = [],
  existingBooths = [],
  onSuccess,
}: EditBoothModalProps) {
  const [bookingStage, setBookingStage] = useState<'confirmed' | 'discussion'>('confirmed');
  const [boothNumber, setBoothNumber] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [standSize, setStandSize] = useState<string>('3 × 3 m (9 sq.m)');
  const [structureType, setStructureType] = useState<'Wooden' | 'Frame' | 'Customize'>('Wooden');
  const [discussionRemark, setDiscussionRemark] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [duplicateWarning, setDuplicateWarning] = useState<string>('');
  const [isFloorplanModalOpen, setIsFloorplanModalOpen] = useState<boolean>(false);

  // Initialize form state whenever modal opens or target booth changes
  useEffect(() => {
    if (isOpen && booth) {
      const initialStage = booth.booking_stage === 'discussion' ? 'discussion' : 'confirmed';
      setBookingStage(initialStage);

      // Display empty if unassigned / pending / none
      const rawNum = booth.booth_number || '';
      setBoothNumber(isPendingOrEmpty(rawNum) ? '' : rawNum);

      setCompanyName(booth.client_name || '');
      setPhone(booth.phone || '');
      setStandSize(booth.stand_size || '3 × 3 m (9 sq.m)');

      const rawSt = (booth.booth_type || '').toLowerCase();
      if (rawSt.includes('frame') || rawSt.includes('octonorm')) {
        setStructureType('Frame');
      } else if (rawSt.includes('custom')) {
        setStructureType('Customize');
      } else {
        setStructureType('Wooden');
      }

      setDiscussionRemark(booth.discussion_remark || '');
      setError('');
      setDuplicateWarning('');
    }
  }, [isOpen, booth]);

  // Conflict detection for confirmed booth numbers within same event
  useEffect(() => {
    if (!booth || bookingStage !== 'confirmed') {
      setDuplicateWarning('');
      return;
    }

    const trimmed = boothNumber.trim().toUpperCase();
    if (!trimmed) {
      setDuplicateWarning('');
      return;
    }

    const duplicate = existingBooths.some(
      (b) =>
        b.id !== booth.id &&
        b.event_id === booth.event_id &&
        (b.booking_stage === 'confirmed' || !b.booking_stage) &&
        (b.booth_number || '').trim().toUpperCase() === trimmed &&
        b.status !== 'archived'
    );

    if (duplicate) {
      setDuplicateWarning(`Warning: Stall #${trimmed} is already confirmed for another client in this event.`);
    } else {
      setDuplicateWarning('');
    }
  }, [boothNumber, bookingStage, booth, existingBooths]);

  if (!booth) return null;

  const initialStage = booth.booking_stage === 'discussion' ? 'discussion' : 'confirmed';
  const isSwitchingToConfirmed = initialStage === 'discussion' && bookingStage === 'confirmed';
  const isSwitchingToDiscussion = initialStage === 'confirmed' && bookingStage === 'discussion';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!companyName.trim() || companyName.trim().length < 2) {
      setError('Company name must be at least 2 characters.');
      return;
    }

    const trimmedNum = boothNumber.trim();
    if (bookingStage === 'confirmed') {
      if (!trimmedNum || isPendingOrEmpty(trimmedNum)) {
        setError('A valid Stall / Booth number is required for confirmed stalls.');
        return;
      }
    }

    const phoneClean = phone.trim();
    if (phoneClean && !/^(\+?\d{1,4}[- ]?)?\d{10}$/.test(phoneClean.replace(/[\s()-]/g, ''))) {
      setError('Please enter a valid mobile number (e.g. 9876543210 or +91 98765 43210).');
      return;
    }

    setSubmitting(true);
    try {
      const updated = await updateBooth(booth.id, {
        booking_stage: bookingStage,
        booth_number: trimmedNum || undefined,
        client_name: companyName.trim(),
        phone: phoneClean || undefined,
        stand_size: standSize,
        booth_type: structureType,
        discussion_remark: bookingStage === 'discussion' ? (discussionRemark.trim() || undefined) : booth.discussion_remark,
      });

      onSuccess(updated);
      onClose();
    } catch (err: any) {
      // Preserve form values and show exact error message
      setError(err.message || 'Failed to update booth details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={
          initialStage === 'discussion'
            ? `Edit Discussion: ${booth.client_name}`
            : isPendingOrEmpty(booth.booth_number)
            ? `Edit Booth: ${booth.client_name}`
            : `Edit Booth: #${booth.booth_number}`
        }
        subtitle={
          initialStage === 'discussion'
            ? 'Update prospective stall and discussion details or confirm stall'
            : 'Update stall specifications, booking stage, and contact details'
        }
        maxWidth="max-w-[540px]"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs" noValidate>
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {duplicateWarning && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{duplicateWarning}</span>
            </div>
          )}

          {/* 1. Booking Stage Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-zinc-300 font-semibold">Booking Stage</label>
              <span className="text-[11px] text-zinc-500 font-normal">
                {bookingStage === 'confirmed' ? 'Active Production' : 'Ongoing Lead'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setBookingStage('confirmed')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  bookingStage === 'confirmed'
                    ? 'bg-amber-500/10 border-amber-500/60 text-amber-400 font-bold shadow-sm shadow-amber-500/10'
                    : 'bg-[#1c1f2a] border-white/[0.08] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs">Confirmed</span>
                  {bookingStage === 'confirmed' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </div>
                <span className="text-[10px] text-zinc-500 font-normal mt-0.5">
                  Active checklist & production
                </span>
              </button>

              <button
                type="button"
                onClick={() => setBookingStage('discussion')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  bookingStage === 'discussion'
                    ? 'bg-sky-500/10 border-sky-500/60 text-sky-400 font-bold shadow-sm shadow-sky-500/10'
                    : 'bg-[#1c1f2a] border-white/[0.08] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs">Ongoing Discussion</span>
                  {bookingStage === 'discussion' && <Check className="w-3.5 h-3.5 text-sky-400" />}
                </div>
                <span className="text-[10px] text-zinc-500 font-normal mt-0.5">
                  Preliminary lead / unconfirmed
                </span>
              </button>
            </div>
          </div>

          {/* Explicit Transition Warning / Notice */}
          {isSwitchingToDiscussion && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] space-y-1 animate-in fade-in">
              <div className="flex items-center gap-1.5 font-bold text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Notice: Moving to Ongoing Discussion</span>
              </div>
              <p className="text-zinc-300 leading-relaxed">
                This booth will be moved to Ongoing Discussions and excluded from confirmed production totals and checklist stats. All existing checklist tasks, Drive links, and specifications remain safely preserved.
              </p>
            </div>
          )}

          {isSwitchingToConfirmed && (
            <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-300 text-[11px] space-y-1 animate-in fade-in">
              <div className="flex items-center gap-1.5 font-bold text-sky-400">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>Confirming Stall</span>
              </div>
              <p className="text-zinc-300 leading-relaxed">
                This discussion will convert into a confirmed production stall. A valid stall number is required. The 5-section checklist will be automatically initialized if not already created.
              </p>
            </div>
          )}

          {/* 2. Company Name & Stall Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="block text-zinc-300 font-semibold">
                Company Name <span className="text-amber-500">*</span>
              </label>
              <div className="relative">
                <Building className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. MagnusMinds Technologies"
                  className="w-full bg-[#1c1f2a] border border-white/[0.08] rounded-xl pl-9 pr-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500/80 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-zinc-300 font-semibold">
                  Booth / Stall # {bookingStage === 'confirmed' ? (
                    <span className="text-amber-500">*</span>
                  ) : (
                    <span className="text-zinc-500 font-normal">(Optional)</span>
                  )}
                </label>
                <button
                  type="button"
                  onClick={() => setIsFloorplanModalOpen(true)}
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-medium inline-flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span>Floor Plan</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
              <input
                type="text"
                required={bookingStage === 'confirmed'}
                value={boothNumber}
                onChange={(e) => setBoothNumber(e.target.value)}
                placeholder={bookingStage === 'confirmed' ? 'e.g. A-12, B-05' : 'Optional (allot later)'}
                className="w-full bg-[#1c1f2a] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500/80 font-mono transition-all"
              />
            </div>
          </div>

          {/* 3. Mobile Number & Booth Size */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="block text-zinc-300 font-semibold">
                Mobile Number <span className="text-zinc-500 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 98765 43210"
                  className="w-full bg-[#1c1f2a] border border-white/[0.08] rounded-xl pl-9 pr-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500/80 font-mono transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-zinc-300 font-semibold">
                Booth Size {bookingStage === 'discussion' && <span className="text-zinc-500 font-normal">(Optional)</span>}
              </label>
              <select
                value={standSize}
                onChange={(e) => setStandSize(e.target.value)}
                className="w-full bg-[#1c1f2a] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-zinc-100 cursor-pointer focus:outline-none focus:border-amber-500/80 transition-all"
              >
                {BOOTH_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 4. Stall Type (3 Options) */}
          <div className="space-y-1.5">
            <label className="block text-zinc-300 font-semibold">
              Stall Type {bookingStage === 'discussion' && <span className="text-zinc-500 font-normal">(Optional)</span>}
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStructureType('Wooden')}
                className={`p-2.5 rounded-xl border text-left cursor-pointer flex items-center justify-between min-h-[44px] transition-all ${
                  structureType === 'Wooden'
                    ? 'bg-amber-500/10 border-amber-500/60 text-amber-400 font-bold'
                    : 'bg-[#1c1f2a] border-white/[0.08] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>Wooden</span>
                {structureType === 'Wooden' && <Check className="w-3.5 h-3.5 text-amber-400" />}
              </button>
              <button
                type="button"
                onClick={() => setStructureType('Frame')}
                className={`p-2.5 rounded-xl border text-left cursor-pointer flex items-center justify-between min-h-[44px] transition-all ${
                  structureType === 'Frame'
                    ? 'bg-amber-500/10 border-amber-500/60 text-amber-400 font-bold'
                    : 'bg-[#1c1f2a] border-white/[0.08] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>Frame</span>
                {structureType === 'Frame' && <Check className="w-3.5 h-3.5 text-amber-400" />}
              </button>
              <button
                type="button"
                onClick={() => setStructureType('Customize')}
                className={`p-2.5 rounded-xl border text-left cursor-pointer flex items-center justify-between min-h-[44px] transition-all ${
                  structureType === 'Customize'
                    ? 'bg-amber-500/10 border-amber-500/60 text-amber-400 font-bold'
                    : 'bg-[#1c1f2a] border-white/[0.08] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>Customize</span>
                {structureType === 'Customize' && <Check className="w-3.5 h-3.5 text-amber-400" />}
              </button>
            </div>
          </div>

          {/* 5. Discussion Remark (when in Ongoing Discussion stage) */}
          {bookingStage === 'discussion' && (
            <div className="space-y-1.5 animate-in fade-in">
              <label className="block text-zinc-300 font-semibold">
                Discussion Remark <span className="text-zinc-500 font-normal">(Optional)</span>
              </label>
              <textarea
                rows={2}
                value={discussionRemark}
                onChange={(e) => setDiscussionRemark(e.target.value)}
                placeholder="e.g. Waiting for client to approve 3x3 layout quote..."
                className="w-full bg-[#1c1f2a] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 resize-none focus:outline-none focus:border-amber-500/80 transition-all"
              />
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-semibold cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold rounded-xl cursor-pointer shadow-sm shadow-amber-500/20 transition-all disabled:opacity-60"
            >
              {submitting
                ? 'Saving...'
                : isSwitchingToConfirmed
                ? 'Confirm & Save'
                : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Floor Plan Viewer Modal */}
      <FloorplanViewerModal
        isOpen={isFloorplanModalOpen}
        onClose={() => setIsFloorplanModalOpen(false)}
        eventName={booth.event_name || 'Exhibition'}
        pdfUrl={booth.event_floor_plan_url || null}
      />
    </>
  );
}
