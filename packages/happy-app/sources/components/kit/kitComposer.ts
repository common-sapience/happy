import { MOBILE_COMPOSER_METRICS } from '../agentInputLayout';
import type { KitSurfaceRole } from './kitSurface';

/**
 * The composer is one capsule that holds the text, the attach control, the mode
 * chips and the single primary action. `compact` is the phone width, `regular`
 * the desktop width; the insets are shared so the bar reads the same on both and
 * only the corner softens.
 */
export type KitComposerDensity = 'compact' | 'regular';

export type KitComposerShell = {
    borderRadius: number;
    paddingHorizontal: number;
    paddingTop: number;
    paddingBottom: number;
    minHeight: number;
    surfaceRole: KitSurfaceRole;
};

export function resolveKitComposerShell({
    density,
    regularRadius,
}: {
    density: KitComposerDensity;
    /** Desktop corner, from the theme's radius scale. */
    regularRadius: number;
}): KitComposerShell {
    return {
        borderRadius: density === 'compact' ? MOBILE_COMPOSER_METRICS.shellRadius : regularRadius,
        paddingHorizontal: MOBILE_COMPOSER_METRICS.shellInset,
        paddingTop: MOBILE_COMPOSER_METRICS.shellPaddingTop,
        paddingBottom: MOBILE_COMPOSER_METRICS.shellPaddingBottom,
        minHeight: MOBILE_COMPOSER_METRICS.inputMinHeight,
        surfaceRole: 'writing',
    };
}

export type KitComposerAction = 'send' | 'stop' | 'disabled';

export type KitComposerActionAppearance = {
    size: number;
    borderRadius: number;
    filled: boolean;
    /** An icon-only control always carries its own label for the reader. */
    accessibilityLabelRequired: true;
};

/**
 * The send control is the one filled circle in the bar. Stop takes the same
 * circle so the primary slot never moves, and a disabled composer keeps the
 * circle in place unfilled rather than removing it.
 */
export function resolveKitComposerAction(action: KitComposerAction): KitComposerActionAppearance {
    const size = MOBILE_COMPOSER_METRICS.primaryActionSize;
    return {
        size,
        borderRadius: size / 2,
        filled: action !== 'disabled',
        accessibilityLabelRequired: true,
    };
}
