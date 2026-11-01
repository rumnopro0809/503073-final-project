import type { RefObject } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

/** Short, scoped entrances. Text/version changes are deliberately not dependencies. */
export function useEntrance(scope: RefObject<HTMLElement | null>, selector: string | null = null, dependencies: unknown[] = [], panel = false) {
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
      const compact = window.innerWidth <= 720;
      const timeline = gsap.timeline({ defaults: { ease: 'power3.out', overwrite: 'auto' } });
      timeline.fromTo(targets, { x: panel ? compact ? 12 : 32 : 0, y: panel ? 12 : 24, scale: 0.975, opacity: 0.3 }, {
        x: 0, y: 0, scale: 1, opacity: 1, duration: compact ? 0.36 : 0.48,
        stagger: targets.length > 1 ? { amount: 0.24 } : 0,
        clearProps: 'transform,opacity',
      });
      if (panel) {
        const sections = root.querySelectorAll('.note-editor-heading, .note-editor-fields, .note-organization, .note-editor-footer');
        if (sections.length) timeline.fromTo(sections, { y: 12, opacity: 0.45 }, {
          y: 0, opacity: 1, duration: 0.32, stagger: 0.045, clearProps: 'transform,opacity',
        }, 0.12);
      }
    }, scope);
    return () => media.revert();
  }, { scope, dependencies, revertOnUpdate: true });
}
