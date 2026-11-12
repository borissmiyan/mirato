import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useLoadingStore } from '../store/loadingStore';
import logoUrl from '@/assets/app-logo/logo.png';

export const LoadingScreen: React.FC = () => {
  const { t } = useTranslation();
  const { phase, progress, isLoaded } = useLoadingStore(
    useShallow((s) => ({ phase: s.phase, progress: s.progress, isLoaded: s.isLoaded }))
  );
  const [shouldRender, setShouldRender] = useState(true);
  const [opacity, setOpacity] = useState(1);
  const [scale, setScale] = useState(1);

  // Cleanly remove initial HTML preloader once React has mounted
  useEffect(() => {
    const preloader = document.getElementById('splash-preloader');
    if (preloader) {
      preloader.remove();
    }
  }, []);

  // Velvety exit transition when initialization finishes
  useEffect(() => {
    if (isLoaded) {
      const timer = setTimeout(() => {
        setOpacity(0);
        setScale(1.02);
        setTimeout(() => setShouldRender(false), 500);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isLoaded]);

  if (!shouldRender) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-[#0c0a09] select-none transition-opacity duration-500 ease-out"
      style={{
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      {/* Warm Ambient Center Glow */}
      <div className="absolute w-[480px] h-[480px] rounded-full bg-[radial-gradient(circle,rgba(237,185,0,0.08)_0%,rgba(12,10,9,0)_70%)] pointer-events-none" />

      <div className="relative flex flex-col items-center gap-8 z-10">
        {/* Mirato Alpha Logo with Breathing Float Animation */}
        <div className="relative w-[140px] h-[102px] flex items-center justify-center animate-[mirato-float_3.2s_cubic-bezier(0.4,0,0.2,1)_infinite]">
          <img
            src={logoUrl}
            alt="Mirato"
            className="w-full h-full object-contain filter drop-shadow-[0_0_30px_rgba(237,185,0,0.35)]"
          />
        </div>

        {/* Brand Name & Status */}
        <div className="flex flex-col items-center gap-3.5 text-center">
          <div className="font-sans text-[13px] font-semibold tracking-[0.35em] text-stone-100 indent-[0.35em]">
            MIRATO
          </div>
          <div className="font-sans text-[10px] font-medium tracking-[0.18em] uppercase text-stone-400">
            {t(`loading_status.${phase}`, { defaultValue: t('loading', 'Загрузка студии...') })}
          </div>

          {/* Micro-Progress Bar */}
          <div className="mt-1.5 w-40 h-[2px] bg-white/[0.08] rounded-full overflow-hidden relative">
            <div
              className="absolute inset-0 bg-gradient-to-r from-[#edb900] to-[#fedf6e] rounded-full shadow-[0_0_10px_rgba(237,185,0,0.6)] origin-left transition-transform duration-500 ease-out"
              style={{ transform: `scaleX(${Math.max(0.08, progress / 100)})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[mirato-shimmer_1.8s_ease-in-out_infinite]" />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes mirato-float {
          0%, 100% {
            transform: translateY(0px) scale(1);
            filter: drop-shadow(0 0 25px rgba(237, 185, 0, 0.25));
          }
          50% {
            transform: translateY(-4px) scale(1.015);
            filter: drop-shadow(0 0 35px rgba(237, 185, 0, 0.45));
          }
        }
        @keyframes mirato-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
};
