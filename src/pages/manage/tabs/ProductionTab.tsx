import React, { useEffect, useState } from 'react';
import {
  Hammer,
  Plus,
  ExternalLink,
  CheckCircle2,
  Clock,
  Edit2,
  Trash2,
  FolderOpen,
  AlertTriangle,
  Wrench,
  Check,
} from 'lucide-react';
import {
  fetchLinks,
  createLink,
  deleteLink,
  fetchItems,
  createItem,
  updateItem,
  toggleItemStatus,
  deleteItem,
} from '../api';
import { BoothLink, BoothItemRecord } from '../types';
import { Modal } from '../Modal';

interface ProductionTabProps {
  boothId: string;
}

export function ProductionTab({ boothId }: ProductionTabProps) {
  const [items, setItems] = useState<BoothItemRecord[]>([]);
  const [links, setLinks] = useState<BoothLink[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Modals
  const [isItemModalOpen, setIsItemModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<BoothItemRecord | null>(null);
  const [deletingItem, setDeletingItem] = useState<BoothItemRecord | null>(null);

  const [isLinkModalOpen, setIsLinkModalOpen] = useState<boolean>(false);
  const [deletingLink, setDeletingLink] = useState<BoothLink | null>(null);

  // Item Form State
  const [itemName, setItemName] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [unit, setUnit] = useState<string>('sets');
  const [specification, setSpecification] = useState<string>('');
  const [vendorName, setVendorName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Link Form State
  const [linkTitle, setLinkTitle] = useState<string>('');
  const [linkDriveUrl, setLinkDriveUrl] = useState<string>('');
  const [linkVersion, setLinkVersion] = useState<string>('v1.0');
  const [linkNotes, setLinkNotes] = useState<string>('');

  const [formError, setFormError] = useState<string>('');
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [allLinks, allItems] = await Promise.all([
        fetchLinks(boothId),
        fetchItems(boothId, 'production'),
      ]);
      const drawingLinks = allLinks.filter((l) => ['production', 'working_artwork'].includes(l.category));
      setLinks(drawingLinks);
      setItems(allItems);
    } catch (err: any) {
      setError(err.message || 'Failed to load fabrication details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [boothId]);

  const openCreateItem = () => {
    setEditingItem(null);
    setItemName('');
    setQuantity(1);
    setUnit('sets');
    setSpecification('');
    setVendorName('');
    setNotes('');
    setFormError('');
    setIsItemModalOpen(true);
  };

  const openEditItem = (itm: BoothItemRecord) => {
    setEditingItem(itm);
    setItemName(itm.item_name);
    setQuantity(itm.quantity);
    setUnit(itm.unit || 'sets');
    setSpecification(itm.specification || '');
    setVendorName(itm.vendor_name || '');
    setNotes(itm.notes || '');
    setFormError('');
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) {
      setFormError('Please enter a structural element name.');
      return;
    }
    setFormSubmitting(true);
    setFormError('');

    try {
      if (editingItem) {
        await updateItem(editingItem.id, {
          item_name: itemName.trim(),
          category: 'production',
          quantity,
          unit,
          specification: specification.trim() || undefined,
          vendor_name: vendorName.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      } else {
        await createItem({
          booth_id: boothId,
          category: 'production',
          item_name: itemName.trim(),
          quantity,
          unit,
          specification: specification.trim() || undefined,
          vendor_name: vendorName.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      }
      setIsItemModalOpen(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save production element.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleItem = async (itm: BoothItemRecord, field: 'is_delivered' | 'is_installed') => {
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
      alert(err.message || 'Failed to delete element.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleSaveDrawingLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkTitle.trim() || !linkDriveUrl.trim()) {
      setFormError('Please enter a drawing title and Google Drive URL.');
      return;
    }
    setFormSubmitting(true);
    setFormError('');

    try {
      await createLink({
        booth_id: boothId,
        category: 'production',
        title: linkTitle.trim(),
        drive_url: linkDriveUrl.trim(),
        version: linkVersion.trim() || 'v1.0',
        notes: linkNotes.trim() || undefined,
      });
      setIsLinkModalOpen(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save drawing link.');
    } finally {
      setFormSubmitting(false);
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
      alert(err.message || 'Failed to remove link.');
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Structural Drawings & Cut Lists */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/60">
          <div>
            <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-amber-400" />
              Structural Drawings & Cut Lists
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Google Drive links to AutoCAD plans, elevation diagrams, and joinery details
            </p>
          </div>

          <button
            onClick={() => {
              setLinkTitle('');
              setLinkDriveUrl('');
              setLinkVersion('v1.0');
              setLinkNotes('');
              setFormError('');
              setIsLinkModalOpen(true);
            }}
            className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-zinc-700 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Drawing Link
          </button>
        </div>

        {links.length === 0 ? (
          <div className="bg-zinc-950/40 border border-zinc-800/80 rounded-xl p-4 text-xs text-zinc-500 text-center">
            No production drawings uploaded yet. Click "+ Add Drawing Link" to link an AutoCAD DWG or PDF plan.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {links.map((lnk) => (
              <div
                key={lnk.id}
                className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-4 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300">
                      {lnk.version}
                    </span>
                    <h4 className="text-xs font-bold text-zinc-100">{lnk.title}</h4>
                  </div>
                  {lnk.notes && <p className="text-[11px] text-zinc-400 mt-1">{lnk.notes}</p>}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={lnk.drive_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg text-[11px] font-semibold"
                  >
                    <span>View Plan</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    onClick={() => setDeletingLink(lnk)}
                    className="p-1 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Fabrication Elements Schedule */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/60">
          <div>
            <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider flex items-center gap-2">
              <Hammer className="w-4 h-4 text-amber-400" />
              Fabrication & Structure Schedule
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Track wooden structures, metallic frames, acrylic elements, and on-site assembly
            </p>
          </div>

          <button
            onClick={openCreateItem}
            className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 text-xs font-bold rounded-xl transition-all shadow-md shadow-amber-500/10 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Structure Element
          </button>
        </div>

        {items.length === 0 ? (
          <div className="bg-zinc-900/40 border border-dashed border-zinc-800 rounded-2xl p-8 text-center space-y-2">
            <p className="text-xs font-medium text-zinc-300">No structure elements registered</p>
            <p className="text-[11px] text-zinc-500">
              Break down the stall structure into fabrication components (Pylon, Canopy, Display Podium, Backwall).
            </p>
          </div>
        ) : (
          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 font-medium bg-zinc-950/40">
                    <th className="py-3 px-4">Fabrication Element</th>
                    <th className="py-3 px-4">Specifications & Finish</th>
                    <th className="py-3 px-4">Qty</th>
                    <th className="py-3 px-4">Workshop / Vendor</th>
                    <th className="py-3 px-4 text-center">Fabricated / Dispatched</th>
                    <th className="py-3 px-4 text-center">Erected / Installed</th>
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
                      <td className="py-3 px-4 text-zinc-400">{itm.vendor_name || 'In-House'}</td>

                      {/* Dispatched Toggle */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleItem(itm, 'is_delivered')}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                            itm.is_delivered
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          {itm.is_delivered ? <Check className="w-3 h-3" /> : null}
                          {itm.is_delivered ? 'Ready / On-Site' : 'In Workshop'}
                        </button>
                      </td>

                      {/* Installed Toggle */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleItem(itm, 'is_installed')}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                            itm.is_installed
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                              : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          {itm.is_installed ? <Check className="w-3 h-3" /> : null}
                          {itm.is_installed ? 'Erected' : 'Pending'}
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

      {/* Add / Edit Element Modal */}
      <Modal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        title={editingItem ? 'Edit Structure Element' : 'Add Structural Fabrication Element'}
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
              Element Name <span className="text-amber-500">*</span>
            </label>
            <input
              type="text"
              required
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. 4m Tower Pylon with Acrylic Backlit Logo"
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
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Unit</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
              >
                <option value="sets">sets</option>
                <option value="pcs">pcs</option>
                <option value="nos">nos</option>
                <option value="sqm">sqm</option>
                <option value="mtr">mtr</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Fabricator / Vendor</label>
              <input
                type="text"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="In-House or Vendor"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Material & Joinery Specifications</label>
            <input
              type="text"
              value={specification}
              onChange={(e) => setSpecification(e.target.value)}
              placeholder="e.g. 18mm commercial plywood with duco high-gloss paint"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Assembly Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Requires scissor lift on-site, cable channel inside column..."
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
              {formSubmitting ? 'Saving...' : editingItem ? 'Save Changes' : 'Add Element'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Drawing Link Modal */}
      <Modal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        title="Add Structural Plan Google Drive Link"
      >
        <form onSubmit={handleSaveDrawingLink} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-zinc-300 font-medium mb-1">
              Plan Title <span className="text-amber-500">*</span>
            </label>
            <input
              type="text"
              required
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              placeholder="e.g. Joinery Cut List & Elevation Details"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Version</label>
              <input
                type="text"
                value={linkVersion}
                onChange={(e) => setLinkVersion(e.target.value)}
                placeholder="v1.0, Final-Fabrication"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1 flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
              Google Drive Plan URL <span className="text-amber-500">*</span>
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
            <label className="block text-zinc-300 font-medium mb-1">Notes</label>
            <textarea
              rows={2}
              value={linkNotes}
              onChange={(e) => setLinkNotes(e.target.value)}
              placeholder="Includes 3D exploded view, hardware bolts list..."
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
              {formSubmitting ? 'Saving...' : 'Add Drawing Link'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deletingItem !== null || deletingLink !== null}
        onClose={() => {
          setDeletingItem(null);
          setDeletingLink(null);
        }}
        title="Confirm Removal"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <p className="text-zinc-300">
            Are you sure you want to remove{' '}
            <span className="font-bold text-zinc-100">
              {deletingItem?.item_name || deletingLink?.title}
            </span>
            ?
          </p>
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => {
                setDeletingItem(null);
                setDeletingLink(null);
              }}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={deletingItem ? handleDeleteItem : handleDeleteLink}
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
