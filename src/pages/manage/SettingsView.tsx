import React, { useState } from 'react';
import {
  KeyRound,
  ShieldCheck,
  Database,
  Lock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Server,
  Info,
  Download,
  Check,
} from 'lucide-react';
import { changePin, verifyDatabaseBackup, createDatabaseSnapshot } from './api';

export function SettingsView() {
  const [currentPin, setCurrentPin] = useState<string>('');
  const [newPin, setNewPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Backup & Integrity State
  const [verifyLoading, setVerifyLoading] = useState<boolean>(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [snapshotLoading, setSnapshotLoading] = useState<boolean>(false);
  const [snapshotMessage, setSnapshotMessage] = useState<string>('');

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!/^\d{6}$/.test(currentPin)) {
      setError('Current PIN must be exactly 6 numeric digits.');
      return;
    }
    if (!/^\d{6}$/.test(newPin)) {
      setError('New PIN must be exactly 6 numeric digits.');
      return;
    }
    if (newPin === currentPin) {
      setError('New PIN must be different from current PIN.');
      return;
    }
    if (newPin !== confirmPin) {
      setError('New PIN and confirmation do not match.');
      return;
    }
    if (/^(\d)\1{5}$/.test(newPin) || ['123456', '654321', '012345'].includes(newPin)) {
      setError('New PIN is too simple. Please choose a non-sequential PIN.');
      return;
    }

    setLoading(true);
    try {
      const res = await changePin(currentPin, newPin);
      setSuccess(res.message || 'Master 6-digit PIN has been updated successfully.');
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    } catch (err: any) {
      setError(err.message || 'Failed to update PIN.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyIntegrity = async () => {
    setVerifyLoading(true);
    try {
      const data = await verifyDatabaseBackup();
      setVerifyResult(data);
    } catch (err: any) {
      alert(err.message || 'Verification request failed.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleCreateSnapshot = async () => {
    setSnapshotLoading(true);
    setSnapshotMessage('');
    try {
      const data = await createDatabaseSnapshot();
      if (data.success) {
        setSnapshotMessage(data.message || 'Server snapshot created successfully.');
      } else {
        alert(data.message || 'Failed to create snapshot.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to create snapshot.');
    } finally {
      setSnapshotLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in duration-200">
      {/* Header */}
      <div className="pb-2 border-b border-zinc-800/60">
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
          Security & System Settings
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Manage operations security PIN, server data paths, and SQLite configuration
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Change PIN Card */}
        <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-6 shadow-md space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-zinc-800/60">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100">Update Master 6-Digit PIN</h2>
              <p className="text-[11px] text-zinc-400">Authenticated PIN rotation for operations access</p>
            </div>
          </div>

          <form onSubmit={handleChangePin} className="space-y-3.5 text-xs">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <div>
              <label className="block text-zinc-300 font-medium mb-1">Current 6-Digit PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                required
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 font-mono tracking-widest text-center text-sm focus:outline-none focus:border-amber-500/60"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-medium mb-1">New 6-Digit PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                required
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 font-mono tracking-widest text-center text-sm focus:outline-none focus:border-amber-500/60"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-medium mb-1">Confirm New 6-Digit PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                required
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 font-mono tracking-widest text-center text-sm focus:outline-none focus:border-amber-500/60"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold rounded-xl transition-all shadow-md shadow-amber-500/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Updating Security PIN...
                </>
              ) : (
                'Update Master PIN'
              )}
            </button>
          </form>
        </div>

        {/* Database & System Architecture Info */}
        <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-6 shadow-md space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-zinc-800/60">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100">Database & Architecture</h2>
              <p className="text-[11px] text-zinc-400">Hostinger-compatible SQLite infrastructure</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-zinc-800/60">
              <span className="text-zinc-500">Database Engine:</span>
              <span className="font-semibold text-zinc-200">SQLite 3 (WAL Mode)</span>
            </div>
            <div className="flex justify-between py-2 border-b border-zinc-800/60">
              <span className="text-zinc-500">Foreign Keys:</span>
              <span className="font-semibold text-emerald-400">Enforced (ON)</span>
            </div>
            <div className="flex justify-between py-2 border-b border-zinc-800/60">
              <span className="text-zinc-500">Persistent Storage:</span>
              <span className="font-mono text-[11px] text-zinc-300">../reworkzone_data/</span>
            </div>
            <div className="flex justify-between py-2 border-b border-zinc-800/60">
              <span className="text-zinc-500">Storage Location:</span>
              <span className="text-emerald-400 font-medium">Outside public_html</span>
            </div>
            <div className="flex justify-between py-2 border-b border-zinc-800/60">
              <span className="text-zinc-500">Design & Print Files:</span>
              <span className="text-amber-400 font-medium">Google Drive URLs Only</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-zinc-500">Access Mode:</span>
              <span className="text-zinc-300 font-medium">Single 6-Digit Master PIN</span>
            </div>
          </div>

          <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-3 text-[11px] text-zinc-400 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>
              All event, booth, and Google Drive links are preserved in the persistent SQLite database file, which survives Git deployments on Hostinger.
            </span>
          </div>
        </div>

        {/* Database Backup & Disaster Recovery Card */}
        <div className="md:col-span-2 bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/60">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-zinc-100">SQLite Backups & Disaster Recovery</h2>
                <p className="text-[11px] text-zinc-400">1-click protected backup download and online snapshot creation</p>
              </div>
            </div>

            <a
              href="/manage/api/backup.php?action=download"
              download
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs rounded-xl shadow-md shadow-amber-500/10 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download DB Backup (.sqlite)</span>
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-3">
              <h3 className="font-semibold text-zinc-200 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                Integrity Verification
              </h3>
              <p className="text-zinc-400 text-[11px]">
                Runs SQLite PRAGMA integrity_check and foreign key constraints verification on the live active database.
              </p>
              <button
                type="button"
                onClick={handleVerifyIntegrity}
                disabled={verifyLoading}
                className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-xl font-medium transition-colors text-xs flex items-center gap-1.5"
              >
                {verifyLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Verify Database Integrity</span>
              </button>

              {verifyResult && (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[11px] space-y-1">
                  <div>Status: {verifyResult.integrity} (0 foreign key violations)</div>
                  <div className="text-[10px] text-zinc-400">File: {verifyResult.database_path} ({Math.round(verifyResult.size_bytes / 1024)} KB)</div>
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-3">
              <h3 className="font-semibold text-zinc-200 flex items-center gap-2">
                <Server className="w-4 h-4 text-blue-400" />
                Server-Side Daily Snapshots
              </h3>
              <p className="text-zinc-400 text-[11px]">
                Creates a timestamped snapshot in <code className="text-amber-400">../reworkzone_data/backups/</code> with automatic 7-day retention.
              </p>
              <button
                type="button"
                onClick={handleCreateSnapshot}
                disabled={snapshotLoading}
                className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-xl font-medium transition-colors text-xs flex items-center gap-1.5"
              >
                {snapshotLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Create Server Snapshot</span>
              </button>

              {snapshotMessage && (
                <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[11px]">
                  {snapshotMessage}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

