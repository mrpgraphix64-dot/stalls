import React, { useEffect, useState } from 'react';
import {
  Palette,
  Plus,
  ExternalLink,
  CheckCircle2,
  Clock,
  Edit2,
  Trash2,
  FolderOpen,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { fetchLinks, createLink, updateLink, approveLink, unapproveLink, deleteLink } from '../api';
import { BoothLink, LinkCategory } from '../types';
import { Modal } from '../Modal';

interface DesignTabProps {
  boothId: string;
}

export function DesignTab({ boothId }: DesignTabProps) {
  const [links, setLinks] = useState<BoothLink[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingLink, setEditingLink] = useState<BoothLink | null>(null);
  const [deletingLink, setDeletingLink] = useState<BoothLink | null>(null);

  // Form State
  const [title, setTitle] = useState<string>('');
  const [driveUrl, setDriveUrl] = useState<string>('');
  const [category, setCategory] = useState<LinkCategory>('render_3d');
  const [version, setVersion] = useState<string>('v1.0');
  const [notes, setNotes] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);

  const loadLinks = async () => {
    try {
      setLoading(true);
      setError('');
      const all = await fetchLinks(boothId);
      // Filter for design-related categories: render_3d, working_artwork, photo
      const designLinks = all.filter((l) => ['render_3d', 'working_artwork', 'photo'].includes(l.category));
      setLinks(designLinks);
    } catch (err: any) {
      setError(err.message || 'Failed to load design links.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLinks();
  }, [boothId]);

  const openCreateModal = () => {
    setEditingLink(null);
    setTitle('');
    setDriveUrl('');
    setCategory('render_3d');
    setVersion('v1.0');
    setNotes('');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (lnk: BoothLink) => {
    setEditingLink(lnk);
    setTitle(lnk.title);
    setDriveUrl(lnk.drive_url);
    setCategory(lnk.category);
    setVersion(lnk.version || 'v1.0');
    setNotes(lnk.notes || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !driveUrl.trim()) {
      setFormError('Please enter a title and Google Drive URL.');
      return;
    }

    setFormSubmitting(true);
    setFormError('');

    try {
      if (editingLink) {
        await updateLink(editingLink.id, {
          title: title.trim(),
          drive_url: driveUrl.trim(),
          category,
          version: version.trim() || 'v1.0',
          notes: notes.trim() || undefined,
        });
      } else {
        await createLink({
          booth_id: boothId,
          title: title.trim(),
          drive_url: driveUrl.trim(),
          category,
          version: version.trim() || 'v1.0',
          notes: notes.trim() || undefined,
        });
      }
      setIsModalOpen(false);
      await loadLinks();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save design link.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleApprove = async (lnk: BoothLink) => {
    try {
      if (lnk.is_final) {
        await unapproveLink(lnk.id);
      } else {
        await approveLink(lnk.id);
      }
      await loadLinks();
    } catch (err: any) {
      alert(err.message || 'Failed to update approval status.');
    }
  };

  const handleDelete = async () => {
    if (!deletingLink) return;
    try {
      setFormSubmitting(true);
      await deleteLink(deletingLink.id);
      setDeletingLink(null);
      await loadLinks();
    } catch (err: any) {
      alert(err.message || 'Failed to delete link.');
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Header & Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/60">
        <div>
          <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider flex items-center gap-2">
            <Palette className="w-4 h-4 text-amber-400" />
            3D Renders & Design Revisions
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Store and track Google Drive links for 3D walkthroughs, cutaways, and client revisions
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 text-xs font-bold rounded-xl transition-all shadow-md shadow-amber-500/10 flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add 3D Design Link
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-zinc-500 gap-2">
          <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          <span className="text-xs">Loading design revisions...</span>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center text-xs text-red-400">
          {error}
        </div>
      ) : links.length === 0 ? (
        <div className="bg-zinc-900/40 border border-dashed border-zinc-800 rounded-2xl p-10 text-center space-y-3">
          <Palette className="w-8 h-8 text-zinc-600 mx-auto" />
          <p className="text-xs font-medium text-zinc-300">No 3D design files uploaded yet</p>
          <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
            Add Google Drive links for initial renders, client revision angles, and working 3D source files.
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-amber-400 text-xs font-semibold rounded-xl transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add First 3D Render
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {links.map((lnk) => (
            <div
              key={lnk.id}
              className={`bg-zinc-900/90 border rounded-2xl p-5 space-y-3.5 transition-all ${
                lnk.is_final ? 'border-emerald-500/40 shadow-sm shadow-emerald-500/5' : 'border-zinc-800/80 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300">
                      {lnk.version}
                    </span>
                    <span
                      className={`text-[10px] font-semibold uppercase px-2 py-0.2 rounded-md border ${
                        lnk.is_final
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                      }`}
                    >
                      {lnk.is_final ? 'Approved Final' : 'Draft Revision'}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-zinc-100">{lnk.title}</h3>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEditModal(lnk)}
                    className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
                    title="Edit Link"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeletingLink(lnk)}
                    className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors"
                    title="Remove Link"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {lnk.notes && (
                <p className="text-xs text-zinc-400 whitespace-pre-line line-clamp-2 bg-zinc-950/40 p-2.5 rounded-xl border border-zinc-800/40">
                  {lnk.notes}
                </p>
              )}

              {/* Status & Open Button */}
              <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-xs">
                <div>
                  {lnk.is_final && lnk.approved_at ? (
                    <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Approved {lnk.approved_at.slice(0, 10)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Draft review
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleApprove(lnk)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
                      lnk.is_final
                        ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
                        : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {lnk.is_final ? 'Revoke Approval' : 'Approve Design'}
                  </button>

                  <a
                    href={lnk.drive_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/20 text-xs font-semibold transition-colors"
                  >
                    <span>Open Drive</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingLink ? 'Edit 3D Design Link' : 'Add 3D Design Google Drive Link'}
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-zinc-300 font-medium mb-1">
              Title / Angle Description <span className="text-amber-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Front Elevation Render - Day View"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as LinkCategory)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
              >
                <option value="render_3d">3D Render Image / Video</option>
                <option value="working_artwork">3D Model Source File (.max, .skp, .blend)</option>
                <option value="photo">Client Reference Photo</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Version / Revision Tag</label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="v1.0, v2.1, Final"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1 flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
              Google Drive File URL <span className="text-amber-500">*</span>
            </label>
            <input
              type="url"
              required
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
              placeholder="https://drive.google.com/file/d/..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 font-mono text-[11px] focus:outline-none focus:border-amber-500/60"
            />
            {editingLink && editingLink.is_final && driveUrl !== editingLink.drive_url && (
              <p className="text-[11px] text-amber-400/90 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Changing the Drive URL will automatically reset this link's approval status to Draft.
              </p>
            )}
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Revision Notes & Changes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Added 50W track lights, adjusted fascia logo height per client feedback..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold rounded-xl transition-all shadow-md shadow-amber-500/10 disabled:opacity-50"
            >
              {formSubmitting ? 'Saving...' : editingLink ? 'Save Changes' : 'Add Link'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deletingLink !== null}
        onClose={() => setDeletingLink(null)}
        title="Remove Design Link"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <p className="text-zinc-300">
            Are you sure you want to remove the link <span className="font-bold text-zinc-100">{deletingLink?.title}</span>?
          </p>
          <p className="text-zinc-500">
            This only removes the link entry from the dashboard. The underlying file in Google Drive will not be touched.
          </p>
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setDeletingLink(null)}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={formSubmitting}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-semibold rounded-xl transition-colors"
            >
              {formSubmitting ? 'Removing...' : 'Remove Link'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
