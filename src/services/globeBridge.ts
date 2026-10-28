/**
 * Lets the always-mounted listening dock (rendered by App) call into the 3D globe when it is open.
 * The globe registers its handlers on mount and clears them on unmount; the dock falls back to the
 * plain audio player when no globe is present.
 */
export interface GlobeHandlers {
  shuffle: () => void;
  navigateAyah: (surah: number, ayah: number) => void;
  navigateMehwar: (surah: number, branchIndex: number) => void;
}

class GlobeBridge {
  handlers: GlobeHandlers | null = null;

  register(h: GlobeHandlers): () => void {
    this.handlers = h;
    return () => {
      if (this.handlers === h) this.handlers = null;
    };
  }
}

export const globeBridge = new GlobeBridge();
