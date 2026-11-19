import React, { useEffect, useState } from 'react';
import {
  Armchair,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  Check,
  Package,
} from 'lucide-react';
import {
  fetchItems,
  createItem,
  updateItem,
  toggleItemStatus,
  deleteItem,
} from '../api';
import { BoothItemRecord } from '../types';
import { Modal } from '../Modal';

interface FurnitureTabProps {
  boothId: string;
}

export function FurnitureTab({ boothId }: FurnitureTabProps) {
  const [items, setItems] = useState<BoothItemRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<BoothItemRecord | null>(null);
  const [deletingItem, setDeletingItem] = useState<BoothItemRecord | null>(null);

  // Form State
  const [itemName, setItemName] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [unit, setUnit] = useState<string>('nos');
  const [specification, setSpecification] = useState<string>('');
  const [vendorName, setVendorName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchItems(boothId, 'furniture');
      setItems(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load furniture inventory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [boothId]);

  const openCreateModal = () => {
    setEditingItem(null);
    setItemName('');
    setQuantity(1);
    setUnit('nos');
    setSpecification('');
    setVendorName('');
    setNotes('');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (itm: BoothItemRecord) => {
    setEditingItem(itm);
    setItemName(itm.item_name);
    setQuantity(itm.quantity);
    setUnit(itm.unit || 'nos');
    setSpecification(itm.specification || '');
    setVendorName(itm.vendor_name || '');
    setNotes(itm.notes || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) {
      setFormError('Please enter a furniture item name.');
      return;
    }
    setFormSubmitting(true);
    setFormError('');

    try {
      if (editingItem) {
        await updateItem(editingItem.id, {
          item_name: itemName.trim(),
          category: 'furniture',
          quantity,
          unit,
          specification: specification.trim() || undefined,
          vendor_name: vendorName.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      } else {
        await createItem({
          booth_id: boothId,
          category: 'furniture',
          item_name: itemName.trim(),
          quantity,
          unit,
          specification: specification.trim() || undefined,
          vendor_name: vendorName.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save furniture item.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggle = async (itm: BoothItemRecord, field: 'is_delivered' | 'is_installed') => {
    try {
      await toggleItemStatus(itm.id, field);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update status.');
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    try {
      setFormSubmitting(true);
      await deleteItem(deletingItem.id);
      setDeletingItem(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to remove furniture item.');
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
            <Armchair className="w-4 h-4 text-amber-400" />
            Furniture Requirements & Rentals
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Manage tables, chairs, barstools, sofas, reception counters, and brochure racks
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 text-xs font-bold rounded-xl transition-all shadow-md shadow-amber-500/10 flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Furniture Item
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-zinc-500 gap-2">
          <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          <span className="text-xs">Loading furniture inventory...</span>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center text-xs text-red-400">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-zinc-900/40 border border-dashed border-zinc-800 rounded-2xl p-10 text-center space-y-3">
          <Armchair className="w-8 h-8 text-zinc-600 mx-auto" />
          <p className="text-xs font-medium text-zinc-300">No furniture items listed</p>
          <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
            Add reception counters, meeting tables, bar stools, lounge sofas, and brochure display racks.
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-amber-400 text-xs font-semibold rounded-xl transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add First Item
          </button>
        </div>
      ) : (
        <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 font-medium bg-zinc-950/40">
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4">Model & Color Specs</th>
                  <th className="py-3 px-4">Qty</th>
                  <th className="py-3 px-4">Rental Vendor</th>
                  <th className="py-3 px-4 text-center">Delivered On-Site</th>
                  <th className="py-3 px-4 text-center">Placed & Inspected</th>
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
                        onClick={() => handleToggle(itm, 'is_delivered')}
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

                    {/* Placed Toggle */}
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleToggle(itm, 'is_installed')}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                          itm.is_installed
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                            : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {itm.is_installed ? <Check className="w-3 h-3" /> : null}
                        {itm.is_installed ? 'Placed' : 'Pending'}
                      </button>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(itm)}
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

      {/* Add / Edit Furniture Item Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Edit Furniture Item' : 'Add Furniture Item'}
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
              Furniture Name <span className="text-amber-500">*</span>
            </label>
            <input
              type="text"
              required
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. Round Glass Meeting Table"
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
                <option value="nos">nos</option>
                <option value="pcs">pcs</option>
                <option value="sets">sets</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Rental Vendor</label>
              <input
                type="text"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="Vendor Name"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Color, Model & Material Specs</label>
            <input
              type="text"
              value={specification}
              onChange={(e) => setSpecification(e.target.value)}
              placeholder="e.g. 90cm diameter, chrome base with 4 white cushioned chairs"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Placement near discussion zone A..."
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
              {formSubmitting ? 'Saving...' : editingItem ? 'Save Changes' : 'Add Furniture'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deletingItem !== null}
        onClose={() => setDeletingItem(null)}
        title="Confirm Removal"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <p className="text-zinc-300">
            Are you sure you want to remove{' '}
            <span className="font-bold text-zinc-100">{deletingItem?.item_name}</span>?
          </p>
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setDeletingItem(null)}
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
              {formSubmitting ? 'Removing...' : 'Confirm Remove'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
