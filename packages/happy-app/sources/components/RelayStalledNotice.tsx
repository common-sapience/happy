import * as React from 'react';
import { useRouter } from 'expo-router';

import { useAuth } from '@/auth/AuthContext';
import { EmptyState, SecondaryButton } from './kit';
import { getRelayLabel } from '@/sync/serverConfig';
import type { RelayFailure } from '@/sync/relayReachability';
import { t } from '@/text';

/**
 * The agent list when its first load never came back (DESK-08, DESK-21).
 *
 * It stands where the spinner used to, and carries the two things that can end
 * the wait: the address this install is set to, which the relay screen changes,
 * and the account, which sign-out clears. The address itself is on screen so the
 * one it is stuck on is the one being read, not the one being remembered.
 */
export function RelayStalledNotice({ failure }: { failure: RelayFailure }) {
    const router = useRouter();
    const auth = useAuth();
    const relayLabel = getRelayLabel();

    const rejected = failure === 'rejected';
    const description = rejected ? t('relay.rejectedBody') : t('relay.unreachableBody');

    return (
        <EmptyState
            title={rejected ? t('relay.rejectedTitle') : t('relay.unreachableTitle')}
            description={relayLabel ? `${description}\n\n${relayLabel}` : description}
            action={(
                <>
                    <SecondaryButton
                        title={t('relay.addressLabel')}
                        onPress={() => router.navigate('/server')}
                    />
                    <SecondaryButton
                        title={t('accountPage.signOut')}
                        onPress={() => { void auth.logout(); }}
                    />
                </>
            )}
        />
    );
}
