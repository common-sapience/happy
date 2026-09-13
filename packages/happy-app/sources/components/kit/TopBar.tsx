import * as React from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Typography } from '@/constants/Typography';
import { layout } from '../layout';
import { KitSurface } from './KitSurface';

const stylesheet = StyleSheet.create((theme) => ({
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.margins.md,
        paddingHorizontal: theme.margins.lg,
        minHeight: theme.minTouchTarget + theme.margins.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.colors.glass.divider,
    },
    titles: {
        flex: 1,
        minWidth: 0,
        maxWidth: layout.headerMaxWidth,
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
    title: string;
    subtitle?: string;
    leading?: React.ReactNode;
    trailing?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
};

/**
 * Name on the left, at most one control on the right. The bar is the flush glass
 * layer: no shadow, a hairline, and nothing in it competes with the one primary
 * action of the screen underneath.
 */
export const TopBar = React.memo(function TopBar({ title, subtitle, leading, trailing, style }: TopBarProps) {
    const styles = stylesheet;

    return (
        <KitSurface surface="chrome" style={[styles.bar, style]}>
            {leading ? <View style={styles.side}>{leading}</View> : null}
            <View style={styles.titles}>
                <Text numberOfLines={1} accessibilityRole="header" style={styles.title}>{title}</Text>
                {subtitle ? <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            {trailing ? <View style={styles.side}>{trailing}</View> : null}
        </KitSurface>
    );
});
