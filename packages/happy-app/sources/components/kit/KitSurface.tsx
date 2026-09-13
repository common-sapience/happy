import * as React from 'react';
import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { MobileGlassSurface } from '../MobileGlass';
import { resolveKitSurface, type KitSurfaceRole } from './kitSurface';

export type KitSurfaceProps = ViewProps & {
    /** Not named `role`: that is React Native's accessibility role. */
    surface: KitSurfaceRole;
    style?: StyleProp<ViewStyle>;
};

/**
 * Every kit container goes through here, so the decision "is this glass" is made
 * once from the role and never per component. Geometry stays with the caller.
 */
export const KitSurface = React.memo(function KitSurface({ surface, style, children, ...props }: KitSurfaceProps) {
    const resolved = resolveKitSurface(surface);

    if (!resolved.glass) {
        return <View {...props} style={style}>{children}</View>;
    }

    return (
        <MobileGlassSurface
            {...props}
            nativeEffect
            material={resolved.material}
            style={style}
        >
            {children}
        </MobileGlassSurface>
    );
});
