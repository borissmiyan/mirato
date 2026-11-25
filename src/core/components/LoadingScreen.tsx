import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLoadingStore } from '../store/loadingStore';
import { cn } from '@/core/utils/cn';
import './loadingScreen.css';

type SplashStage = 'enter' | 'float' | 'approach' | 'click' | 'reveal';

const WITTY_LINES_RU = [
  'Протираем линзу проектора…',
  'Настраиваем гимны в нужную тональность…',
  'Уговариваем слайды лежать ровненько…',
  'Разогреваем золотые пиксели…',
  'Проверяем, на месте ли кнопка LIVE…',
  'Шепчем шрифтам, чтобы не разъезжались…',
  'Ищем ту самую закладку с нужным стихом…',
  'Делаем вид, что совсем не волнуемся перед началом…',
  'Разглаживаем замятые углы у слайдов…',
  'Убеждаемся, что второй монитор не спит…',
  'Расставляем куплеты по порядку, чтобы хор не удивился…',
  'Сдуваем пылинки с красивых переходов…',
  'Прячем кабели за кулисами…',
  'Напоминаем проектору, что сегодня его звёздный час…',
  'Завариваем виртуальный кофе для медиакоманды…',
  'Проверяем, не сбежал ли припев в конец песни…',
  'Наводим уют на таймлайне…',
  'Подкручиваем тёплый свет в студии…',
] as const;

const WITTY_LINES_EN = [
  'Polishing the projector lens…',
  'Tuning the hymns to the right key…',
  'Asking the slides to line up nicely…',
  'Warming up the golden pixels…',
  'Double-checking the LIVE button…',
  'Convincing the fonts to behave…',
  'Finding that exact verse bookmark…',
  'Pretending we are totally calm before showtime…',
  'Smoothing out creased slide corners…',
  'Making sure the second display is wide awake…',
  'Lining up the verses so the choir isn’t surprised…',
  'Dusting off the smooth transitions…',
  'Tucking the cables neatly backstage…',
  'Reminding the projector it’s showtime…',
  'Brewing virtual coffee for the media team…',
  'Checking that the chorus didn’t wander off…',
  'Tidying up the timeline…',
  'Turning up the warmth on the studio lights…',
] as const;

/**
 * Mirato Studio Loading Screen.
 * Zero-snap 3-layer transform architecture:
 * - Outer layer: silky bottom-to-center solid rise (runs once, never removed -> zero snap)
 * - Middle layer: continuous organic levitation starting from exact rest pose (paused in-place on reveal)
 * - Inner layer: click press & solid corner scatter past viewport edges (opacity remains 1)
 * Soft feathered SVG radial-gradient circular portal expands past all screen boundaries without hard borders.
 */
