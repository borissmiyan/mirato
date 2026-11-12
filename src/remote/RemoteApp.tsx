import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import { BibleBrowser } from './components/BibleBrowser';
import { useRemoteSocket } from './hooks/useRemoteSocket';
import { RemoteLogin } from './components/RemoteLogin';
import { RemoteSlides } from './components/RemoteSlides';
import { SlideThumbnail } from './components/SlideThumbnail';
import { RemoteHeader } from './components/RemoteHeader';
import { RemoteFooter } from './components/RemoteFooter';
import { RemoteSlideState } from './types';
import { cn } from '../core/utils/cn';
import { Button } from '@/shared/ui/Button';

export const RemoteApp = () => {
  const { t, i18n } = useTranslation();
  const [pin, setPin] = useState('');
  const [mode, setRawMode] = useState<'slides' | 'bible' | 'timeline'>('slides');

  const setMode = (newMode: 'slides' | 'bible' | 'timeline') => {
    if (newMode === mode) return;
    setRawMode(newMode);
    if (newMode === 'bible') {
      sendCommand('APP_MODE', { mode: 'scripture' });
    } else if (newMode === 'slides' && mode === 'bible') {
      sendCommand('APP_MODE', { mode: 'presentation' });
      sendCommand('PROJECTOR_START');
    }
  };

  const {
    connected,
    authError,
    slideState,
    setSlideState,
    connect,
    disconnect,
    sendCommand,
    handleBibleQuery
  } = useRemoteSocket();

  // Initial restore from cache & auto-login
  useEffect(() => {
    const cachedTheme = localStorage.getItem('remote-theme');
    const cachedLang = localStorage.getItem('remote-lang');
    if (cachedTheme) document.documentElement.setAttribute('data-theme', cachedTheme);
    if (cachedLang) i18n.changeLanguage(cachedLang);

    const savedPin = localStorage.getItem('remote_pin');
    if (savedPin && savedPin.length === 4) {
      connect(savedPin);
    }
  }, [connect, i18n]);

  const handleMediaToggle = () => {
    if (!slideState) return;
    setSlideState((prev: RemoteSlideState | null) => prev ? ({ ...prev, playing: !prev.playing }) : prev);
    sendCommand('MEDIA_TOGGLE');
  };

  const handleOverrideToggle = (type: 'blackout' | 'whiteout' | 'logo') => {
    if (!slideState) return;
    setSlideState((prev: RemoteSlideState | null) => prev ? ({
      ...prev,
      activeOverride: prev.activeOverride === type ? null : type
    }) : prev);

    const commandMap = {
      blackout: 'OVERRIDE_BLACK',
      whiteout: 'OVERRIDE_WHITE',
      logo: 'OVERRIDE_LOGO'
    };
    sendCommand(commandMap[type]);
  };

  return (
    <>
      {!connected && (
        <div className="fixed inset-0 z-50">
          <RemoteLogin
            pin={pin}
            setPin={setPin}
            onConnect={connect}
            authError={authError}
          />
        </div>
      )}

      <div 
        className={cn(
          "flex-col fixed inset-0 w-full overflow-x-hidden bg-stone-950 text-white px-6 pt-[max(env(safe-area-inset-top),0.5rem)] pb-[max(env(safe-area-inset-bottom),0.25rem)] overscroll-none overflow-hidden transition-all duration-500",
          connected ? "flex" : "hidden"
        )}
      >
        <RemoteHeader
          isActive={!!slideState?.active}
          onToggleProjector={() => sendCommand(slideState?.active ? 'PROJECTOR_STOP' : 'PROJECTOR_START')}
          onLogout={disconnect}
        />

        <div className="flex-1 flex flex-col min-h-0 relative z-10">
          {mode === 'slides' ? (
            slideState ? (
              <RemoteSlides
                slideState={slideState}
                onMediaToggle={handleMediaToggle}
                onMediaStop={() => sendCommand('MEDIA_STOP')}
                onOverrideToggle={handleOverrideToggle}
                onCommand={sendCommand}
                onShowTimeline={() => setMode('timeline')}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center bg-stone-900/40 rounded-3xl border border-white/5 animate-pulse">
                <p className="text-stone-500 font-medium text-sm">{t('remote.ready')}</p>
              </div>
            )
          ) : mode === 'timeline' ? (
            <div className="flex-1 min-h-0 flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300 bg-stone-950">
              <div className="p-4 border-b border-white/10 flex items-center gap-3 shrink-0 bg-stone-900/40 rounded-t-2xl">
                <Button
                  variant="secondary"
                  size="sm"
                  square
                  onClick={() => setMode('slides')}
                  aria-label={t('common:back', 'Back')}
                >
                  <ChevronLeft className="w-5 h-5 text-white" />
                </Button>
                <h2 className="text-lg font-bold uppercase tracking-widest">{t('remote.all_slides', 'All Slides')}</h2>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 pb-8">
                {slideState?.timelineSlides?.map((slide, idx) => (
                  <div
                    key={slide.id}
                    onClick={() => {
                      sendCommand('SLIDE_SELECT', { id: slide.id });
                      setMode('slides');
                    }}
                    className="cursor-pointer apple-press bg-stone-900/60 p-2 rounded-2xl border border-white/5 hover:border-white/15 transition-all"
                  >
                    <div className="pointer-events-none">
                      <SlideThumbnail 
                        slide={slide} 
                        settings={slideState.settings} 
                        label={slide.name || slide.label || t('remote.slide_number', { number: idx + 1, defaultValue: `Slide ${idx + 1}` })} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col h-full animate-in fade-in slide-in-from-left-4 duration-300">
              <BibleBrowser
                onCommand={sendCommand}
                onQuery={handleBibleQuery}
                onSelect={(data) => {
                  sendCommand('BIBLE_SELECT', Array.isArray(data) ? { verses: data } : { verse: data });
                }}
                activeOverride={slideState?.activeOverride}
                activeLogoUrl={slideState?.activeLogoUrl || 
                  (slideState?.settings as { logo?: { url?: string }; appearance?: { logo?: { url?: string } } } | undefined)?.logo?.url || 
                  (slideState?.settings as { logo?: { url?: string }; appearance?: { logo?: { url?: string } } } | undefined)?.appearance?.logo?.url}
                onOverrideToggle={handleOverrideToggle}
              />
            </div>
          )}
        </div>

        <RemoteFooter mode={mode} setMode={setMode} />
      </div>
    </>
  );
};
