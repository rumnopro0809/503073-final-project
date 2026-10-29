import { useRef, type RefObject } from 'react';
import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(Flip, useGSAP);

export function useCardLayout(scope: RefObject<HTMLElement | null>, view: string) {
  const snapshot = useRef<ReturnType<typeof Flip.getState> | null>(null);
  const animation = useRef<gsap.core.Timeline | null>(null);
  const { contextSafe } = useGSAP(() => {
    const state = snapshot.current; snapshot.current = null;
    if (!state || !scope.current || typeof window.matchMedia !== 'function') return;
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      animation.current = Flip.from(state, {
        duration: 0.55, ease: 'power3.inOut', scale: true, nested: true,
        prune: true, stagger: 0.015,
      });
    }, scope);
    return () => { media.revert(); animation.current = null; };
  }, { scope, dependencies: [view], revertOnUpdate: true });

  return contextSafe(() => {
    snapshot.current = null;
    if (!scope.current || typeof window.matchMedia !== 'function'
      || !window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
    animation.current?.progress(1).kill();
    const targets = [...scope.current.querySelectorAll<HTMLElement>('.note-card')].filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.top < window.innerHeight && rect.bottom >= 0;
    }).slice(0,18);
    if (!targets.length) return;
    // Finish entrance tweens before measuring; each capture belongs to this workspace.
    gsap.getTweensOf(targets).forEach(tween => tween.progress(1));
    snapshot.current = Flip.getState(targets);
  });
}