export const LoadingScreen: React.FC = () => {
  const { i18n } = useTranslation();
  const isLoaded = useLoadingStore((s) => s.isLoaded);
  const progress = useLoadingStore((s) => s.progress);
  const [shouldRender, setShouldRender] = useState(true);
  const [hasEntered, setHasEntered] = useState(false);
  const [stage, setStage] = useState<SplashStage>('enter');

  const isEnglish = Boolean(i18n?.language?.toLowerCase().startsWith('en'));
  const lines = isEnglish ? WITTY_LINES_EN : WITTY_LINES_RU;
  const [lineIndex, setLineIndex] = useState(() => Math.floor(Math.random() * WITTY_LINES_RU.length));

  // Remove initial HTML preloader immediately once React mounts
  useEffect(() => {
    const preloader = document.getElementById('splash-preloader');
    if (preloader) {
      preloader.remove();
    }
  }, []);

  // Mark entrance complete once all 3 cards have gently settled into place
  useEffect(() => {
    const enterTimer = setTimeout(() => {
      setHasEntered(true);
      setStage((prev) => (prev === 'enter' ? 'float' : prev));
    }, 1240);
    return () => clearTimeout(enterTimer);
  }, []);

  // Gently cycle witty phrases if initialization takes a few seconds
  useEffect(() => {
    if (stage === 'reveal') return;
    const cycleTimer = setInterval(() => {
      setLineIndex((prev) => (prev + 1) % lines.length);
    }, 2400);
    return () => clearInterval(cycleTimer);
  }, [stage, lines.length]);

  // Measured, unhurried exit choreography once both entrance and app init finish
  useEffect(() => {
    if (!isLoaded || !hasEntered) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    if (prefersReducedMotion) {
      const quickTimer = setTimeout(() => setShouldRender(false), 120);
      return () => clearTimeout(quickTimer);
    }

    const tApproach = setTimeout(() => setStage('approach'), 120);
    const tClick = setTimeout(() => setStage('click'), 900);
    const tReveal = setTimeout(() => setStage('reveal'), 1160);
    const tDone = setTimeout(() => setShouldRender(false), 2460);

    return () => {
      clearTimeout(tApproach);
      clearTimeout(tClick);
      clearTimeout(tReveal);
      clearTimeout(tDone);
    };
  }, [isLoaded, hasEntered]);

  if (!shouldRender) return null;

  const isClicking = stage === 'click';
  const isRevealing = stage === 'reveal';
  const showCursor = stage === 'approach' || stage === 'click' || stage === 'reveal';
  const displayProgress = isLoaded ? 100 : Math.min(100, Math.max(12, progress));
  const currentLine = lines[lineIndex % lines.length];

  const floatPlayState: React.CSSProperties = {
    animationPlayState: isRevealing ? 'paused' : 'running',
  };

  return (
    <div
      className={cn(
        'fixed inset-0 z-[10000] flex flex-col items-center justify-center select-none overflow-hidden',
        isRevealing && 'pointer-events-none'
      )}
    >
      {/* Solid studio backdrop with a soft, borderless expanding circular portal cutout */}
      <svg
        className="fixed inset-0 w-full h-full pointer-events-none"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="mirato-portal-soft-edge">
            <stop offset="0%" stopColor="black" stopOpacity="1" />
            <stop offset="68%" stopColor="black" stopOpacity="1" />
            <stop offset="86%" stopColor="black" stopOpacity="0.52" />
            <stop offset="100%" stopColor="black" stopOpacity="0" />
          </radialGradient>
          <mask id="mirato-splash-portal-mask">
            <rect width="100%" height="100%" fill="white" />
            <circle
              cx="50%"
              cy="50%"
              r="0"
              fill="url(#mirato-portal-soft-edge)"
              className={isRevealing ? 'mirato-portal-circle' : undefined}
            />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="#0c0a09"
          mask="url(#mirato-splash-portal-mask)"
        />
      </svg>

      {/* Subtle Warm Studio Ambient Glow */}
      <div
        className={cn(
          'fixed w-[540px] h-[540px] rounded-full pointer-events-none transition-opacity duration-700',
          isRevealing ? 'opacity-0' : 'opacity-100'
        )}
        style={{
          background:
            'radial-gradient(circle, rgba(237, 185, 0, 0.11) 0%, rgba(237, 185, 0, 0.03) 42%, rgba(12, 10, 9, 0) 72%)',
        }}
      />

      {/* Center Stage: 1-to-1 Mirato 3-Card Logo Stack */}
      <div
        className="relative z-10 w-[220px] h-[164px] flex items-center justify-center"
        style={{ perspective: '900px' }}
      >
        {/* Card 3 — Back / Top Card (#FFD94D, 140x79) -> flies solidly past top-left */}
        <div className="absolute top-0 left-1/2 -ml-[70px] w-[140px] h-[79px] will-change-transform mirato-card-enter-back">
          <div className="w-full h-full will-change-transform mirato-card-float-back" style={floatPlayState}>
            <div
              className="w-full h-full rounded-[12px] border border-amber-200/35 will-change-transform"
              style={{
                background: 'linear-gradient(145deg, #FFD94D 0%, #EAB308 100%)',
                boxShadow: '0 10px 28px rgba(237, 185, 0, 0.22)',
                transition: isRevealing
                  ? 'transform 1250ms cubic-bezier(0.22, 0.61, 0.36, 1)'
                  : 'transform 200ms cubic-bezier(0.34, 1.4, 0.64, 1)',
                transform: isRevealing
                  ? 'translate3d(-88vw, -82vh, 0) rotate(-26deg) scale(0.84)'
                  : isClicking
                    ? 'translate3d(0, 4px, 0) scale(0.94)'
                    : 'translate3d(0, 0, 0) scale(1)',
              }}
            />
          </div>
        </div>

        {/* Card 2 — Middle Card (#FEDF6E, 183x103) -> flies solidly past top-right */}
        <div className="absolute top-[16px] left-1/2 -ml-[91.5px] w-[183px] h-[103px] will-change-transform mirato-card-enter-mid">
          <div className="w-full h-full will-change-transform mirato-card-float-mid" style={floatPlayState}>
            <div
              className="w-full h-full rounded-[15px] border border-amber-100/45 will-change-transform"
              style={{
                background: 'linear-gradient(145deg, #FEDF6E 0%, #F5C000 100%)',
                boxShadow: '0 14px 36px rgba(0, 0, 0, 0.38), 0 0 22px rgba(245, 192, 0, 0.18)',
                transition: isRevealing
                  ? 'transform 1250ms cubic-bezier(0.22, 0.61, 0.36, 1)'
                  : 'transform 190ms cubic-bezier(0.34, 1.4, 0.64, 1)',
                transform: isRevealing
                  ? 'translate3d(88vw, -80vh, 0) rotate(24deg) scale(0.84)'
                  : isClicking
                    ? 'translate3d(0, 5px, 0) scale(0.93)'
                    : 'translate3d(0, 0, 0) scale(1)',
              }}
            />
          </div>
        </div>

        {/* Card 1 — Front Card (#FFE897, 220x124) with Red LIVE Dot -> flies solidly past bottom-left */}
        <div className="absolute top-[40px] left-1/2 -ml-[110px] w-[220px] h-[124px] will-change-transform mirato-card-enter-front">
          <div className="w-full h-full will-change-transform mirato-card-float-front" style={floatPlayState}>
            <div
              className="relative w-full h-full rounded-[18px] border border-amber-50/55 will-change-transform"
              style={{
                background: 'linear-gradient(150deg, #FFF3C7 0%, #FFE897 48%, #FAD45B 100%)',
                boxShadow: '0 22px 48px rgba(0, 0, 0, 0.52), 0 0 32px rgba(255, 232, 151, 0.22)',
                transition: isRevealing
                  ? 'transform 1250ms cubic-bezier(0.22, 0.61, 0.36, 1)'
                  : 'transform 180ms cubic-bezier(0.34, 1.4, 0.64, 1)',
                transform: isRevealing
                  ? 'translate3d(-86vw, 82vh, 0) rotate(-20deg) scale(0.86)'
                  : isClicking
                    ? 'translate3d(0, 6px, 0) scale(0.91)'
                    : 'translate3d(0, 0, 0) scale(1)',
              }}
            >
              {/* Subtle top specular rim */}
              <div
                className="absolute inset-x-3 top-1.5 h-[1px] rounded-full opacity-70"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.85), transparent)',
                }}
              />

              {/* Signature Mirato Red LIVE Dot */}
              <div className="absolute top-[15px] right-[15px] w-[14px] h-[14px] rounded-full bg-[#E10307] shadow-[0_0_12px_rgba(225,3,7,0.75)]">
                <span className="absolute inset-0 rounded-full bg-[#E10307] animate-ping opacity-40" />
              </div>
            </div>
          </div>
        </div>

        {/* Animated macOS-style Pointer Cursor -> single smooth curved arc straight to center, presses, flies past bottom-right */}
        {showCursor && (
          <div className="absolute left-1/2 top-[62%] z-30 pointer-events-none will-change-transform mirato-cursor-enter-x">
            <div className="will-change-transform mirato-cursor-enter-y">
              <div
                className="will-change-transform"
                style={{
                  transition: isRevealing
                    ? 'transform 1250ms cubic-bezier(0.22, 0.61, 0.36, 1)'
                    : 'transform 180ms cubic-bezier(0.34, 1.4, 0.64, 1)',
                  transform: isRevealing
                    ? 'translate3d(85vw, 80vh, 0) rotate(24deg) scale(0.88)'
                    : isClicking
                      ? 'translate3d(-2px, 4px, 0) rotate(-6deg) scale(0.85)'
                      : 'translate3d(0, 0, 0) rotate(0deg) scale(1)',
                }}
              >
                <svg
                  width="30"
                  height="34"
                  viewBox="0 0 28 32"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="drop-shadow-[0_6px_14px_rgba(0,0,0,0.65)]"
                >
                  <path
                    d="M3.2 2.2L24.2 15.8C25.2 16.45 24.9 18 23.7 18.2L15.1 19.6L11.4 27.6C10.9 28.7 9.3 28.5 9.1 27.3L2.2 3.5C2 2.5 2.4 1.7 3.2 2.2Z"
                    fill="#FFFFFF"
                    stroke="#0C0A09"
                    strokeWidth="2.1"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sculpted Warm-Gold Capsule Loading Indicator + Lighthearted Companion Text */}
      <div className="relative z-10 mt-9 flex flex-col items-center gap-3.5 will-change-transform mirato-loader-enter">
        <div
          className="flex flex-col items-center gap-3.5 will-change-transform"
          style={{
            transition: 'transform 1150ms cubic-bezier(0.22, 0.61, 0.36, 1)',
            transform: isRevealing ? 'translate3d(0, 62vh, 0) scale(0.92)' : 'translate3d(0, 0, 0) scale(1)',
          }}
        >
          <div
            className="w-[200px] h-[12px] rounded-full p-[2.5px] bg-[#1c1917]/95 border border-amber-200/15"
            style={{
              boxShadow:
                'inset 0 2px 5px rgba(0, 0, 0, 0.72), 0 1px 0 rgba(255, 232, 151, 0.08), 0 10px 28px rgba(0, 0, 0, 0.45)',
            }}
          >
            <div
              className="relative h-full rounded-full overflow-hidden transition-[width] duration-300 ease-out"
              style={{
                width: `${displayProgress}%`,
                background: 'linear-gradient(90deg, #D99B00 0%, #FFD94D 52%, #FFF3C7 100%)',
                boxShadow: '0 0 14px rgba(255, 217, 77, 0.45)',
              }}
            >
              {/* Top specular highlight for liquid-gold depth */}
              <div
                className="absolute inset-x-1 top-[1px] h-[2px] rounded-full opacity-75"
                style={{
                  background: 'linear-gradient(90deg, rgba(255,255,255,0.25), rgba(255,255,255,0.9), rgba(255,255,255,0.25))',
                }}
              />
              {/* Travelling warm sheen */}
              <div
                className="absolute inset-y-0 w-1/2 pointer-events-none mirato-loader-shimmer"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)',
                }}
              />
            </div>
          </div>

          {/* Warm lighthearted companion text */}
          <p className="text-[13px] font-medium text-stone-400/90 tracking-normal text-center px-4">
            {currentLine}
          </p>
        </div>
      </div>
    </div>
  );
};
