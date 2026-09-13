import * as React from 'react';
import * as Clipboard from 'expo-clipboard';
import type { MachineChoice } from '@/sync/machineChoices';
import { useSessions } from '@/sync/storage';
import { Modal } from '@/modal';
import { t } from '@/text';
import { buildOfflineMachineTroubleshooting } from '@/utils/offlineMachineTroubleshooting';

export function useOfflineMachineTroubleshooting(choices: readonly MachineChoice[]): () => void {
    const sessions = useSessions();
    const guide = React.useMemo(
        () => buildOfflineMachineTroubleshooting(choices, sessions),
        [choices, sessions],
    );

    return React.useCallback(() => {
        const message = [
            t('harness.troubleshootStep1'),
            t('harness.troubleshootStep2'),
            t('harness.troubleshootStep3'),
            '',
            t('harness.troubleshootPromptLabel'),
            guide.aiPrompt,
        ].join('\n');
        Modal.alert(t('harness.troubleshootTitle'), message, [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('harness.troubleshootCopy'),
                onPress: () => {
                    void Clipboard.setStringAsync(guide.aiPrompt).catch(() => {
                        Modal.alert(t('common.error'), t('harness.troubleshootCopyFailed'));
                    });
                },
            },
        ]);
    }, [guide]);
}