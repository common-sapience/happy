import * as React from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Typography } from '@/constants/Typography';
import { KitSurface } from './KitSurface';
import { resolveKitButtonAppearance } from './kitButton';

const stylesheet = StyleSheet.create((theme) => ({
    capsule: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.margins.sm,
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.glass.border,
        paddingHorizontal: theme.margins.lg,
    },
    fill: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.72,
    },
    label: {
        ...Typography.default('semiBold'),
        fontSize: theme.typography.body.fontSize,
        lineHeight: theme.typography.body.lineHeight,
    },
}));

const HEIGHT = 40;

export type NewAgentButtonProps = {
    title: string;
    onPress: () => void;
    style?: StyleProp<ViewStyle>;
};

/**
 * The only creation control in the product, and the one filled capsule of the
 * list: a plus, a word, and nothing else competing with it.
 */
export const NewAgentButton = React.memo(function NewAgentButton({ title, onPress, style }: NewAgentButtonProps) {
    const { theme } = useUnistyles();
    const styles = stylesheet;
    const appearance = resolveKitButtonAppearance({
        variant: 'primary',
        tokens: {
            primaryBackground: theme.colors.button.primary.background,
            primaryTint: theme.colors.button.primary.tint,
            primaryDisabled: theme.colors.button.primary.disabled,
            secondaryTint: theme.colors.button.secondary.tint,
            destructiveTint: theme.colors.textDestructive,
        },
    });

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={title}
            onPress={onPress}
            style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }, style]}
        >
            <KitSurface
                surface={appearance.surfaceRole}
                style={[styles.capsule, { height: HEIGHT, borderRadius: HEIGHT / 2 }]}
            >
                <View pointerEvents="none" style={[styles.fill, { backgroundColor: appearance.backgroundColor }]} />
                <Ionicons name="add" size={theme.iconSize.large} color={appearance.textColor} />
                <Text numberOfLines={1} style={[styles.label, { color: appearance.textColor }]}>{title}</Text>
            </KitSurface>
        </Pressable>
    );
});
