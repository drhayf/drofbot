/**
 * Animation utilities — timing constants, easing curves, transition helpers.
 * "Quiet Intelligence" means: fast, functional, restrained. No bounce, no drama.
 */

/** Timing constants (ms) */
export const TIMING = {
  /** Hover states, border shifts */
  fast: 150,
  /** Nav indicator, crossfades */
  normal: 200,
  /** Gauge fill, XP bar animations on mount */
  gauge: 400,
  /** Mandala segment stagger per item */
  stagger: 50,
  /** Toast auto-dismiss */
  toastDismiss: 3000,
  /** Page crossfade */
  pageFade: 150,
} as const;

/** Easing curves */
export const EASING = {
  /** Default for most transitions */
  default: "cubic-bezier(0.4, 0, 0.2, 1)",
  /** Gauge animations — single ease-out, no bounce */
  easeOut: "cubic-bezier(0, 0, 0.2, 1)",
  /** Entering elements */
  easeIn: "cubic-bezier(0.4, 0, 1, 1)",
} as const;

/**
 * Generate inline transition style for gauge-type animations.
 * Used by viz components that animate from 0 → value on mount.
 */
export function gaugeTransition(property = "all"): React.CSSProperties {
  return {
    transition: `${property} ${TIMING.gauge}ms ${EASING.easeOut}`,
  };
}

/**
 * Generate staggered delay for a list of items.
 * @param index — item index in the list
 * @param baseDelay — additional base delay before stagger starts (ms)
 */
export function staggerDelay(index: number, baseDelay = 0): React.CSSProperties {
  return {
    animationDelay: `${baseDelay + index * TIMING.stagger}ms`,
  };
}

/**
 * CSS class helpers for common transition patterns.
 */
export const transitionClasses = {
  /** Card hover border shift */
  cardHover: "transition-all duration-fast hover:border-accent/30 hover:shadow-card-hover",
  /** Nav indicator smooth slide */
  navIndicator: "transition-all duration-normal",
  /** Page crossfade */
  pageFade: "animate-fade-in",
  /** Toast slide-in */
  toastEnter: "animate-toast-in",
  /** Toast slide-out */
  toastExit: "animate-toast-out",
} as const;
