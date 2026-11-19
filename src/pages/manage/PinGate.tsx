import React, { useState, useEffect, useRef } from 'react';
import { Lock, ShieldAlert, AlertTriangle, ArrowRight, RefreshCw, KeyRound } from 'lucide-react';
import { loginWithPin } from './api';

interface PinGateProps {
  onSuccess: () => void;
  isInitialized: boolean;
  rateLimited?: boolean;
  retryAfter?: number;
}

export function PinGate({ onSuccess, isInitialized, rateLimited = false, retryAfter = 0 }: PinGateProps) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(retryAfter);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Lockout countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Focus first digit box on mount
  useEffect(() => {
    if (countdown === 0 && inputRefs.current[0]) {
      inputRefs.current[0]?.focus();
    }
  }, [countdown]);

  const handleDigitChange = (index: number, val: string) => {
    if (countdown > 0) return;
    // Keep only the last character entered if user typed, and only if numeric
    const clean = val.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = clean;
    setDigits(newDigits);
    setError('');

    // Advance focus
    if (clean && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto submit on 6th digit
    if (clean && index === 5) {
      const fullPin = newDigits.join('');
      if (fullPin.length === 6) {
        submitPin(fullPin);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (countdown > 0) return;
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!paste) return;
    const newDigits = [...digits];
    for (let i = 0; i < paste.length; i++) {
      newDigits[i] = paste[i];
    }
    setDigits(newDigits);
    if (paste.length === 6) {
      submitPin(paste);
    } else {
      inputRefs.current[Math.min(paste.length, 5)]?.focus();
    }
  };

  const handleKeypadPress = (num: string) => {
    if (countdown > 0) return;
    const emptyIndex = digits.findIndex((d) => d === '');
    if (emptyIndex !== -1) {
      handleDigitChange(emptyIndex, num);
    }
  };

  const handleKeypadBackspace = () => {
    if (countdown > 0) return;
    const filledIndices = digits
      .map((d, i) => (d !== '' ? i : -1))
      .filter((i) => i !== -1);
    if (filledIndices.length > 0) {
      const lastIndex = filledIndices[filledIndices.length - 1];
      const newDigits = [...digits];
      newDigits[lastIndex] = '';
      setDigits(newDigits);
      inputRefs.current[lastIndex]?.focus();
      setError('');
    }
  };

  const submitPin = async (pinToSubmit: string) => {
    if (pinToSubmit.length !== 6 || loading || countdown > 0) return;

    setLoading(true);
    setError('');

    try {
      await loginWithPin(pinToSubmit);
      onSuccess();
    } catch (err: any) {
      const status = err.status;
      const data = err.data || {};

      if (status === 429) {
        setCountdown(data.retry_after || 900);
        setError(data.error || 'Too many attempts. Access is locked for 15 minutes.');
      } else if (status === 401) {
        if (data.remaining !== undefined) {
          setRemainingAttempts(data.remaining);
        }
        setError(data.error || 'Incorrect security PIN.');
        setDigits(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else {
        setError(err.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // If system has not been initialized via CLI yet
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-zinc-100 font-sans">
        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl space-y-6 text-center">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto text-amber-500">
            <KeyRound className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">Operations Setup Required</h1>
            <p className="text-sm text-zinc-400">
              The internal operations database is uninitialized. For security, setup must be performed directly on the server via CLI.
            </p>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-left font-mono text-xs text-amber-400/90 overflow-x-auto select-all">
            php manage/init-cli.php
          </div>

          <div className="text-xs text-zinc-500 text-left space-y-1">
            <p>1. Open your server terminal / SSH or deployment console.</p>
            <p>2. Run the command above and follow the interactive prompt.</p>
            <p>3. Once complete, refresh this page to sign in.</p>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="w-full py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Check Initialization Status
          </button>
        </div>
      </div>
    );
  }

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-sm sm:max-w-md bg-zinc-900/90 border border-zinc-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-tr from-amber-600/20 to-amber-400/10 border border-amber-500/30 rounded-2xl text-amber-500 shadow-inner mb-1">
            <Lock className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Reworkzone Operations</h1>
          <p className="text-xs text-zinc-400">Enter your 6-digit Master PIN to unlock the command center</p>
        </div>

        {/* Lockout Banner */}
        {countdown > 0 ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-red-400 font-semibold text-sm">
              <ShieldAlert className="w-5 h-5" />
              <span>Access Temporarily Locked</span>
            </div>
            <p className="text-xs text-zinc-400">Too many failed attempts. Try again in:</p>
            <div className="text-2xl font-mono font-bold text-red-400">{formatCountdown(countdown)}</div>
          </div>
        ) : (
          /* PIN Input Boxes */
          <div className="space-y-4">
            <div className="flex justify-center gap-2 sm:gap-3">
              {digits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (inputRefs.current[idx] = el)}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  disabled={loading || countdown > 0}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  onPaste={handlePaste}
                  className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-bold rounded-xl border transition-all outline-none bg-zinc-950/80 ${
                    digit
                      ? 'border-amber-500/80 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                      : 'border-zinc-800 text-zinc-100 focus:border-amber-500/50'
                  } ${error ? 'border-red-500/70' : ''}`}
                />
              ))}
            </div>

            {/* Error & Attempts Warning */}
            {error && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-red-400 text-center animate-in fade-in">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {remainingAttempts !== null && remainingAttempts > 0 && remainingAttempts < 5 && !error && (
              <p className="text-xs text-amber-400/80 text-center">
                {remainingAttempts} attempt{remainingAttempts === 1 ? '' : 's'} remaining before lockout
              </p>
            )}

            {/* Submit Button */}
            <button
              onClick={() => submitPin(digits.join(''))}
              disabled={digits.join('').length !== 6 || loading || countdown > 0}
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 text-zinc-950 font-semibold text-sm rounded-xl transition-all shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Verifying PIN...
                </>
              ) : (
                <>
                  Unlock Operations Workspace
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}

        {/* On-screen Keypad for Touch / Mobile */}
        <div className="pt-2 border-t border-zinc-800/60">
          <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
              <button
                key={n}
                type="button"
                disabled={loading || countdown > 0}
                onClick={() => handleKeypadPress(n)}
                className="h-11 rounded-xl bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-semibold text-base transition-colors active:scale-95 disabled:opacity-40"
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              disabled={loading || countdown > 0}
              onClick={() => setDigits(['', '', '', '', '', ''])}
              className="h-11 rounded-xl bg-zinc-800/20 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 text-xs font-medium transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={loading || countdown > 0}
              onClick={() => handleKeypadPress('0')}
              className="h-11 rounded-xl bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-semibold text-base transition-colors active:scale-95 disabled:opacity-40"
            >
              0
            </button>
            <button
              type="button"
              disabled={loading || countdown > 0}
              onClick={handleKeypadBackspace}
              className="h-11 rounded-xl bg-zinc-800/20 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-sm font-medium transition-colors flex items-center justify-center"
            >
              ⌫
            </button>
          </div>
        </div>

        <div className="text-center">
          <a
            href="/"
            className="text-xs text-zinc-500 hover:text-zinc-400 transition-colors inline-block"
          >
            &larr; Back to Public Website
          </a>
        </div>
      </div>
    </div>
  );
}
