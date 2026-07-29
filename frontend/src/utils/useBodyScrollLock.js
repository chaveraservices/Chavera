import { useLayoutEffect } from 'react';

// Nested locks (detail modal → confirm modal) must not each restore the page
// independently, or the first to close unlocks while another is still open.
let lockCount = 0;

/**
 * Freezes the page behind a modal while it is open.
 *
 * Without this the wheel keeps scrolling the page under the overlay, which is
 * what makes modal scrolling feel wrong: you scroll the list, reach its end,
 * and the whole page lurches instead of simply stopping.
 *
 * Note this app scrolls inside `.main-content`, not on <body> — the shell is
 * `height: 100vh; overflow: hidden`. Locking only <body> would do nothing, so
 * a class on <html> drives CSS that freezes the real scroll container. The
 * body is locked too, for any page that does scroll normally.
 */
export default function useBodyScrollLock(active) {
  useLayoutEffect(() => {
    if (!active) return;

    if (lockCount === 0) {
      // Removing the scrollbar changes layout width; add it back as padding
      // so the page doesn't visibly jump sideways as the modal opens.
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) {
        document.documentElement.style.setProperty('--scrollbar-compensation', `${scrollbarWidth}px`);
      }
      document.documentElement.classList.add('modal-open');
    }
    lockCount += 1;

    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        document.documentElement.classList.remove('modal-open');
        document.documentElement.style.removeProperty('--scrollbar-compensation');
      }
    };
  }, [active]);
}
