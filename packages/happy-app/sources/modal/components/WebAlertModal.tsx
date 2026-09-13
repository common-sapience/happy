import React from 'react';
import { BaseModal } from './BaseModal';
import { AlertModalConfig, ConfirmModalConfig } from '../types';
import { DestructiveButton, PrimaryButton, SecondaryButton, Sheet } from '@/components/kit';

interface WebAlertModalProps {
    config: AlertModalConfig | ConfirmModalConfig;
    onClose: () => void;
    onConfirm?: (value: boolean) => void;
}

type AlertButton = { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };

export function WebAlertModal({ config, onClose, onConfirm }: WebAlertModalProps) {
    const isConfirm = config.type === 'confirm';

    const handleButtonPress = (buttonIndex: number) => {
        if (isConfirm && onConfirm) {
            onConfirm(buttonIndex === 1);
        } else if (!isConfirm && config.buttons?.[buttonIndex]?.onPress) {
            config.buttons[buttonIndex].onPress!();
        }
        onClose();
    };

    const buttons: AlertButton[] = isConfirm
        ? [
            { text: config.cancelText || 'Cancel', style: 'cancel' },
            { text: config.confirmText || 'OK', style: config.destructive ? 'destructive' : 'default' },
        ]
        : config.buttons ?? [{ text: 'OK', style: 'default' }];

    // Actions stack with the dismissal last, the way an iOS sheet ends on
    // Cancel, and only the first action that is not a dismissal takes the fill.
    let filledTaken = false;
    const ordered = buttons
        .map((button, index) => ({ button, index }))
        .sort((a, b) => Number(a.button.style === 'cancel') - Number(b.button.style === 'cancel'));
    const actions = ordered.map(({ button, index }) => {
        const onPress = () => handleButtonPress(index);
        if (button.style === 'cancel') {
            return <SecondaryButton key={index} title={button.text} onPress={onPress} />;
        }
        const confirming = !filledTaken;
        filledTaken = true;
        if (button.style === 'destructive') {
            return <DestructiveButton key={index} title={button.text} onPress={onPress} confirming={confirming} />;
        }
        return confirming
            ? <PrimaryButton key={index} title={button.text} onPress={onPress} />
            : <SecondaryButton key={index} title={button.text} onPress={onPress} />;
    });

    return (
        <BaseModal visible={true} onClose={onClose} closeOnBackdrop={false}>
            <Sheet title={config.title} message={config.message} actions={actions} />
        </BaseModal>
    );
}
