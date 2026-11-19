import React, { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, Archive, Loader2, X } from 'lucide-react';
import { Modal } from './Modal';

export interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'stall' | 'event';
  title?: string;
  itemName: string;
  itemSubtext?: string;
  extraWarning?: string;
  stallsCount?: number;
  onConfirmDelete: () => Promise<void>;
  onArchiveInstead?: () => Promise<void>;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  type,
  title,
  itemName,
  itemSubtext,
  extraWarning,
  stallsCount = 0,
  onConfirmDelete,
  onArchiveInstead,
}: DeleteConfirmModalProps) {
  const [confirmInput, setConfirmInput] = useState<string>('');
  const [deleting, setDeleting] = useState<boolean>(false);
  const [archiving, setArchiving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setConfirmInput('');
      setDeleting(false);
      setArchiving(false);
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const requiresStrictConfirm = type === 'event';
  const isConfirmValid = !requiresStrictConfirm || confirmInput.trim().toUpperCase() === 'DELETE';

  const handleDelete = async () => {
    if (!isConfirmValid) return;
    setError('');
    setDeleting(true);
    try {
      await onConfirmDelete();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete record.');
    } finally {
      setDeleting(false);
    }
  };

  const handleArchive = async () => {
    if (!onArchiveInstead) return;
    setError('');
    setArchiving(true);
    try {
      await onArchiveInstead();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to archive record.');
    } finally {
      setArchiving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title || (type === 'stall' ? 'Delete Stall Permanently' : 'Delete Exhibition Event')}
      subtitle={type === 'stall' ? 'Permanently remove this stall from operations.' : 'Permanently remove this exhibition and its stalls.'}
      maxWidth="max-w-[500px]"
    >
      <div className="space-y-4 text-xs">
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Item Summary Card */}
        <div className="p-3.5 rounded-xl bg-[#1c1f2a] border border-white/[0.08] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              {type === 'stall' ? 'Target Stall' : 'Target Exhibition'}
            </span>
            {type === 'event' && stallsCount > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-mono font-semibold">
                {stallsCount} associated stall{stallsCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="text-sm font-bold text-zinc-100">{itemName}</div>
          {itemSubtext && <div className="text-[11px] text-zinc-400">{itemSubtext}</div>}
        </div>

        {/* Danger Warning Box */}
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 space-y-1.5 text-red-300">
          <div className="flex items-center gap-2 font-semibold text-red-200">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>Warning: Permanent Deletion</span>
          </div>
          <p className="text-[11px] leading-relaxed text-red-300/90">
            {type === 'stall'
              ? 'This will permanently delete this stall along with all its associated checklist tasks, inventory items, Drive links, and expenses from the database. This action cannot be undone.'
              : `Deleting this event will permanently delete the event AND ALL ${stallsCount > 0 ? stallsCount : ''} associated stalls, checklist tasks, items, and links in one transaction. This cannot be recovered.`}
          </p>
          {extraWarning && (
            <p className="text-[11px] font-medium text-amber-300">{extraWarning}</p>
          )}
        </div>

        {/* Strong Confirmation Input for Events */}
        {requiresStrictConfirm && (
          <div className="space-y-1.5">
            <label className="block text-zinc-300 font-medium">
              To confirm deletion, type <span className="font-mono font-bold text-red-400">DELETE</span> below:
            </label>
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder="Type DELETE to enable"
              className="w-full bg-[#1c1f2a] border border-white/[0.08] focus:border-red-500/80 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none font-mono transition-all"
              autoFocus
            />
          </div>
        )}

        {/* Modal Action Buttons Footer */}
        <div className="pt-2 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 border-t border-white/[0.07]">
          {onArchiveInstead ? (
            <button
              type="button"
              disabled={deleting || archiving}
              onClick={handleArchive}
              className="px-3.5 py-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 hover:text-white font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {archiving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Archive className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>Archive Instead</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              disabled={deleting || archiving}
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-transparent hover:bg-white/[0.05] text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleting || archiving || !isConfirmValid}
              onClick={handleDelete}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-red-950/40 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {deleting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              <span>{type === 'stall' ? 'Delete Stall' : 'Delete Exhibition'}</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
