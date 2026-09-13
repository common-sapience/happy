import * as React from 'react';
import { ActivityIndicator, Pressable, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Typography } from '@/constants/Typography';
import { KitSurface } from './KitSurface';
import { resolveKitButtonAppearance, type KitButtonTokens, type KitButtonVariant } from './kitButton';

export type KitButtonSize = 'regular' | 'compact';

export type KitButtonProps = {
    title: string;
    onPress?: () => void;
    disabled?: boolean;
    loading?: boolean;
    size?: KitButtonSize;
    accessibilityHint?: string;
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
};

const heights: Record<KitButtonSize, number> = {
    regular: 48,
    compact: 36,
};

const stylesheet = StyleSheet.create((theme) => ({
    pressable: {
        alignSelf: 'stretch',
        justifyContent: 'center',
        minHeight: theme.minTouchTarget,
    },
    capsule: {
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.glass.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    plain: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    fill: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.72,
    },
    label: {
        ...Typography.default('semiBold'),
        fontSize: theme.typography.subtitle.fontSize,
        lineHeight: theme.typography.subtitle.lineHeight,
        paddingHorizontal: theme.margins.xl,
        textAlign: 'center',
    },
    loading: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
}));

function useKitButtonTokens(): KitButtonTokens {
    const { theme } = useUnistyles();
    return {
        primaryBackground: theme.colors.button.primary.background,
        primaryTint: theme.colors.button.primary.tint,
        primaryDisabled: theme.colors.button.primary.disabled,
        secondaryTint: theme.colors.button.secondary.tint,
        destructiveTint: theme.colors.textDestructive,
    };
}

function KitButton({
    variant,
    confirming,
    title,
    onPress,
    disabled = false,
    loading = false,
    size = 'regular',
    accessibilityHint,
    style,
    textStyle,
}: KitButtonProps & { variant: KitButtonVariant; confirming?: boolean }) {
    const styles = stylesheet;
    const tokens = useKitButtonTokens();
    const appearance = resolveKitButtonAppearance({ variant, tokens, disabled, confirming });
    const height = heights[size];

    const label = (
        <Text
            numberOfLines={1}
            style={[styles.label, { color: appearance.textColor, opacity: loading ? 0 : 1 }, textStyle]}
        >
            {title}
        </Text>
    );

    const content = (
        <>
            {appearance.filled && (
                <View pointerEvents="none" style={[styles.fill, { backgroundColor: appearance.backgroundColor }]} />
            )}
            {label}
            {loading && (
                <View style={styles.loading}>
                    <ActivityIndicator size="small" color={appearance.textColor} />
                </View>
            )}
        </>
    );

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={title}
            accessibilityHint={accessibilityHint}
            accessibilityState={{ disabled: disabled || loading, busy: loading }}
            disabled={disabled || loading}
            onPress={onPress}
            style={({ pressed }) => [
                styles.pressable,
                { opacity: appearance.opacity * (pressed ? 0.9 : 1) },
                style,
            ]}
        >
            <KitSurface
                surface={appearance.surfaceRole}
                style={[
                    appearance.filled ? styles.capsule : styles.plain,
                    { height, borderRadius: height / 2 },
                ]}
            >
                {content}
            </KitSurface>
        </Pressable>
    );
}

export const PrimaryButton = React.memo(function PrimaryButton(props: KitButtonProps) {
    return <KitButton {...props} variant="primary" />;
});

export const SecondaryButton = React.memo(function SecondaryButton(props: KitButtonProps) {
    return <KitButton {...props} variant="secondary" />;
});

/** `confirming` is the one confirmed destructive action of a sheet; inline rows keep text. */
export const DestructiveButton = React.memo(function DestructiveButton(
    props: KitButtonProps & { confirming?: boolean },
) {
    return <KitButton {...props} variant="destructive" />;
});
