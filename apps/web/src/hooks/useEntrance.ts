import type { RefObject } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

/** Short, scoped entrances. Text/version changes are deliberately not dependencies. */
export function useEntrance(scope: RefObject<HTMLElement | null>, selector: string | null = null, dependencies: unknown[] = []) {
  useGSAP(() => {
    if (!scope.current || typeof window.matchMedia !== 'function') return;
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const root = scope.current;
      if (!root) return;
      const targets = selector ? [...root.querySelectorAll<HTMLElement>(selector)].filter(element => {
        const bounds = element.getBoundingClientRect();
        return bounds.top < window.innerHeight && bounds.bottom >= 0;
      }).slice(0, 18) : [root];
      if (!targets.length) return;
      gsap.fromTo(targets, { y: 10, opacity: 0.65 }, {
        y: 0, opacity: 1, duration: 0.28, ease: 'power2.out',
        stagger: targets.length > 1 ? { amount: 0.16 } : 0,
        overwrite: 'auto', clearProps: 'transform,opacity',
      });
    }, scope);
    return () => media.revert();
  }, { scope, dependencies, revertOnUpdate: true });
}
