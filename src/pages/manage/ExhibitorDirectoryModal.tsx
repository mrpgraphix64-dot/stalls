import React, { useState, useEffect } from 'react';
import { Search, Building, Plus, ExternalLink, MapPin, Tag, Check, Filter } from 'lucide-react';
import { Modal } from './Modal';
import { ExhibitorItem } from './types';
import { fetchExhibitors, createExhibitor } from './api';

interface ExhibitorDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectExhibitor?: (companyName: string, boothNumber?: string) => void;
}

export function ExhibitorDirectoryModal({
  isOpen,
  onClose,
  onSelectExhibitor,
}: ExhibitorDirectoryModalProps) {
  const [exhibitors, setExhibitors] = useState<ExhibitorItem[]>([]);
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Manual Add Exhibitor
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [newCompanyName, setNewCompanyName] = useState<string>('');
  const [newCity, setNewCity] = useState<string>('');
  const [newBooth, setNewBooth] = useState<string>('');
  const [addError, setAddError] = useState<string>('');
  const [addingSubmitting, setAddingSubmitting] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchExhibitors({ limit: 300 });
      setExhibitors(data);
    } catch (e) {
      console.warn('Failed to load exhibitors:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      setIsAddingNew(false);
      setSearch('');
    }
  }, [isOpen]);

  const handleAddNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) {
      setAddError('Company name is required.');
      return;
    }

    setAddingSubmitting(true);
    setAddError('');

    try {
      const res = await createExhibitor({
        company_name: newCompanyName.trim(),
        city: newCity.trim() || undefined,
        booth_number: newBooth.trim() || undefined,
      });

      setNewCompanyName('');
      setNewCity('');
      setNewBooth('');
      setIsAddingNew(false);
      await loadData();
    } catch (err: any) {
      setAddError(err.message || 'Failed to add exhibitor.');
    } finally {
      setAddingSubmitting(false);
    }
  };

  const filtered = exhibitors.filter(
    (ex) =>
      ex.company_name.toLowerCase().includes(search.toLowerCase().trim()) ||
      (ex.city && ex.city.toLowerCase().includes(search.toLowerCase().trim())) ||
      (ex.booth_number && ex.booth_number.toLowerCase().includes(search.toLowerCase().trim()))
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tech Expo Gujarat — Exhibitor Directory Catalogue"
      subtitle="Reference directory of officially participating exhibitors. Use to assign Reworkzone stall fabrications."
      maxWidth="max-w-3xl"
    >
      <div className="space-y-4">
        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by company name, stall #, or city..."
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl pl-9 pr-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 outline-none transition-colors"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsAddingNew(!isAddingNew)}
            className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>+ Add Exhibitor</span>
          </button>
        </div>

        {/* Manual Add Exhibitor Form */}
        {isAddingNew && (
          <form onSubmit={handleAddNew} className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3 animate-in fade-in duration-100">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-zinc-200">Manually Add Company to Catalogue</h4>
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="text-[11px] text-zinc-500 hover:text-zinc-300"
              >
                Cancel
              </button>
            </div>

            {addError && <p className="text-red-400 text-xs">{addError}</p>}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <input
                type="text"
                required
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                placeholder="Company / Exhibitor Name *"
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-zinc-100 placeholder-zinc-500 outline-none"
              />
              <input
                type="text"
                value={newCity}
                onChange={(e) => setNewCity(e.target.value)}
                placeholder="City / Country (optional)"
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-zinc-100 placeholder-zinc-500 outline-none"
              />
              <input
                type="text"
                value={newBooth}
                onChange={(e) => setNewBooth(e.target.value)}
                placeholder="Official Booth # (optional)"
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-zinc-100 placeholder-zinc-500 outline-none font-mono"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={addingSubmitting}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                {addingSubmitting ? 'Adding...' : 'Save Exhibitor'}
              </button>
            </div>
          </form>
        )}

        {/* Exhibitors Table */}
        <div className="border border-zinc-800/80 rounded-xl overflow-hidden bg-zinc-950/60 max-h-[50vh] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900/80 sticky top-0 border-b border-zinc-800 text-zinc-400 font-semibold z-10">
              <tr>
                <th className="py-2.5 px-3.5">Company Name</th>
                <th className="py-2.5 px-3">Location</th>
                <th className="py-2.5 px-3 font-mono">Official Stall</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-zinc-500">
                    Loading exhibitors catalogue...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-zinc-500">
                    No exhibitors matching your search.
                  </td>
                </tr>
              ) : (
                filtered.map((ex) => (
                  <tr key={ex.id} className="hover:bg-zinc-900/60 transition-colors">
                    <td className="py-2.5 px-3.5 font-semibold text-zinc-100">
                      <div>{ex.company_name}</div>
                      {ex.tagline && (
                        <div className="text-[10px] text-zinc-500 font-normal line-clamp-1">{ex.tagline}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-zinc-400">
                      {ex.city || '—'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-amber-400">
                      {ex.booth_number || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-zinc-400 text-[11px]">
                      {ex.booth_category || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {onSelectExhibitor && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectExhibitor(ex.company_name, ex.booth_number || undefined);
                            onClose();
                          }}
                          className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          + Assign Stall
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1">
          <span>Showing {filtered.length} of {exhibitors.length} exhibitors in catalogue</span>
          <span>Verified from Tech Expo Gujarat 2026</span>
        </div>
      </div>
    </Modal>
  );
}
