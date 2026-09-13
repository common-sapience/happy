import * as React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useUnistyles } from 'react-native-unistyles';
import { Item } from '../Item';
import { Switch } from './Switch';
import {
    resolveKitSettingsRowIconColor,
    resolveKitSettingsRowTitleColor,
    type KitSettingsRowTokens,
    type KitSettingsRowTone,
} from './kitSettingsRow';

export type SettingsRowProps = {
    title: string;
    subtitle?: string;
    subtitleLines?: number;
    detail?: string;
    icon?: React.ComponentProps<typeof Ionicons>['name'];
    tone?: KitSettingsRowTone;
    onPress?: () => void;
    onLongPress?: () => void;
    /** Present makes the row a switch row; the row then has no chevron. */
    value?: boolean;
    onValueChange?: (value: boolean) => void;
    /** A value view of the row's own — a picker's current choice, a badge. */
    trailing?: React.ReactNode;
    disabled?: boolean;
    loading?: boolean;
    showChevron?: boolean;
    showDivider?: boolean;
    copy?: boolean | string;
};

function useKitSettingsRowTokens(): KitSettingsRowTokens {
    const { theme } = useUnistyles();
    return {
        text: theme.colors.text,
        secondary: theme.colors.textSecondary,
        // The accent is the primary-action colour: one accent per theme, so a
        // row that leads somewhere and the button that acts read as one family.
        accent: theme.colors.button.primary.background,
        destructive: theme.colors.textDestructive,
        warning: theme.colors.box.warning.border,
        success: theme.colors.success,
    };
}

/**
 * One row shape for every settings list: glyph, title, optional second line, and
 * either a chevron, a detail value or a switch on the trailing edge.
 */
export const SettingsRow = React.memo(function SettingsRow({
    title,
    subtitle,
    subtitleLines,
    detail,
    icon,
    tone = 'neutral',
    onPress,
    onLongPress,
    value,
    onValueChange,
    trailing,
    disabled = false,
    loading = false,
    showChevron,
    showDivider,
    copy,
}: SettingsRowProps) {
    const { theme } = useUnistyles();
    const tokens = useKitSettingsRowTokens();
    const isSwitchRow = value !== undefined && onValueChange !== undefined;

    return (
        <Item
            title={title}
            subtitle={subtitle}
            subtitleLines={subtitleLines}
            detail={isSwitchRow ? undefined : detail}
            icon={icon ? (
                <Ionicons
                    name={icon}
                    size={theme.iconSize.xlarge}
                    color={resolveKitSettingsRowIconColor(tone, tokens)}
                />
            ) : undefined}
            titleStyle={{ color: resolveKitSettingsRowTitleColor(tone, tokens) }}
            destructive={tone === 'destructive'}
            onPress={isSwitchRow ? undefined : onPress}
            onLongPress={onLongPress}
            disabled={disabled}
            loading={loading}
            copy={copy}
            showChevron={showChevron ?? (!isSwitchRow && !!onPress && !trailing)}
            showDivider={showDivider}
            rightElement={isSwitchRow ? (
                <Switch
                    value={value}
                    onValueChange={onValueChange}
                    label={title}
                    disabled={disabled}
                />
            ) : trailing}
        />
    );
});
