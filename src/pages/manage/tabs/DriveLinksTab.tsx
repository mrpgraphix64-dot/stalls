import React, { useEffect, useState } from 'react';
import {
  Link2,
  Plus,
  ExternalLink,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Copy,
  Check,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react';
import {
  fetchLinks,
  createLink,
  updateLink,
  approveLink,
  unapproveLink,
  deleteLink,
} from '../api';
import { BoothLink, LinkCategory } from '../types';
import { Modal } from '../Modal';

interface DriveLinksTabProps {
  boothId: string;
  mainDriveFolderUrl?: string;
  onOpenEditBooth?: () => void;
}

export function DriveLinksTab({
  boothId,
  mainDriveFolderUrl,
  onOpenEditBooth,
}: DriveLinksTabProps) {
  const [links, setLinks] = useState<BoothLink[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingLink, setEditingLink] = useState<BoothLink | null>(null);
  const [deletingLink, setDeletingLink] = useState<BoothLink | null>(null);

  // Form State
  const [formCategory, setFormCategory] = useState<LinkCategory>('render_3d');
  const [formTitle, setFormTitle] = useState<string>('');
  const [formDriveUrl, setFormDriveUrl] = useState<string>('');
  const [formVersion, setFormVersion] = useState<string>('v1.0');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchLinks(boothId);
      setLinks(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load Google Drive links.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [boothId]);

  const openCreateModal = () => {
    setEditingLink(null);
    setFormCategory('render_3d');
    setFormTitle('');
    setFormDriveUrl('');
    setFormVersion('v1.0');
    setFormNotes('');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (link: BoothLink) => {
    setEditingLink(link);
    setFormCategory(link.category);
    setFormTitle(link.title);
    setFormDriveUrl(link.drive_url);
    setFormVersion(link.version || 'v1.0');
    setFormNotes(link.notes || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDriveUrl.trim()) {
      setFormError('Please enter a title and a valid Google Drive URL.');
      return;
    }
    setFormSubmitting(true);
    setFormError('');

    try {
      if (editingLink) {
        await updateLink(editingLink.id, {
          title: formTitle.trim(),
          category: formCategory,
          drive_url: formDriveUrl.trim(),
          version: formVersion.trim() || undefined,
          notes: formNotes.trim() || undefined,
        });
      } else {
        await createLink({
          booth_id: boothId,
          category: formCategory,
          title: formTitle.trim(),
          drive_url: formDriveUrl.trim(),
          version: formVersion.trim() || undefined,
          notes: formNotes.trim() || undefined,
        });
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save Google Drive link.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleApproval = async (link: BoothLink) => {
    try {
      if (link.is_final) {
        await unapproveLink(link.id);
      } else {
        await approveLink(link.id);
      }
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update approval status.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingLink) return;
    try {
      setFormSubmitting(true);
      await deleteLink(deletingLink.id);
      setDeletingLink(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete link.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const categories = [
    { id: 'all', label: 'All Files' },
    { id: 'render_3d', label: '3D Renders' },
    { id: 'working_artwork', label: 'Working Artworks' },
    { id: 'print_ready', label: 'Print-Ready Graphics' },
    { id: 'production', label: 'Structural Drawings' },
    { id: 'photo', label: 'Site & Event Photos' },
    { id: 'other', label: 'Other Documents' },
  ];

  // Filtering
  const filteredLinks = links.filter((l) => {
    const matchesCategory = selectedCategory === 'all' || l.category === selectedCategory;
    const matchesSearch =
      searchQuery === '' ||
      l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.notes && l.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (l.version && l.version.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const totalCount = links.length;
  const approvedCount = links.filter((l) => l.is_final === 1).length;
  const draftCount = totalCount - approvedCount;

  return (
    <div className="space-y-6">
      {/* Main Drive Folder Card */}
      <div className="bg-gradient-to-r from-amber-500/10 via-zinc-900 to-zinc-900 border border-amber-500/30 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl shrink-0 text-amber-400">
            <FolderOpen className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              Master Google Drive Folder
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40">
                Primary Repository
              </span>
            </h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-xl">
              All project files, high-res artworks, 3D renders, and vendor assets are stored directly in Google Drive. Zero heavy files are uploaded to this server.
            </p>
            {mainDriveFolderUrl ? (
              <p className="text-xs text-zinc-300 font-mono mt-2 truncate max-w-md">
                {mainDriveFolderUrl}
              </p>
            ) : (
              <p className="text-xs text-zinc-500 italic mt-2">
                No main folder URL configured for this booth yet.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {mainDriveFolderUrl ? (
            <a
              href={mainDriveFolderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs rounded-xl shadow-md shadow-amber-500/10 flex items-center gap-1.5 transition-all"
            >
              <span>Open Master Drive</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          ) : (
            onOpenEditBooth && (
              <button
                onClick={onOpenEditBooth}
                className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-semibold transition-colors"
              >
                + Link Master Drive Folder
              </button>
            )
          )}
        </div>
      </div>

      {/* Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-amber-400" />
            Google Drive Links Library
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Individual versioned assets with explicit client & production approval tracking.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs rounded-xl shadow-md shadow-amber-500/10 flex items-center gap-1.5 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Google Drive Link</span>
        </button>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-3.5">
          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Total Links</span>
          <p className="text-xl font-bold font-mono text-zinc-100 mt-0.5">{totalCount}</p>
        </div>
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-3.5">
          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Approved Final</span>
          <p className="text-xl font-bold font-mono text-emerald-400 mt-0.5">{approvedCount}</p>
        </div>
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-3.5">
          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Draft / Revisions</span>
          <p className="text-xl font-bold font-mono text-amber-400 mt-0.5">{draftCount}</p>
        </div>
      </div>

      {/* Search and Category Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search files by title, notes, or version..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500/60"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {categories.map((c) => {
            const isSelected = selectedCategory === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error / Loading / Content */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-xs text-zinc-500">
          Loading Google Drive links...
        </div>
      ) : filteredLinks.length === 0 ? (
        <div className="bg-zinc-900/30 border border-dashed border-zinc-800 rounded-2xl p-12 text-center space-y-3">
          <Link2 className="w-10 h-10 text-zinc-600 mx-auto" />
          <h3 className="text-sm font-semibold text-zinc-300">No Drive Links Found</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            {searchQuery || selectedCategory !== 'all'
              ? 'No links match the selected filter or search term.'
              : 'Add your first categorized Google Drive link to track design renders, print artworks, and drawings.'}
          </p>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add First Link
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredLinks.map((link) => {
            const isApproved = link.is_final === 1;
            const isCopied = copiedId === link.id;

            return (
              <div
                key={link.id}
                className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 space-y-3 hover:border-zinc-700 transition-all shadow-sm"
              >
                {/* Card Top: Category & Status */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                      {link.category.replace('_', ' ')}
                    </span>
                    {link.version && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800/60 text-amber-400">
                        {link.version}
                      </span>
                    )}
                  </div>

                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                      isApproved
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700/60'
                    }`}
                  >
                    {isApproved ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Approved</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3 h-3 text-zinc-400" />
                        <span>Draft</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Title & Notes */}
                <div>
                  <h4 className="text-sm font-bold text-zinc-100">{link.title}</h4>
                  {link.notes && (
                    <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{link.notes}</p>
                  )}
                  {isApproved && link.approved_at && (
                    <p className="text-[10px] text-emerald-400/80 mt-1">
                      Approved on: {new Date(link.approved_at).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {/* Drive URL Preview */}
                <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono text-zinc-400 truncate">
                    {link.drive_url}
                  </span>
                  <button
                    onClick={() => copyToClipboard(link.id, link.drive_url)}
                    className="p-1 rounded text-zinc-400 hover:text-amber-400 transition-colors shrink-0"
                    title="Copy URL"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800/60">
                  <a
                    href={link.drive_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <span>Open in Drive</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleApproval(link)}
                      className={`px-2.5 py-1.5 text-xs font-semibold rounded-xl border transition-colors ${
                        isApproved
                          ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
                          : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      }`}
                      title={isApproved ? 'Click to reset to Draft' : 'Click to mark Approved'}
                    >
                      {isApproved ? 'Unapprove' : 'Approve'}
                    </button>

                    <button
                      onClick={() => openEditModal(link)}
                      className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                      title="Edit Link"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setDeletingLink(link)}
                      className="p-2 rounded-xl hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors"
                      title="Delete Link"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingLink ? 'Edit Google Drive Link' : 'Add Google Drive Link'}
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
              Category <span className="text-amber-500">*</span>
            </label>
            <select
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value as LinkCategory)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
            >
              <option value="render_3d">3D Design Renders</option>
              <option value="working_artwork">Working Artworks (AI/PSD)</option>
              <option value="print_ready">Print-Ready Files (PDF/TIFF)</option>
              <option value="production">Structural Drawings (CAD/PDF)</option>
              <option value="photo">Site / Event Photos</option>
              <option value="other">Other Document</option>
            </select>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">
              Link Title <span className="text-amber-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 3D Isometric View R2 or Fascia Logo Print File"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">
              Google Drive Shareable URL <span className="text-amber-500">*</span>
            </label>
            <input
              type="url"
              required
              placeholder="https://drive.google.com/..."
              value={formDriveUrl}
              onChange={(e) => setFormDriveUrl(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60 font-mono"
            />
            {editingLink && (
              <p className="text-[10px] text-amber-400 mt-1">
                Note: Updating the Drive URL automatically resets approval to Draft for safety.
              </p>
            )}
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Version Label</label>
            <input
              type="text"
              placeholder="e.g. v1.0, R2, Final-Print"
              value={formVersion}
              onChange={(e) => setFormVersion(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Notes / Instructions</label>
            <textarea
              rows={2}
              placeholder="e.g. Approved by client via email on 12th Nov"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-zinc-100 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              {formSubmitting ? 'Saving...' : editingLink ? 'Save Changes' : 'Add Link'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deletingLink)}
        onClose={() => setDeletingLink(null)}
        title="Confirm Deletion"
      >
        <div className="space-y-4 text-xs">
          <p className="text-zinc-300">
            Are you sure you want to delete <span className="font-semibold text-zinc-100">{deletingLink?.title}</span>?
          </p>
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={() => setDeletingLink(null)}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={formSubmitting}
              onClick={handleDeleteConfirm}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              {formSubmitting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
