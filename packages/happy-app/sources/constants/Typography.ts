import { typography } from '@/theme';

/**
 * The two faces the product types in: the platform's UI font for everything, and
 * its monospace face for paths, commands and code.
 *
 * Apple's guidance is to use the system font and the desktop shell is a web
 * view, so no face is downloaded. The stacks are theme tokens, and emphasis
 * comes from fontWeight and fontStyle rather than a second family name.
 */
export type FontEmphasis = 'regular' | 'italic' | 'semiBold';

function emphasis(kind: FontEmphasis) {
    if (kind === 'semiBold') {
        return { fontWeight: '600' as const };
    }
    if (kind === 'italic') {
        return { fontStyle: 'italic' as const };
    }
    return {};
}

export const Typography = {
    default: (kind: FontEmphasis = 'regular') => ({
        fontFamily: typography.family.system,
        ...emphasis(kind),
    }),

    mono: (kind: FontEmphasis = 'regular') => ({
        fontFamily: typography.family.mono,
        ...emphasis(kind),
    }),
};
