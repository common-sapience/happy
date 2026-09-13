import type { KitSurfaceRole } from './kitSurface';

export type KitMessageAuthor = 'user' | 'agent' | 'event';

export type KitMessageRowPresentation = {
    align: 'flex-start' | 'flex-end' | 'center';
    /** Only the user's own message is boxed; a reply is flat on the page. */
    bubble: boolean;
    surfaceRole: KitSurfaceRole;
    maxWidthRatio: number;
    emphasis: 'normal' | 'muted';
};

const USER_BUBBLE_MAX_WIDTH_RATIO = 0.82;

export function resolveKitMessageRowPresentation(author: KitMessageAuthor): KitMessageRowPresentation {
    if (author === 'user') {
        return {
            align: 'flex-end',
            bubble: true,
            surfaceRole: 'content',
            maxWidthRatio: USER_BUBBLE_MAX_WIDTH_RATIO,
            emphasis: 'normal',
        };
    }
    if (author === 'event') {
        return {
            align: 'center',
            bubble: false,
            surfaceRole: 'content',
            maxWidthRatio: 1,
            emphasis: 'muted',
        };
    }
    return {
        align: 'flex-start',
        bubble: false,
        surfaceRole: 'content',
        maxWidthRatio: 1,
        emphasis: 'normal',
    };
}

export function resolveKitMessageRowMaxWidth(containerWidth: number, ratio: number): number {
    if (!Number.isFinite(containerWidth) || containerWidth <= 0) {
        return 0;
    }
    const bounded = Math.min(Math.max(ratio, 0), 1);
    return Math.floor(containerWidth * bounded);
}
