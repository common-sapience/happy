import * as React from 'react';
import { Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Typography } from '@/constants/Typography';
import { KitSurface } from './KitSurface';
import { resolveKitSheetGeometry } from './kitSheet';

const SHEET_MAX_WIDTH = 360;

const stylesheet = StyleSheet.create((theme) => ({
    sheet: {
        overflow: 'hidden',
        alignSelf: 'center',
    },
    header: {
        paddingHorizontal: theme.margins.xl,
        paddingTop: theme.margins.xl,
        paddingBottom: theme.margins.md,
        gap: theme.margins.xs,
    },
    title: {
        ...Typography.default('semiBold'),
        color: theme.colors.text,
        fontSize: theme.typography.subtitle.fontSize,
        lineHeight: theme.typography.subtitle.lineHeight,
        textAlign: 'center',
    },
    message: {
        ...Typography.default('regular'),
        color: theme.colors.textSecondary,
        fontSize: theme.typography.caption.fontSize,
        lineHeight: theme.typography.caption.lineHeight,
        textAlign: 'center',
    },
    body: {
        paddingHorizontal: theme.margins.xl,
        paddingBottom: theme.margins.lg,
    },
    actions: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.glass.divider,
        padding: theme.margins.md,
        gap: theme.margins.sm,
    },
}));

export type SheetProps = {
    title: string;
    message?: string;
    children?: React.ReactNode;
    actions?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
};

/**
 * The one floating layer: a glass panel with a concentric inner radius for
 * whatever it holds, stacked actions rather than a row of equal buttons, and a
 * width that gives way before it reaches the window edge.
 */
export const Sheet = React.memo(function Sheet({ title, message, children, actions, style }: SheetProps) {
    const { theme } = useUnistyles();
    const styles = stylesheet;
    const { width } = useWindowDimensions();
    const geometry = resolveKitSheetGeometry({
        viewportWidth: width,
        maxWidth: SHEET_MAX_WIDTH,
        margin: theme.margins.xxl,
        radius: theme.borderRadius.x4l,
        contentInset: theme.margins.md,
    });

    return (
        <KitSurface
            surface={geometry.surfaceRole}
            accessibilityViewIsModal
            style={[styles.sheet, { width: geometry.width, borderRadius: geometry.borderRadius }, style]}
        >
            <View style={styles.header}>
                <Text accessibilityRole="header" style={styles.title}>{title}</Text>
                {message ? <Text style={styles.message}>{message}</Text> : null}
            </View>
            {children ? (
                <View style={styles.body}>
                    <SheetContentRadius radius={geometry.contentRadius}>{children}</SheetContentRadius>
                </View>
            ) : null}
            {actions ? <View style={styles.actions}>{actions}</View> : null}
        </KitSurface>
    );
});

const SheetContentRadius = React.memo(function SheetContentRadius({
    radius,
    children,
}: {
    radius: number;
    children: React.ReactNode;
}) {
    return <View style={{ borderRadius: radius, overflow: 'hidden' }}>{children}</View>;
});
