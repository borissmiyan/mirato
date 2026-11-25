import { useState, useRef, useEffect } from 'react';
import { ICanvasSlide, ISlide, IVideoSlide } from '@/core/types';
import { normalizeTransitionType } from '../components/display/transitions/SlideTransitions';

export interface PrevSlideState {
  key: string;
  content: React.ReactNode;
  /** True when the visual transition is 'none', but prev slide stays mounted briefly for video audio fade-out */
  isAudioFadeOutOnly?: boolean;
  /** Minimum keep-alive duration in ms (used for video audio fade-out) */
  keepAliveMs?: number;
}

export interface UseSlideTransitionManagerReturn {
  prevSlideState: PrevSlideState | null;
  isTransitioning: boolean;
  prevContentRef: React.MutableRefObject<React.ReactNode>;
}

const DEFAULT_VIDEO_EXIT_FADE_MS = 400;

/**
 * Hook to manage slide transition lifecycle, caching previous slide state,
 * and keeping exiting projector video slides mounted long enough for smooth audio fade-out.
 */
export function useSlideTransitionManager(
  currentKey: string,
  selectedSlide: ISlide | null | undefined,
  lastTransitionTrigger: number,
  isProjector = false
): UseSlideTransitionManagerReturn {
  const currentKeyRef = useRef(currentKey);
  const prevSlideObjRef = useRef<ISlide | null | undefined>(selectedSlide);
  const prevContentRef = useRef<React.ReactNode>(null);
  const [prevSlideState, setPrevSlideState] = useState<PrevSlideState | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Synchronous phase: detect slide change and cache previous
  if (currentKey !== currentKeyRef.current) {
    const transition = (selectedSlide as ICanvasSlide)?.transition || { type: 'none', duration: 0.5 };
    const type = normalizeTransitionType(transition.type);
    const duration = transition.duration ?? 0.5;
    const hasVisualTransition = type !== 'none' && duration > 0;

    // Check if the exiting slide is a projector video that needs smooth audio fade-out
    const prevSlide = prevSlideObjRef.current;
    const prevVideoSettings = prevSlide?.type === 'video' ? (prevSlide as IVideoSlide).videoSettings : undefined;
    const needsVideoAudioFadeOut = Boolean(
      isProjector &&
      prevVideoSettings &&
      !prevVideoSettings.muted &&
      (prevVideoSettings.volume ?? 1) > 0
    );
    const videoFadeOutMs = needsVideoAudioFadeOut
      ? Math.max(100, (prevVideoSettings?.fadeOutSeconds || DEFAULT_VIDEO_EXIT_FADE_MS / 1000) * 1000)
      : 0;

    if (!hasVisualTransition && !needsVideoAudioFadeOut) {
      setPrevSlideState(null);
    } else {
      setPrevSlideState({
        key: currentKeyRef.current,
        content: prevContentRef.current,
        isAudioFadeOutOnly: !hasVisualTransition && needsVideoAudioFadeOut,
        keepAliveMs: videoFadeOutMs,
      });
    }

    currentKeyRef.current = currentKey;
    prevSlideObjRef.current = selectedSlide;

    // Checkerboard and Comic dots need isTransitioning flag for specialized rendering
    if ((type === 'checkerboard' || type === 'comic-dots') && duration > 0) {
      setIsTransitioning(true);
    } else {
      setIsTransitioning(false);
    }
  } else {
    prevSlideObjRef.current = selectedSlide;
  }

  const currentTransition = (selectedSlide as ICanvasSlide)?.transition;
  const prevSlideKey = prevSlideState?.key;
  const prevKeepAliveMs = prevSlideState?.keepAliveMs || 0;

  // Handle cleanup of previous slide state after transition & video fade-out duration
  useEffect(() => {
    if (prevSlideState) {
      const transition = currentTransition || { type: 'none', duration: 0.5 };
      const duration = transition.duration ?? 0.5;
      const visualMs = (transition.type === 'none' || duration === 0) ? 0 : duration * 1000 + 200;
      const totalMs = Math.max(visualMs, prevKeepAliveMs + 100);

      if (totalMs <= 0) {
        setPrevSlideState(null);
        return;
      }

      const dur = Math.max(totalMs, 100);
      const timer = setTimeout(() => {
        setPrevSlideState(curr => curr?.key === prevSlideKey ? null : curr);
      }, dur);
      return () => clearTimeout(timer);
    }
  }, [prevSlideState, prevSlideKey, prevKeepAliveMs, currentTransition]);

  // Handle complex transition timeout (checkerboard/comic-dots)
  useEffect(() => {
    if (isTransitioning && selectedSlide) {
      const transition = currentTransition || { type: 'none', duration: 0.5 };
      const duration = transition.duration ?? 0.5;
      if (transition.type === 'none' || duration === 0) {
        setIsTransitioning(false);
        return;
      }
      const timeout = Math.max(duration * 1000 + 50, 100);
      const timer = setTimeout(() => setIsTransitioning(false), timeout);
      return () => clearTimeout(timer);
    }
  }, [isTransitioning, selectedSlide, currentTransition, lastTransitionTrigger]);

  return {
    prevSlideState,
    isTransitioning,
    prevContentRef
  };
}
