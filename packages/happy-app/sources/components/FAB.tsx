import { Ionicons } from '@expo/vector-icons';
import * as React from 'react';
import { Platform, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { MobileGlassSurface } from './MobileGlass';

const stylesheet = StyleSheet.create((theme, runtime) => ({
    container: {
        position: 'absolute',
        right: theme.margins.lg,
    },
    button: {
        borderRadius: theme.borderRadius.xxxl,
        width: theme.minTouchTarget + 12,
        height: theme.minTouchTarget + 12,
        overflow: 'visible',
    },
    buttonDefault: {
        backgroundColor: 'transparent',
    },
    buttonPressed: {
        backgroundColor: 'transparent',
        opacity: 0.72,
        transform: [{ scale: 0.97 }],
    },
    glass: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.borderRadius.xxxl,
        overflow: 'hidden',
        backgroundColor: Platform.select({ android: theme.colors.glass.backgroundStrong, default: 'transparent' }),
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.glass.border,
        shadowColor: theme.colors.glass.shadow,
        shadowOffset: { width: 0, height: theme.colors.glass.elevation.offset },
        shadowOpacity: Platform.select({ web: 0, default: 1 }),
        shadowRadius: 18,
        elevation: Platform.select({ android: 8, default: 0 }),
    },
    accentTint: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: theme.colors.fab.background,
        opacity: 0.68,
    },
}));

export const FAB = React.memo(({ onPress }: { onPress: () => void }) => {
    const { theme } = useUnistyles();
    const styles = stylesheet;
    const safeArea = useSafeAreaInsets();
    return (
        <View
            style={[
                styles.container,
                { bottom: safeArea.bottom + theme.margins.lg }
            ]}
        >
            <Pressable
                style={({ pressed }) => [
                    styles.button,
                    pressed ? styles.buttonPressed : styles.buttonDefault
                ]}
                onPress={onPress}
            >
                <MobileGlassSurface interactive intensity={76} style={styles.glass}>
                    {/* The one primary action on the screen is the only thing
                        allowed colour here, and the icon needs the tint to stay
                        legible over whatever the glass is blurring. */}
                    <View pointerEvents="none" style={styles.accentTint} />
                    <Ionicons name="add" size={24} color={theme.colors.fab.icon} />
                </MobileGlassSurface>
            </Pressable>
        </View>
    )
});
