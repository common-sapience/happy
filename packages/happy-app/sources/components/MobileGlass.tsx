import * as React from 'react';
import { Platform, StyleProp, StyleSheet as RNStyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, type GlassStyle } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { useUnistyles } from 'react-native-unistyles';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { getNativeGlassInteractivity } from './glassInteractionPolicy';
import {
    resolveConcentricRadius,
    resolveWebGlassSurface,
    supportsBackdropFilter,
    useGlassAccessibilityPreferences,
    type GlassMaterial,
} from './glassWebMaterial';

type MobileGlassMaterial = GlassMaterial;

type MobileGlassSurfaceProps = ViewProps & {
    enabled?: boolean;
    intensity?: number;
    interactive?: boolean;
    nativeEffect?: boolean;
    material?: MobileGlassMaterial;
    glassEffectStyle?: GlassStyle;
    tintColor?: string;
    style?: StyleProp<ViewStyle>;
};

const AnimatedGlassView = Animated.createAnimatedComponent(GlassView);
const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

// Header chrome is the only consumer of the static material. Letting more blur
// through, and painting less flat tint over it, is what makes these controls
// read as glass rather than as filled circles.
const STATIC_MATERIAL_BLUR_CAP = 44;

/**
 * Performance-aware material surface. Interactive controls and explicit
 * `nativeEffect` surfaces use Liquid Glass/material blur; `material="static"`
 * opts into a calm, non-refractive blur without the Liquid Glass highlight.
 * `material="frosted"` adds a denser tint and blur for writing surfaces where
 * background content must not compete with the foreground text.
 * Content surfaces remain opaque so glass stays a distinct functional layer.
 */
export function MobileGlassSurface(props: MobileGlassSurfaceProps) {
    // Scaling a native static GlassView during a press or native-stack push
    // produces a large refractive blob on iOS 26. Static chrome uses stable
    // material blur and lets its surrounding Pressable own the interaction.
    // The web backend never takes this path: the press bubble is a native
    // material animation, and on desktop the Pressable already owns feedback.
    if (props.interactive && props.material !== 'static' && Platform.OS !== 'web') {
        return <InteractiveMobileGlassSurface {...props} />;
    }
    return <MobileGlassSurfaceBase {...props} />;
}

/**
 * The web/desktop backend (T-18): CSS `backdrop-filter` for the blur and the
 * saturation lift, glass tokens for the tint, hairline and shadow, and an inner
 * sheen so foreground text keeps its contrast over whatever scrolls underneath.
 *
 * Material styles are applied after the caller's style on purpose. Geometry —
 * size, radius, padding — belongs to the call site; the material belongs here,
 * and most call sites still carry a `Platform.select({ web: … })` background
 * from the years this backend did not exist.
 */
function WebGlassSurface({
    nativeEffect,
    material,
    style,
    animated,
    children,
    ...props
}: ViewProps & {
    nativeEffect: boolean;
    material: MobileGlassMaterial;
    animated: boolean;
    style?: StyleProp<ViewStyle>;
}) {
    const { theme } = useUnistyles();
    const preferences = useGlassAccessibilityPreferences();
    const Container = animated ? Animated.View : View;

    // Glass is a functional layer: navigation, toolbars, floating panels and
    // control-bearing cards. Content surfaces stay opaque.
    if (!nativeEffect) {
        return (
            <Container {...props} style={[{ backgroundColor: theme.colors.surface }, style]}>
                {children}
            </Container>
        );
    }

    const surface = resolveWebGlassSurface({
        material,
        tokens: theme.colors.glass,
        preferences,
        opaqueBorderColor: theme.colors.divider,
        supportsBackdropFilter: supportsBackdropFilter(),
    });
    const flattened = RNStyleSheet.flatten(style) ?? {};
    const outerRadius = typeof flattened.borderRadius === 'number' ? flattened.borderRadius : 0;
    const sheenRadius = resolveConcentricRadius(outerRadius, surface.borderWidth);

    return (
        <Container
            {...props}
            // Merged, not replaced: callers put their own data attributes here,
            // the Tauri drag-region opt-out among them. The material's own
            // attribute is what an end-to-end test asserts a glass layer by.
            {...({
                dataSet: {
                    ...((props as { dataSet?: Record<string, unknown> }).dataSet ?? {}),
                    happyGlass: material,
                },
            } as object)}
            style={[
                style,
                {
                    backgroundColor: surface.backgroundColor,
                    borderWidth: surface.borderWidth,
                    borderColor: surface.borderColor,
                    borderStyle: 'solid',
                },
                surface.backdropFilter
                    ? {
                        backdropFilter: surface.backdropFilter,
                        WebkitBackdropFilter: surface.backdropFilter,
                    }
                    : null,
                { boxShadow: surface.boxShadow },
            ] as StyleProp<ViewStyle>}
        >
            {surface.sheen && (
                <LinearGradient
                    pointerEvents="none"
                    colors={surface.sheen}
                    locations={[0, 0.48, 1]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[RNStyleSheet.absoluteFill, { borderRadius: sheenRadius }]}
                />
            )}
            {children}
        </Container>
    );
}

