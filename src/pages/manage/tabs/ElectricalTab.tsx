import React, { useEffect, useState } from 'react';
import {
  Zap,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  Check,
  Tv,
  Lightbulb,
  Radio,
  Sliders,
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

interface ElectricalTabProps {
  boothId: string;
}

export function ElectricalTab({ boothId }: ElectricalTabProps) {
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
      const data = await fetchItems(boothId, 'electrical');
      setItems(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load electrical items.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [boothId]);

  const openCreateModal = (presetName?: string, presetSpec?: string) => {
    setEditingItem(null);
    setItemName(presetName || '');
    setQuantity(1);
    setUnit('nos');
    setSpecification(presetSpec || '');
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
      setFormError('Please enter an electrical/AV item name.');
      return;
    }
    setFormSubmitting(true);
    setFormError('');

    try {
      if (editingItem) {
        await updateItem(editingItem.id, {
          item_name: itemName.trim(),
          category: 'electrical',
          quantity,
          unit: unit.trim() || 'nos',
          specification: specification.trim() || undefined,
          vendor_name: vendorName.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      } else {
        await createItem({
          booth_id: boothId,
          category: 'electrical',
          item_name: itemName.trim(),
          quantity,
          unit: unit.trim() || 'nos',
          specification: specification.trim() || undefined,
          vendor_name: vendorName.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save electrical item.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggle = async (itemId: string, field: 'is_delivered' | 'is_installed') => {
    try {
      await toggleItemStatus(itemId, field);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update electrical status.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingItem) return;
    try {
      setFormSubmitting(true);
      await deleteItem(deletingItem.id);
      setDeletingItem(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete electrical item.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Summary Metrics
  const totalItems = items.length;
  const totalUnits = items.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
  const totalDelivered = items.filter((i) => i.is_delivered === 1).length;
  const totalInstalled = items.filter((i) => i.is_installed === 1).length;

  const quickPresets = [
    { name: 'LED Arm Spotlight (50W)', spec: 'Warm white / Cool white fixture' },
    { name: '5A Power Socket (Single Phase)', spec: 'Floor-mounted, 230V standard' },
    { name: '15A Power Socket (High Load)', spec: 'For coffee machine, LED wall, equipment' },
    { name: '50" 4K Smart LED TV / Screen', spec: 'With HDMI cable, USB player, floor stand' },
    { name: 'Multi-plug Extension Spike Board', spec: '4-way 5m surge-protected cord' },
    { name: 'COB Track Light Fixture', spec: 'White body, 30W focused spotlight' },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5">
        <div>
          <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            Electrical, Lighting & AV Equipment
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Manage power points, spotlight fixtures, LED TV displays, and extension boards for this booth.
          </p>
        </div>

        <button
          onClick={() => openCreateModal()}
          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs rounded-xl shadow-md shadow-amber-500/10 flex items-center gap-1.5 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Electrical Item</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-3.5">
          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Line Items</span>
          <p className="text-xl font-bold font-mono text-zinc-100 mt-0.5">{totalItems}</p>
        </div>
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-3.5">
          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Total Fixtures/Points</span>
          <p className="text-xl font-bold font-mono text-amber-400 mt-0.5">{totalUnits}</p>
        </div>
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-3.5">
          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Delivered to Site</span>
          <p className="text-xl font-bold font-mono text-blue-400 mt-0.5">{totalDelivered}/{totalItems}</p>
        </div>
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-3.5">
          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Installed & Powered</span>
          <p className="text-xl font-bold font-mono text-emerald-400 mt-0.5">{totalInstalled}/{totalItems}</p>
        </div>
      </div>

      {/* Quick Add Presets Bar */}
      <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-xl p-3 space-y-2">
        <span className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-amber-400" />
          Quick Add Presets:
        </span>
        <div className="flex flex-wrap gap-2">
          {quickPresets.map((p, idx) => (
            <button
              key={idx}
              onClick={() => openCreateModal(p.name, p.spec)}
              className="text-[11px] bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-amber-400 border border-zinc-700/80 hover:border-amber-500/40 rounded-lg px-2.5 py-1 transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3 h-3 text-amber-400" />
              <span>{p.name}</span>
            </button>
          ))}
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
          Loading electrical equipment inventory...
        </div>
      ) : items.length === 0 ? (
        <div className="bg-zinc-900/30 border border-dashed border-zinc-800 rounded-2xl p-12 text-center space-y-3">
          <Zap className="w-10 h-10 text-zinc-600 mx-auto" />
          <h3 className="text-sm font-semibold text-zinc-300">No Electrical Items Added</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Specify lighting fixtures, power sockets, LED screens, and extension cabling for this stall.
          </p>
          <button
            onClick={() => openCreateModal()}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add First Item
          </button>
        </div>
      ) : (
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/60 text-zinc-400 border-b border-zinc-800/80">
                <tr>
                  <th className="py-3 px-4 font-semibold">Item & Specification</th>
                  <th className="py-3 px-4 font-semibold text-center">Qty / Unit</th>
                  <th className="py-3 px-4 font-semibold">Vendor / Supplier</th>
                  <th className="py-3 px-4 font-semibold text-center">Delivered</th>
                  <th className="py-3 px-4 font-semibold text-center">Installed</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {items.map((item) => {
                  const isDelivered = item.is_delivered === 1;
                  const isInstalled = item.is_installed === 1;

                  return (
                    <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {item.item_name.toLowerCase().includes('tv') ||
                          item.item_name.toLowerCase().includes('screen') ||
                          item.item_name.toLowerCase().includes('led wall') ? (
                            <Tv className="w-4 h-4 text-purple-400 shrink-0" />
                          ) : item.item_name.toLowerCase().includes('light') ||
                            item.item_name.toLowerCase().includes('spot') ? (
                            <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" />
                          ) : (
                            <Zap className="w-4 h-4 text-blue-400 shrink-0" />
                          )}
                          <span className="font-semibold text-zinc-100">{item.item_name}</span>
                        </div>
                        {item.specification && (
                          <p className="text-[11px] text-zinc-400 mt-0.5 ml-6">
                            {item.specification}
                          </p>
                        )}
                        {item.notes && (
                          <p className="text-[10px] text-zinc-500 italic mt-0.5 ml-6">
                            Note: {item.notes}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-amber-400">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-zinc-400">
                        {item.vendor_name || '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggle(item.id, 'is_delivered')}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all inline-flex items-center gap-1 ${
                            isDelivered
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 shadow-sm'
                              : 'bg-zinc-800/40 text-zinc-500 border-zinc-700/60 hover:text-zinc-300'
                          }`}
                          title="Click to toggle delivered status"
                        >
                          <Check className={`w-3 h-3 ${isDelivered ? 'opacity-100' : 'opacity-30'}`} />
                          <span>{isDelivered ? 'Delivered' : 'Pending'}</span>
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggle(item.id, 'is_installed')}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all inline-flex items-center gap-1 ${
                            isInstalled
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-sm'
                              : 'bg-zinc-800/40 text-zinc-500 border-zinc-700/60 hover:text-zinc-300'
                          }`}
                          title="Click to toggle installed & tested status"
                        >
                          <Check className={`w-3 h-3 ${isInstalled ? 'opacity-100' : 'opacity-30'}`} />
                          <span>{isInstalled ? 'Installed' : 'Pending'}</span>
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingItem(item)}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Edit Electrical / AV Item' : 'Add Electrical / AV Item'}
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
              Item Name <span className="text-amber-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 50W LED Spotlight / 15A Power Socket"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">
                Quantity <span className="text-amber-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Unit</label>
              <input
                type="text"
                placeholder="nos, points, sets"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">
              Technical Specification / Wattage / Model
            </label>
            <input
              type="text"
              placeholder="e.g. 230V 15A high load point / 50 inch 4K HDMI"
              value={specification}
              onChange={(e) => setSpecification(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">
              Vendor / Electrical Contractor
            </label>
            <input
              type="text"
              placeholder="e.g. Venue Official Electrical Team / In-House"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Notes / Installation Notes</label>
            <textarea
              rows={2}
              placeholder="e.g. Locate power socket inside storage counter"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
              {formSubmitting ? 'Saving...' : editingItem ? 'Save Changes' : 'Add Item'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deletingItem)}
        onClose={() => setDeletingItem(null)}
        title="Confirm Deletion"
      >
        <div className="space-y-4 text-xs">
          <p className="text-zinc-300">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-zinc-100">{deletingItem?.item_name}</span>?
          </p>
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={() => setDeletingItem(null)}
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
