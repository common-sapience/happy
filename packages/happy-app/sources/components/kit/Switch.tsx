import * as React from 'react';
import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Switch as AppSwitch } from '../Switch';

const stylesheet = StyleSheet.create((theme) => ({
    target: {
        minWidth: theme.minTouchTarget,
        minHeight: theme.minTouchTarget,
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
}));

export type SwitchProps = {
    value: boolean;
    onValueChange: (value: boolean) => void;
    label: string;
    disabled?: boolean;
};

/**
 * The platform switch with the theme's track and thumb, wrapped in a box that
 * reaches the minimum touch target, and carrying the label of the row it belongs
 * to so a reader hears what is being switched.
 */
export const Switch = React.memo(function Switch({ value, onValueChange, label, disabled = false }: SwitchProps) {
    const styles = stylesheet;
    const { theme } = useUnistyles();

    return (
        <View style={styles.target}>
            <AppSwitch
                value={value}
                onValueChange={onValueChange}
                disabled={disabled}
                accessibilityRole="switch"
                accessibilityLabel={label}
                accessibilityState={{ checked: value, disabled }}
                ios_backgroundColor={theme.colors.switch.track.inactive}
            />
        </View>
    );
});
