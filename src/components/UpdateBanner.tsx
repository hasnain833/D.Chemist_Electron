import { useState, useEffect } from 'react';
import { Download, X, RefreshCw, AlertCircle, CheckCircle2, Zap } from 'lucide-react';

interface UpdateStatus {
  state: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  releaseNotes?: string;
  percent?: number;
  error?: string;
}

/**
 * UpdateBanner — mirrors WPF UpdateDialog.xaml
 *
 * Listens to update-status events from the main process and renders:
 *  - 'available'   → modal asking user to download
 *  - 'downloading' → modal with progress bar (matches WPF ProgressContainer)
 *  - 'downloaded'  → modal asking user to install now or later
 *  - 'error'       → inline error toast
 */
export default function UpdateBanner() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Register listener — only available in Electron context
    const api = (window as any).electronAPI;
    if (!api?.onUpdateStatus) return;

    const cleanup = api.onUpdateStatus((payload: UpdateStatus) => {
      // Never show 'not-available' or 'checking' to the user
      if (payload.state === 'not-available' || payload.state === 'checking') return;
      setStatus(payload);
      setDismissed(false); // re-show if a new event arrives
    });

    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, []);

  if (!status || dismissed) return null;

  const handleDownload = () => {
    (window as any).electronAPI?.downloadUpdate?.();
    setStatus(prev => prev ? { ...prev, state: 'downloading', percent: 0 } : prev);
  };

  const handleInstall = () => {
    (window as any).electronAPI?.installUpdate?.();
  };

  const handleDismiss = () => setDismissed(true);

  // ── Error toast (non-blocking) ──
  if (status.state === 'error') {
    return (
      <div className="fixed bottom-6 right-6 z-[9999] animate-in slide-in-from-bottom-4 duration-300">
        <div className="bg-white border border-rose-200 rounded-xl shadow-xl p-4 flex items-start gap-3 max-w-sm">
          <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={18} />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-[#111827]">Update Failed</p>
            <p className="text-[11px] text-[#6B7280] mt-0.5 truncate">{status.error || 'Unknown error occurred.'}</p>
          </div>
          <button onClick={handleDismiss} className="text-slate-400 hover:text-slate-600 transition-colors shrink-0">
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ── Modal overlay for available / downloading / downloaded ──
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-[440px] overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header strip — matches WPF gradient accent */}
        <div className="bg-gradient-to-r from-[#00D2FF] to-[#3a7bd5] px-6 py-5 flex items-center gap-4">
          <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
            {status.state === 'downloaded'
              ? <CheckCircle2 className="text-white" size={22} />
              : status.state === 'downloading'
                ? <RefreshCw className="text-white animate-spin" size={22} />
                : <Zap className="text-white" size={22} />
            }
          </div>
          <div>
            <p className="text-white font-bold text-[16px] leading-tight">
              {status.state === 'downloaded' ? 'Update Ready to Install' : 'New Version Available'}
            </p>
            {status.version && (
              <p className="text-[#00D2FF]/80 text-[13px] font-bold mt-0.5" style={{ color: 'rgba(200,240,255,0.9)' }}>
                Version {status.version}
              </p>
            )}
          </div>
          {/* Only allow dismissal when not mid-download */}
          {status.state !== 'downloading' && (
            <button
              onClick={handleDismiss}
              className="ml-auto text-white/70 hover:text-white transition-colors shrink-0"
              title="Dismiss"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="p-6 space-y-5">

          {/* Intro text — matches WPF "A new version of D. Chemist is ready to install!" */}
          <p className="text-[14px] font-semibold text-[#111827]">
            {status.state === 'downloaded'
              ? 'The update has been downloaded and is ready to install. Restart the app now to apply it.'
              : 'A new version of D. Chemist is ready to install!'}
          </p>

          {/* Release Notes — matches WPF ReleaseNotesText block */}
          {status.releaseNotes && (
            <div className="bg-[#F9FAFB] border border-[#EEEEEE] rounded-lg p-4 space-y-2">
              <p className="text-[11px] font-bold text-[#718096] uppercase tracking-wider">What's New</p>
              <p className="text-[13px] text-[#374151] leading-relaxed whitespace-pre-line max-h-[120px] overflow-auto custom-scrollbar">
                {status.releaseNotes}
              </p>
            </div>
          )}

          {/* Progress bar — matches WPF ProgressContainer */}
          {status.state === 'downloading' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[#6B7280] font-semibold">Downloading update...</span>
                <span className="text-[12px] font-bold text-[#00D2FF]">{status.percent ?? 0}%</span>
              </div>
              <div className="h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#00D2FF] to-[#3a7bd5] rounded-full transition-all duration-300"
                  style={{ width: `${status.percent ?? 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons — matches WPF PrimaryButtonText / SecondaryButtonText */}
          <div className="flex gap-3 pt-1">
            {status.state === 'available' && (
              <>
                <button
                  onClick={handleDownload}
                  className="flex-1 h-11 btn-primary flex items-center justify-center gap-2 text-[14px] font-bold"
                >
                  <Download size={16} /> Update Now
                </button>
                <button
                  onClick={handleDismiss}
                  className="flex-1 h-11 btn-secondary flex items-center justify-center text-[14px] font-semibold"
                >
                  Not Now
                </button>
              </>
            )}

            {status.state === 'downloading' && (
              <div className="flex-1 h-11 bg-slate-100 rounded-xl flex items-center justify-center text-[13px] text-slate-500 font-semibold select-none">
                <RefreshCw size={15} className="animate-spin mr-2" /> Downloading…
              </div>
            )}

            {status.state === 'downloaded' && (
              <>
                <button
                  onClick={handleInstall}
                  className="flex-1 h-11 btn-primary flex items-center justify-center gap-2 text-[14px] font-bold"
                >
                  <RefreshCw size={16} /> Restart &amp; Install
                </button>
                <button
                  onClick={handleDismiss}
                  className="flex-1 h-11 btn-secondary flex items-center justify-center text-[14px] font-semibold"
                >
                  Later
                </button>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
