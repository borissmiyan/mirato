import React, { Component, ErrorInfo, ReactNode } from 'react';
import { LifeBuoy, RefreshCw, Copy, Check } from 'lucide-react';
import { ErrorLoggingService } from '@/core/services/errorLoggingService';
import i18n from '@/core/i18n';
import { Button } from './Button';
import { IpcService } from '@/core/services/ipcService';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorId: string | null;
  copied: boolean;
}

/**
 * Global Error Boundary.
 * Displays a calm, operator-friendly recovery screen while persisting error diagnostics in Dexie.
 */
export class ErrorBoundary extends Component<Props, State> {
  private copyResetTimer: ReturnType<typeof setTimeout> | null = null;

  public state: State = {
    hasError: false,
    errorId: null,
    copied: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true, errorId: null, copied: false };
  }

  public async componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorId = await ErrorLoggingService.logError(error, 'fatal', {
      componentStack: errorInfo.componentStack || undefined
    });
    this.setState({ errorId });
    if (IpcService.isElectron()) {
      IpcService.send('projector:render-error', {
        message: error.message,
        componentStack: errorInfo.componentStack || undefined,
        errorId
      });
    }
  }

  public componentWillUnmount() {
    if (this.copyResetTimer) {
      clearTimeout(this.copyResetTimer);
      this.copyResetTimer = null;
    }
  }

  private handleCopyId = () => {
    if (!this.state.errorId) return;
    navigator.clipboard.writeText(this.state.errorId);
    this.setState({ copied: true });
    if (this.copyResetTimer) {
      clearTimeout(this.copyResetTimer);
    }
    this.copyResetTimer = setTimeout(() => {
      this.setState({ copied: false });
      this.copyResetTimer = null;
    }, 2000);
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const isReadyToCopy = Boolean(this.state.errorId);

      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#0c0a09] p-6 selection:bg-accent/30 font-sans relative overflow-hidden">
          {/* Subtle warm studio glow matching Mirato aesthetic */}
          <div
            className="fixed w-[520px] h-[520px] rounded-full pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(237, 185, 0, 0.09) 0%, rgba(237, 185, 0, 0.02) 45%, rgba(12, 10, 9, 0) 72%)',
            }}
          />

          <div className="relative z-10 max-w-[440px] w-full animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-[#151210]/95 border border-amber-200/10 p-8 rounded-[28px] shadow-[0_24px_64px_rgba(0,0,0,0.65)] backdrop-blur-xl">
              <div className="flex flex-col items-center text-center">
                {/* Warm calm icon badge */}
                <div className="w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-300/20 flex items-center justify-center mb-5 shadow-[0_0_24px_rgba(255,217,77,0.12)]">
                  <LifeBuoy className="w-7 h-7 text-amber-300" />
                </div>

                {/* Friendly reassuring message */}
                <h1 className="text-[22px] font-bold text-stone-100 tracking-tight mb-2.5">
                  {i18n.t('error_title', 'A small hiccup')}
                </h1>
                <p className="text-stone-400 text-[14px] leading-relaxed max-w-[340px] mb-7">
                  {i18n.t(
                    'error_send_id',
                    'Your presentations and settings are safe. Click below to get right back to work.'
                  )}
                </p>

                {/* Primary action button */}
                <Button
                  size="lg"
                  variant="primary"
                  onClick={this.handleReload}
                  className="w-full h-12 rounded-2xl gap-2.5 text-[15px] font-semibold shadow-[0_8px_24px_rgba(245,158,11,0.22)]"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>{i18n.t('reload_page', 'Get back to work')}</span>
                </Button>

                {/* Calm, unobtrusive support code section */}
                <div className="w-full mt-6 pt-5 border-t border-white/6 text-left">
                  <p className="text-[12px] text-stone-500 mb-2.5 text-center">
                    {i18n.t(
                      'error_support_hint',
                      'If this happens again, share this code with support:'
                    )}
                  </p>

                  <button
                    type="button"
                    disabled={!isReadyToCopy}
                    onClick={this.handleCopyId}
                    className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-black/35 border border-white/6 hover:border-amber-200/20 hover:bg-black/50 disabled:opacity-60 disabled:cursor-default transition-all group cursor-pointer"
                    title={i18n.t('copy_error_id', 'Copy code')}
                  >
                    <span className="font-mono text-[11px] text-stone-400 truncate select-all">
                      {this.state.errorId || i18n.t('logging_error', 'Preparing code...')}
                    </span>

                    {isReadyToCopy && (
                      <span className="inline-flex items-center gap-1.5 shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-white/5 text-stone-300 group-hover:bg-amber-400/15 group-hover:text-amber-200 transition-colors">
                        {this.state.copied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-300">{i18n.t('copied', 'Copied!')}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>{i18n.t('copy_error_id_short', 'Copy')}</span>
                          </>
                        )}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
