import React, { useEffect, useState } from 'react';
import {
  Printer,
  Plus,
  ExternalLink,
  CheckCircle2,
  Clock,
  Edit2,
  Trash2,
  FolderOpen,
  AlertTriangle,
  FileCheck,
  PackageCheck,
  Check,
} from 'lucide-react';
import {
  fetchLinks,
  createLink,
  updateLink,
  approveLink,
  unapproveLink,
  deleteLink,
  fetchItems,
  createItem,
  updateItem,
  toggleItemStatus,
  deleteItem,
} from '../api';
import { BoothLink, BoothItemRecord } from '../types';
import { Modal } from '../Modal';

interface PrintTabProps {
  boothId: string;
}

export function PrintTab({ boothId }: PrintTabProps) {
  const [links, setLinks] = useState<BoothLink[]>([]);
  const [items, setItems] = useState<BoothItemRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Modals
  const [isLinkModalOpen, setIsLinkModalOpen] = useState<boolean>(false);
  const [editingLink, setEditingLink] = useState<BoothLink | null>(null);
  const [deletingLink, setDeletingLink] = useState<BoothLink | null>(null);

  const [isItemModalOpen, setIsItemModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<BoothItemRecord | null>(null);
  const [deletingItem, setDeletingItem] = useState<BoothItemRecord | null>(null);

  // Link Form State
  const [linkTitle, setLinkTitle] = useState<string>('');
  const [linkDriveUrl, setLinkDriveUrl] = useState<string>('');
  const [linkVersion, setLinkVersion] = useState<string>('v1.0');
  const [linkNotes, setLinkNotes] = useState<string>('');

  // Item Form State
  const [itemName, setItemName] = useState<string>('');
  const [itemDimensions, setItemDimensions] = useState<string>('');
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemUnit, setItemUnit] = useState<string>('sqm');
  const [itemVendor, setItemVendor] = useState<string>('');
  const [itemNotes, setItemNotes] = useState<string>('');

  const [formError, setFormError] = useState<string>('');
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [allLinks, allItems] = await Promise.all([
        fetchLinks(boothId, 'print_ready'),
        fetchItems(boothId, 'print'),
      ]);
      setLinks(allLinks);
      setItems(allItems);
    } catch (err: any) {
      setError(err.message || 'Failed to load print production data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [boothId]);

  // Link Handlers
  const openCreateLink = () => {
    setEditingLink(null);
    setLinkTitle('');
    setLinkDriveUrl('');
    setLinkVersion('v1.0');
    setLinkNotes('');
    setFormError('');
    setIsLinkModalOpen(true);
  };

  const openEditLink = (lnk: BoothLink) => {
    setEditingLink(lnk);
    setLinkTitle(lnk.title);
    setLinkDriveUrl(lnk.drive_url);
    setLinkVersion(lnk.version || 'v1.0');
    setLinkNotes(lnk.notes || '');
    setFormError('');
    setIsLinkModalOpen(true);
  };

  const handleSaveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkTitle.trim() || !linkDriveUrl.trim()) {
      setFormError('Please enter an artwork title and Google Drive URL.');
      return;
    }
    setFormSubmitting(true);
    setFormError('');

    try {
      if (editingLink) {
        await updateLink(editingLink.id, {
          title: linkTitle.trim(),
          drive_url: linkDriveUrl.trim(),
          category: 'print_ready',
          version: linkVersion.trim() || 'v1.0',
          notes: linkNotes.trim() || undefined,
        });
      } else {
        await createLink({
          booth_id: boothId,
          title: linkTitle.trim(),
          drive_url: linkDriveUrl.trim(),
          category: 'print_ready',
          version: linkVersion.trim() || 'v1.0',
          notes: linkNotes.trim() || undefined,
        });
      }
      setIsLinkModalOpen(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save artwork link.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleApproveLink = async (lnk: BoothLink) => {
    try {
      if (lnk.is_final) {
        await unapproveLink(lnk.id);
      } else {
        await approveLink(lnk.id);
      }
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update approval status.');
    }
  };

  const handleDeleteLink = async () => {
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

  // Item Handlers
  const openCreateItem = () => {
    setEditingItem(null);
    setItemName('');
    setItemDimensions('');
    setItemQuantity(1);
    setItemUnit('sqm');
    setItemVendor('');
    setItemNotes('');
    setFormError('');
    setIsItemModalOpen(true);
  };

  const openEditItem = (itm: BoothItemRecord) => {
    setEditingItem(itm);
    setItemName(itm.item_name);
    setItemDimensions(itm.specification || '');
    setItemQuantity(itm.quantity);
    setItemUnit(itm.unit || 'sqm');
    setItemVendor(itm.vendor_name || '');
    setItemNotes(itm.notes || '');
    setFormError('');
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) {
      setFormError('Please enter a print graphic name.');
      return;
    }
    setFormSubmitting(true);
    setFormError('');

    try {
      if (editingItem) {
        await updateItem(editingItem.id, {
          item_name: itemName.trim(),
          category: 'print',
          quantity: itemQuantity,
          unit: itemUnit,
          specification: itemDimensions.trim() || undefined,
          vendor_name: itemVendor.trim() || undefined,
          notes: itemNotes.trim() || undefined,
        });
      } else {
        await createItem({
          booth_id: boothId,
          category: 'print',
          item_name: itemName.trim(),
          quantity: itemQuantity,
          unit: itemUnit,
          specification: itemDimensions.trim() || undefined,
          vendor_name: itemVendor.trim() || undefined,
          notes: itemNotes.trim() || undefined,
        });
      }
      setIsItemModalOpen(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save print item.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleItemStatus = async (itm: BoothItemRecord, field: 'is_delivered' | 'is_installed') => {
    try {
      await toggleItemStatus(itm.id, field);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update readiness status.');
    }
  };

  const handleDeleteItem = async () => {
    if (!deletingItem) return;
    try {
      setFormSubmitting(true);
      await deleteItem(deletingItem.id);
      setDeletingItem(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete item.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const approvedLinks = links.filter((l) => l.is_final);
  const draftLinks = links.filter((l) => !l.is_final);

  return (
    <div className="space-y-8">
      {/* 1. ARTWORK LINKS SECTION (Draft vs Approved for Print) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/60">
          <div>
            <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider flex items-center gap-2">
              <Printer className="w-4 h-4 text-amber-400" />
              Print-Ready Artwork & Proofs
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Google Drive links to final high-res print files (TIFF, PDF, AI, CDR)
            </p>
          </div>

          <button
            onClick={openCreateLink}
            className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 text-xs font-bold rounded-xl transition-all shadow-md shadow-amber-500/10 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Print Artwork Link
          </button>
        </div>

        {/* Approved for Print Section */}
        {approvedLinks.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileCheck className="w-4 h-4" />
              Approved for Print ({approvedLinks.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {approvedLinks.map((lnk) => (
                <div
                  key={lnk.id}
                  className="bg-emerald-500/5 border border-emerald-500/30 rounded-xl p-4 flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300">
                          {lnk.version}
                        </span>
                        <span className="text-[10px] font-semibold uppercase px-2 py-0.2 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Approved Final
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-zinc-100 mt-1">{lnk.title}</h4>
                      {lnk.notes && <p className="text-[11px] text-zinc-400 mt-0.5">{lnk.notes}</p>}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEditLink(lnk)}
                        className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors"
                        title="Edit Link"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingLink(lnk)}
                        className="p-1 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors"
                        title="Remove Link"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-emerald-500/20 text-[11px]">
                    <span className="text-emerald-400 font-mono text-[10px]">
                      Approved: {lnk.approved_at ? lnk.approved_at.slice(0, 10) : 'Yes'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleApproveLink(lnk)}
                        className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[10px] rounded"
                      >
                        Revoke Approval
                      </button>
                      <a
                        href={lnk.drive_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded text-[11px] font-semibold"
                      >
                        <span>Open Drive</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Draft Artwork Proofs Section */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-zinc-500" />
            Working Draft Artwork ({draftLinks.length})
          </h3>
          {draftLinks.length === 0 ? (
            <div className="bg-zinc-950/40 border border-zinc-800/80 rounded-xl p-4 text-xs text-zinc-500 text-center">
              No draft print links. Click "+ Add Print Artwork Link" above to attach a Google Drive print file.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {draftLinks.map((lnk) => (
                <div
                  key={lnk.id}
                  className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300">
                          {lnk.version}
                        </span>
                        <span className="text-[10px] font-semibold uppercase px-2 py-0.2 rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700">
                          Draft Proof
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-zinc-100 mt-1">{lnk.title}</h4>
                      {lnk.notes && <p className="text-[11px] text-zinc-400 mt-0.5">{lnk.notes}</p>}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEditLink(lnk)}
                        className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingLink(lnk)}
                        className="p-1 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-[11px]">
                    <span className="text-zinc-500 text-[10px]">Awaiting Signoff</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleApproveLink(lnk)}
                        className="px-2 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold rounded"
                      >
                        Approve for Print
                      </button>
                      <a
                        href={lnk.drive_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded text-[11px] font-semibold"
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
        </div>
      </div>

      {/* 2. PRINT GRAPHIC PANELS & MATERIAL SCHEDULE */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/60">
          <div>
            <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-amber-400" />
              Graphic Panels & Material Schedule
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Specific dimensions, materials (Vinyl, Flex, Fabric, Foam), printer vendor, and installation status
            </p>
          </div>

          <button
            onClick={openCreateItem}
            className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-zinc-700 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Print Item
          </button>
        </div>

        {items.length === 0 ? (
          <div className="bg-zinc-900/40 border border-dashed border-zinc-800 rounded-2xl p-8 text-center space-y-2">
            <p className="text-xs font-medium text-zinc-300">No print panels scheduled</p>
            <p className="text-[11px] text-zinc-500">
              List banner sizes, backdrops, and fascia prints to track printing and on-site mounting.
            </p>
          </div>
        ) : (
          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 font-medium bg-zinc-950/40">
                    <th className="py-3 px-4">Graphic Panel / Item</th>
                    <th className="py-3 px-4">Dimensions & Material</th>
                    <th className="py-3 px-4">Qty</th>
                    <th className="py-3 px-4">Printer Vendor</th>
                    <th className="py-3 px-4 text-center">Printed / Delivered</th>
                    <th className="py-3 px-4 text-center">Mounted / Installed</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                  {items.map((itm) => (
                    <tr key={itm.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 px-4 font-semibold text-zinc-100">{itm.item_name}</td>
                      <td className="py-3 px-4 text-zinc-400">{itm.specification || '—'}</td>
                      <td className="py-3 px-4 font-mono">
                        {itm.quantity} {itm.unit}
                      </td>
                      <td className="py-3 px-4 text-zinc-400">{itm.vendor_name || '—'}</td>

                      {/* Delivered Toggle */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleItemStatus(itm, 'is_delivered')}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                            itm.is_delivered
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          {itm.is_delivered ? <Check className="w-3 h-3" /> : null}
                          {itm.is_delivered ? 'Delivered' : 'Pending'}
                        </button>
                      </td>

                      {/* Installed Toggle */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleItemStatus(itm, 'is_installed')}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                            itm.is_installed
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                              : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          {itm.is_installed ? <Check className="w-3 h-3" /> : null}
                          {itm.is_installed ? 'Installed' : 'Pending'}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditItem(itm)}
                            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingItem(itm)}
                            className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Artwork Link Modal */}
      <Modal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        title={editingLink ? 'Edit Print Artwork Link' : 'Add Print-Ready Artwork Google Drive Link'}
      >
        <form onSubmit={handleSaveLink} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-zinc-300 font-medium mb-1">
              Artwork Title <span className="text-amber-500">*</span>
            </label>
            <input
              type="text"
              required
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              placeholder="e.g. Backlit Wall Graphic - 6m x 3m (Final Print PDF)"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Version Tag</label>
              <input
                type="text"
                value={linkVersion}
                onChange={(e) => setLinkVersion(e.target.value)}
                placeholder="v1.0, Final-Print"
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
              value={linkDriveUrl}
              onChange={(e) => setLinkDriveUrl(e.target.value)}
              placeholder="https://drive.google.com/file/d/..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 font-mono text-[11px] focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Printer Notes & Specs</label>
            <textarea
              rows={2}
              value={linkNotes}
              onChange={(e) => setLinkNotes(e.target.value)}
              placeholder="CMYK 300 DPI, 2 inch bleeding on all sides..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setIsLinkModalOpen(false)}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold rounded-xl transition-all shadow-md shadow-amber-500/10 disabled:opacity-50"
            >
              {formSubmitting ? 'Saving...' : editingLink ? 'Save Changes' : 'Add Artwork Link'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add / Edit Print Item Modal */}
      <Modal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        title={editingItem ? 'Edit Print Panel' : 'Schedule Print Graphic Panel'}
      >
        <form onSubmit={handleSaveItem} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-zinc-300 font-medium mb-1">
              Panel / Graphic Name <span className="text-amber-500">*</span>
            </label>
            <input
              type="text"
              required
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. Reception Counter Front Branding"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                required
                value={itemQuantity}
                onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Unit</label>
              <select
                value={itemUnit}
                onChange={(e) => setItemUnit(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
              >
                <option value="sqm">sqm</option>
                <option value="sqft">sqft</option>
                <option value="pcs">pcs</option>
                <option value="nos">nos</option>
                <option value="sets">sets</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Printer Vendor</label>
              <input
                type="text"
                value={itemVendor}
                onChange={(e) => setItemVendor(e.target.value)}
                placeholder="Print Vendor"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Dimensions & Material Specification</label>
            <input
              type="text"
              value={itemDimensions}
              onChange={(e) => setItemDimensions(e.target.value)}
              placeholder="e.g. 2.4m x 1.0m, Backlit Star flex with matte lamination"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Notes</label>
            <textarea
              rows={2}
              value={itemNotes}
              onChange={(e) => setItemNotes(e.target.value)}
              placeholder="Mounting instructions, double tape vs silicone edge..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setIsItemModalOpen(false)}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold rounded-xl transition-all shadow-md shadow-amber-500/10 disabled:opacity-50"
            >
              {formSubmitting ? 'Saving...' : editingItem ? 'Save Changes' : 'Schedule Print'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deletingLink !== null || deletingItem !== null}
        onClose={() => {
          setDeletingLink(null);
          setDeletingItem(null);
        }}
        title="Confirm Removal"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <p className="text-zinc-300">
            Are you sure you want to remove{' '}
            <span className="font-bold text-zinc-100">
              {deletingLink?.title || deletingItem?.item_name}
            </span>
            ?
          </p>
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => {
                setDeletingLink(null);
                setDeletingItem(null);
              }}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={deletingLink ? handleDeleteLink : handleDeleteItem}
              disabled={formSubmitting}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-semibold rounded-xl transition-colors"
            >
              {formSubmitting ? 'Removing...' : 'Confirm Remove'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
