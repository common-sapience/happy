import type { KitSurfaceRole } from './kitSurface';

export type KitButtonVariant = 'primary' | 'secondary' | 'destructive';

/** Exactly the theme values a button needs; no component reads colours itself. */
export type KitButtonTokens = {
    primaryBackground: string;
    primaryTint: string;
    primaryDisabled: string;
    secondaryTint: string;
    destructiveTint: string;
};

export type KitButtonAppearance = {
    filled: boolean;
    backgroundColor: string;
    textColor: string;
    surfaceRole: KitSurfaceRole;
    opacity: number;
};

export const KIT_BUTTON_DISABLED_OPACITY = 0.5;
const TRANSPARENT = 'transparent';

/**
 * One filled button per screen. The primary action is the only one that carries
 * the accent fill; a secondary action is plain text, and a destructive action is
 * text too until it becomes the single confirmed action of a sheet.
 */
export function resolveKitButtonAppearance({
    variant,
    tokens,
    disabled = false,
    confirming = false,
}: {
    variant: KitButtonVariant;
    tokens: KitButtonTokens;
    disabled?: boolean;
    confirming?: boolean;
}): KitButtonAppearance {
    const opacity = disabled ? KIT_BUTTON_DISABLED_OPACITY : 1;

    if (variant === 'primary') {
        return {
            filled: true,
            backgroundColor: disabled ? tokens.primaryDisabled : tokens.primaryBackground,
            textColor: tokens.primaryTint,
            surfaceRole: 'floating',
            opacity,
        };
    }

    if (variant === 'destructive' && confirming) {
        return {
            filled: true,
            backgroundColor: disabled ? tokens.primaryDisabled : tokens.destructiveTint,
            textColor: tokens.primaryTint,
            surfaceRole: 'floating',
            opacity,
        };
    }

    return {
        filled: false,
        backgroundColor: TRANSPARENT,
        textColor: variant === 'destructive' ? tokens.destructiveTint : tokens.secondaryTint,
        surfaceRole: 'content',
        opacity,
    };
}