function InteractiveMobileGlassSurface({
    onTouchStart,
    onTouchEnd,
    onTouchCancel,
    style,
    ...props
}: MobileGlassSurfaceProps) {
    const pressScale = useSharedValue(1);
    const bubbleStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pressScale.value }],
    }));
    const releaseBubble = React.useCallback(() => {
        pressScale.value = withSpring(1, {
            damping: 14,
            stiffness: 520,
            mass: 0.4,
            overshootClamping: false,
        });
    }, [pressScale]);
    const handleTouchStart = React.useCallback<NonNullable<ViewProps['onTouchStart']>>((event) => {
        pressScale.value = withTiming(1.035, {
            duration: 65,
            easing: Easing.out(Easing.quad),
        });
        onTouchStart?.(event);
    }, [onTouchStart, pressScale]);
    const handleTouchEnd = React.useCallback<NonNullable<ViewProps['onTouchEnd']>>((event) => {
        releaseBubble();
        onTouchEnd?.(event);
    }, [onTouchEnd, releaseBubble]);
    const handleTouchCancel = React.useCallback<NonNullable<ViewProps['onTouchCancel']>>((event) => {
        releaseBubble();
        onTouchCancel?.(event);
    }, [onTouchCancel, releaseBubble]);

    return (
        <MobileGlassSurfaceBase
            {...props}
            interactive
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchCancel}
            style={[style, bubbleStyle]}
            animated
        />
    );
}

