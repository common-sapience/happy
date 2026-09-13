import * as React from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Typography } from '@/constants/Typography';

const stylesheet = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.margins.xxl,
        gap: theme.margins.lg,
    },
    title: {
        ...Typography.default('semiBold'),
        color: theme.colors.text,
        fontSize: theme.typography.title.fontSize,
        lineHeight: theme.typography.title.lineHeight,
        textAlign: 'center',
    },
    description: {
        ...Typography.default('regular'),
        color: theme.colors.textSecondary,
        fontSize: theme.typography.body.fontSize,
        lineHeight: theme.typography.body.lineHeight,
        textAlign: 'center',
        maxWidth: 420,
    },
    action: {
        alignSelf: 'center',
        minWidth: 220,
    },
}));

export type EmptyStateProps = {
    title: string;
    description?: string;
    action?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
};

/**
 * One line of explanation and at most one action, centred on the page. No
 * illustration, no progress ring, nothing that exists only to fill the space.
 */
export const EmptyState = React.memo(function EmptyState({ title, description, action, style }: EmptyStateProps) {
    const styles = stylesheet;

    return (
        <View style={[styles.container, style]}>
            <Text style={styles.title}>{title}</Text>
            {description ? <Text style={styles.description}>{description}</Text> : null}
            {action ? <View style={styles.action}>{action}</View> : null}
        </View>
    );
});
