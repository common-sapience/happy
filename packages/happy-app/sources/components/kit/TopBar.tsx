import * as React from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Typography } from '@/constants/Typography';
import { layout } from '../layout';
import { KitSurface } from './KitSurface';

const stylesheet = StyleSheet.create((theme) => ({
    bar: {
        width: '100%',
        alignItems: 'center',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.colors.glass.divider,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.margins.md,
        paddingHorizontal: theme.margins.lg,
        width: '100%',
        maxWidth: layout.headerMaxWidth,
        minHeight: theme.minTouchTarget + theme.margins.sm,
    },
    titles: {
        flex: 1,
        minWidth: 0,
    },
    title: {
        ...Typography.default('semiBold'),
        color: theme.colors.text,
        fontSize: theme.typography.subtitle.fontSize,
        lineHeight: theme.typography.subtitle.lineHeight,
    },
    subtitle: {
        ...Typography.default('regular'),
        color: theme.colors.textSecondary,
        fontSize: theme.typography.caption.fontSize,
        lineHeight: theme.typography.caption.lineHeight,
    },
    side: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.margins.sm,
    },
}));

export type TopBarProps = {
    title?: string;
    subtitle?: string;
    /** For a screen whose title is a control rather than a word. */
    titleNode?: React.ReactNode;
    leading?: React.ReactNode;
    trailing?: React.ReactNode;
    /** The bar's own height, when the chrome around it fixes one. */
    contentStyle?: StyleProp<ViewStyle>;
    style?: StyleProp<ViewStyle>;
};

/**
 * Name on the left, at most one control on the right. The bar is the flush glass
 * layer: no shadow, a hairline, and nothing in it competes with the one primary
 * action of the screen underneath.
 */
export const TopBar = React.memo(function TopBar({
    title,
    subtitle,
    titleNode,
    leading,
    trailing,
    contentStyle,
    style,
}: TopBarProps) {
    const styles = stylesheet;

    return (
        <KitSurface surface="chrome" style={[styles.bar, style]}>
            <View style={[styles.content, contentStyle]}>
                {leading ? <View style={styles.side}>{leading}</View> : null}
                <View style={styles.titles}>
                    {titleNode ?? (title ? (
                        <Text numberOfLines={1} accessibilityRole="header" style={styles.title}>{title}</Text>
                    ) : null)}
                    {subtitle ? <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text> : null}
                </View>
                {trailing ? <View style={styles.side}>{trailing}</View> : null}
            </View>
        </KitSurface>
    );
});
