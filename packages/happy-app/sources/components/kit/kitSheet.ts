import { resolveConcentricRadius } from '../glassWebMaterial';
import type { KitSurfaceRole } from './kitSurface';

export type KitSheetGeometry = {
    width: number;
    borderRadius: number;
    /** Inner radius of anything the sheet holds: outer radius less the inset. */
    contentRadius: number;
    surfaceRole: KitSurfaceRole;
};

/**
 * A sheet is the one floating layer in the window: it takes the glass, it takes
 * the drop, and the layer underneath it is flattened by the caller. It never
 * grows past its own width, and it gives up that width before it touches the
 * window edge on a narrow window.
 */
export function resolveKitSheetGeometry({
    viewportWidth,
    maxWidth,
    margin,
    radius,
    contentInset,
}: {
    viewportWidth: number;
    maxWidth: number;
    margin: number;
    radius: number;
    contentInset: number;
}): KitSheetGeometry {
    const available = Number.isFinite(viewportWidth)
        ? Math.max(0, viewportWidth - margin * 2)
        : maxWidth;
    const width = Math.min(maxWidth, available);
    const borderRadius = Math.min(radius, Math.floor(width / 2));
    return {
        width,
        borderRadius,
        contentRadius: resolveConcentricRadius(borderRadius, contentInset),
        surfaceRole: 'floating',
    };
}