function MobileGlassSurfaceBase({
    enabled = true,
    intensity = 72,
    interactive = false,
    nativeEffect = interactive,
    material = 'liquid',
    glassEffectStyle = 'clear',
    tintColor,
    style,
    children,
    animated = false,
    ...props
}: MobileGlassSurfaceProps & { animated?: boolean }) {
    const { theme } = useUnistyles();
    const usesStaticMaterial = nativeEffect && material === 'static';
    const usesFrostedMaterial = nativeEffect && material === 'frosted';

    if (!enabled) {
        return animated ? (
            <Animated.View
                {...props}
                style={style}
            >
                {children}
            </Animated.View>
        ) : (
            <View {...props} style={style}>{children}</View>
        );
    }

    // Web covers the desktop shell too: Tauri reports Platform.OS === 'web'.
    if (Platform.OS === 'web') {
        return (
            <WebGlassSurface
                {...props}
                nativeEffect={nativeEffect}
                material={material}
                style={style}
                animated={animated}
            >
                {children}
            </WebGlassSurface>
        );
    }

    // Liquid Glass is navigation chrome, not a general card background. Keeping
    // content opaque also avoids compositing dozens of translucent layers.
    if (!nativeEffect) {
        return animated ? (
            <Animated.View
                {...props}
                style={[{ backgroundColor: theme.colors.surface }, style]}
            >
                {children}
            </Animated.View>
        ) : (
            <View {...props} style={[{ backgroundColor: theme.colors.surface }, style]}>
                {children}
            </View>
        );
    }

    const surfaceOverlay = usesStaticMaterial || usesFrostedMaterial ? (
        <View
            pointerEvents="none"
            style={[
                RNStyleSheet.absoluteFill,
                {
                    backgroundColor: theme.dark
                        ? usesFrostedMaterial ? 'rgba(20, 20, 22, 0.82)' : 'rgba(44, 44, 47, 0.40)'
                        : usesFrostedMaterial ? 'rgba(255, 255, 255, 0.82)' : 'rgba(0, 0, 0, 0.024)',
                    borderRadius: usesStaticMaterial ? 999 : undefined,
                },
            ]}
        />
    ) : (
        <LinearGradient
            pointerEvents="none"
            colors={theme.dark
                ? ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.018)', 'rgba(255,255,255,0.055)']
                : ['rgba(255,255,255,0.76)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0.42)']}
            locations={[0, 0.48, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={RNStyleSheet.absoluteFill}
        />
    );

    // Header controls need two separate layers: an unclipped shell for the
    // material shadow, and a clipped glass view for the live backdrop. Putting
    // both jobs on one `overflow: hidden` view is why the old controls looked
    // flat even though they technically contained a blur.
    if (Platform.OS === 'ios' && usesStaticMaterial) {
        const staticMaterial = (
            <BlurView
                pointerEvents="none"
                intensity={Math.min(intensity, STATIC_MATERIAL_BLUR_CAP)}
                tint={theme.dark ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'}
                style={styles.staticMaterialClip}
            >
                {surfaceOverlay}
            </BlurView>
        );

        return animated ? (
            <Animated.View {...props} style={[style, styles.staticMaterialShell]}>
                {staticMaterial}
                {children}
            </Animated.View>
        ) : (
            <View {...props} style={[style, styles.staticMaterialShell]}>
                {staticMaterial}
                {children}
            </View>
        );
    }

    if (Platform.OS === 'ios' && isGlassEffectAPIAvailable() && material === 'liquid') {
        return animated ? (
            <AnimatedGlassView
                {...props}
                glassEffectStyle={glassEffectStyle}
                colorScheme={theme.dark ? 'dark' : 'light'}
                tintColor={tintColor ?? theme.colors.glass.tint}
                isInteractive={getNativeGlassInteractivity(interactive)}
                style={style}
            >
                {surfaceOverlay}
                {children}
            </AnimatedGlassView>
        ) : (
            <GlassView
                {...props}
                glassEffectStyle={glassEffectStyle}
                colorScheme={theme.dark ? 'dark' : 'light'}
                tintColor={tintColor ?? theme.colors.glass.tint}
                isInteractive={getNativeGlassInteractivity(interactive)}
                style={style}
            >
                {surfaceOverlay}
                {children}
            </GlassView>
        );
    }

    if (Platform.OS === 'ios') {
        return animated ? (
            <AnimatedBlurView
                {...props}
                intensity={Math.min(intensity, usesFrostedMaterial ? 42 : usesStaticMaterial ? STATIC_MATERIAL_BLUR_CAP : 36)}
                tint={theme.dark ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'}
                style={style}
            >
                {surfaceOverlay}
                {children}
            </AnimatedBlurView>
        ) : (
            <BlurView
                {...props}
                intensity={Math.min(intensity, usesFrostedMaterial ? 42 : usesStaticMaterial ? STATIC_MATERIAL_BLUR_CAP : 36)}
                tint={theme.dark ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'}
                style={style}
            >
                {surfaceOverlay}
                {children}
            </BlurView>
        );
    }

    return animated ? (
        <Animated.View
            {...props}
            style={[{ backgroundColor: theme.colors.glass.background }, style]}
        >
            {surfaceOverlay}
            {children}
        </Animated.View>
    ) : (
        <View
            {...props}
            style={[{ backgroundColor: theme.colors.glass.background }, style]}
        >
            {surfaceOverlay}
            {children}
        </View>
    );
}

export function MobileGlassBackdrop({ enabled = true }: { enabled?: boolean }) {
    const { theme } = useUnistyles();

    if (!enabled) {
        return null;
    }

    return (
        // Clipped: the two glows below are drawn outside their own edges on purpose,
        // and without this they extend the page and make it scroll sideways.
        <View pointerEvents="none" style={[RNStyleSheet.absoluteFill, styles.backdropClip]}>
            <LinearGradient
                colors={theme.colors.glass.backdrop}
                locations={[0, 0.52, 1]}
                start={{ x: 0.05, y: 0 }}
                end={{ x: 0.95, y: 1 }}
                style={RNStyleSheet.absoluteFill}
            />
            <View
                style={[
                    styles.glow,
                    styles.primaryGlow,
                    { backgroundColor: theme.colors.glass.glowPrimary },
                ]}
            />
            <View
                style={[
                    styles.glow,
                    styles.secondaryGlow,
                    { backgroundColor: theme.colors.glass.glowSecondary },
                ]}
            />
        </View>
    );
}

const styles = RNStyleSheet.create({
    staticMaterialShell: {
        overflow: 'visible',
    },
    staticMaterialClip: {
        ...RNStyleSheet.absoluteFillObject,
        borderRadius: 999,
        overflow: 'hidden',
    },
    backdropClip: {
        overflow: 'hidden',
    },
    glow: {
        position: 'absolute',
        borderRadius: 999,
    },
    primaryGlow: {
        width: 280,
        height: 280,
        top: -96,
        right: -116,
    },
    secondaryGlow: {
        width: 320,
        height: 320,
        bottom: -148,
        left: -156,
    },
});
