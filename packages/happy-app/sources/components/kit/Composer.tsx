import * as React from 'react';
import { Pressable, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Typography } from '@/constants/Typography';
import { MOBILE_COMPOSER_METRICS } from '../agentInputLayout';
import { KitSurface } from './KitSurface';
import { resolveKitComposerAction, resolveKitComposerShell, type KitComposerAction, type KitComposerDensity } from './kitComposer';
import { resolveKitHitSlop } from './kitSurface';

const stylesheet = StyleSheet.create((theme) => ({
    shell: {
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: theme.margins.sm,
    },
    input: {
        ...Typography.default('regular'),
        flex: 1,
        color: theme.colors.input.text,
        fontSize: MOBILE_COMPOSER_METRICS.inputFontSize,
        lineHeight: MOBILE_COMPOSER_METRICS.inputLineHeight,
        minHeight: MOBILE_COMPOSER_METRICS.inputMinHeight,
        maxHeight: MOBILE_COMPOSER_METRICS.inputMaxHeight,
        paddingTop: MOBILE_COMPOSER_METRICS.inputPaddingTop,
        paddingBottom: MOBILE_COMPOSER_METRICS.inputPaddingBottom,
        outlineWidth: 0,
    },
    chipRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: theme.margins.xs,
        marginBottom: theme.margins.xs,
    },
    action: {
        alignItems: 'center',
        justifyContent: 'center',
    },
}));

export type ComposerShellProps = {
    density?: KitComposerDensity;
    style?: StyleProp<ViewStyle>;
    children: React.ReactNode;
};

/**
 * The capsule every composer sits in. Desktop and phone share the insets and the
 * material; only the corner changes with the density.
 */
export const ComposerShell = React.memo(function ComposerShell({
    density = 'regular',
    style,
    children,
}: ComposerShellProps) {
    const { theme } = useUnistyles();
    const styles = stylesheet;
    const shell = resolveKitComposerShell({ density, regularRadius: theme.borderRadius.x4l });

    return (
        <KitSurface
            surface={shell.surfaceRole}
            style={[
                styles.shell,
                {
                    borderRadius: shell.borderRadius,
                    paddingHorizontal: shell.paddingHorizontal,
                    paddingTop: shell.paddingTop,
                    paddingBottom: shell.paddingBottom,
                },
                style,
            ]}
        >
            {children}
        </KitSurface>
    );
});

export type ComposerProps = {
    value: string;
    onChangeText: (value: string) => void;
    placeholder: string;
    action: KitComposerAction;
    actionLabel: string;
    onAction: () => void;
    onSubmit?: () => void;
    density?: KitComposerDensity;
    leading?: React.ReactNode;
    /** Attachments and the modes currently switched on, each removable. */
    chips?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
};

/**
 * One bar holds the text, the attach control and the single filled action.
 * Whatever is switched on — an attachment, a mode — sits as a removable chip
 * above the text rather than as a permanent row of mode buttons, so the bar keeps
 * its shape and only shows what is actually in effect.
 */
export const Composer = React.memo(function Composer({
    value,
    onChangeText,
    placeholder,
    action,
    actionLabel,
    onAction,
    onSubmit,
    density = 'regular',
    leading,
    chips,
    style,
}: ComposerProps) {
    const { theme } = useUnistyles();
    const styles = stylesheet;
    const primary = resolveKitComposerAction(action);
    const iconName = action === 'stop' ? 'stop' : 'arrow-up';
    const iconColor = primary.filled ? theme.colors.button.primary.tint : theme.colors.textSecondary;

    return (
        <ComposerShell density={density} style={style}>
            {chips ? <View style={styles.chipRow}>{chips}</View> : null}
            <View style={styles.row}>
                {leading}
                <TextInput
                    multiline
                    value={value}
                    onChangeText={onChangeText}
                    onSubmitEditing={onSubmit}
                    placeholder={placeholder}
                    placeholderTextColor={theme.colors.input.placeholder}
                    accessibilityLabel={placeholder}
                    style={styles.input}
                />
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={actionLabel}
                    accessibilityState={{ disabled: action === 'disabled' }}
                    disabled={action === 'disabled'}
                    hitSlop={resolveKitHitSlop(primary.size, theme.minTouchTarget)}
                    onPress={onAction}
                    style={({ pressed }) => [
                        styles.action,
                        {
                            width: primary.size,
                            height: primary.size,
                            borderRadius: primary.borderRadius,
                            backgroundColor: primary.filled
                                ? theme.colors.button.primary.background
                                : theme.colors.surfaceHighest,
                            opacity: pressed ? 0.9 : 1,
                        },
                    ]}
                >
                    <Ionicons name={iconName} size={theme.iconSize.large} color={iconColor} />
                </Pressable>
            </View>
        </ComposerShell>
    );
});
