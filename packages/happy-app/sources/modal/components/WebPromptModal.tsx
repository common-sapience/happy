import React, { useEffect, useRef, useState } from 'react';
import { KeyboardTypeOptions, Platform, TextInput } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { BaseModal } from './BaseModal';
import { PromptModalConfig } from '../types';
import { Typography } from '@/constants/Typography';
import { PrimaryButton, SecondaryButton, Sheet } from '@/components/kit';

interface WebPromptModalProps {
    config: PromptModalConfig;
    onClose: () => void;
    onConfirm: (value: string | null) => void;
}

const stylesheet = StyleSheet.create((theme) => ({
    input: {
        ...Typography.default('regular'),
        width: '100%',
        minHeight: theme.minTouchTarget,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.divider,
        paddingHorizontal: theme.margins.md,
        fontSize: theme.typography.body.fontSize,
        lineHeight: theme.typography.body.lineHeight,
        color: theme.colors.input.text,
        backgroundColor: theme.colors.input.background,
        outlineWidth: 0,
    },
}));

export function WebPromptModal({ config, onClose, onConfirm }: WebPromptModalProps) {
    const { theme } = useUnistyles();
    const styles = stylesheet;
    const [inputValue, setInputValue] = useState(config.defaultValue || '');
    const inputRef = useRef<TextInput>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            inputRef.current?.focus();
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    const handleCancel = () => {
        onConfirm(null);
        onClose();
    };

    const handleConfirm = () => {
        onConfirm(inputValue);
        onClose();
    };

    const getKeyboardType = (): KeyboardTypeOptions => {
        switch (config.inputType) {
            case 'email-address':
                return 'email-address';
            case 'numeric':
                return 'numeric';
            default:
                return 'default';
        }
    };

    return (
        <BaseModal visible={true} onClose={handleCancel} closeOnBackdrop={false}>
            <Sheet
                title={config.title}
                message={config.message}
                actions={[
                    <PrimaryButton key="confirm" title={config.confirmText || 'OK'} onPress={handleConfirm} />,
                    <SecondaryButton key="cancel" title={config.cancelText || 'Cancel'} onPress={handleCancel} />,
                ]}
            >
                <TextInput
                    ref={inputRef}
                    style={styles.input}
                    value={inputValue}
                    onChangeText={setInputValue}
                    placeholder={config.placeholder}
                    placeholderTextColor={theme.colors.input.placeholder}
                    accessibilityLabel={config.placeholder ?? config.title}
                    keyboardType={getKeyboardType()}
                    secureTextEntry={config.inputType === 'secure-text'}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus={Platform.OS === 'web'}
                    onSubmitEditing={handleConfirm}
                    returnKeyType="done"
                />
            </Sheet>
        </BaseModal>
    );
}
