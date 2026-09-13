import * as React from 'react';

import { useAuth } from '@/auth/AuthContext';
import { letDaemonJoinTheAccount, tellDaemonTheRelayAddress } from '@/sync/daemonHandoffShell';

/**
 * Keeps the daemon on this computer in step with the app (DESK-08, DESK-21).
 *
 * The address is handed over whenever the app starts, because that is when the app
 * knows which relay it resolved; the relay screen hands it over again the moment it
 * changes. The account follows as soon as the app has one, so the computer the user
 * is sitting at appears among their computers without being paired by hand.
 *
 * Both are no-ops without a desktop shell, so the web build is unaffected.
 */
export function useDesktopDaemonHandoff(): void {
    const auth = useAuth();

    React.useEffect(() => {
        void tellDaemonTheRelayAddress();
    }, []);

    React.useEffect(() => {
        if (!auth.isAuthenticated) {
            return;
        }
        void letDaemonJoinTheAccount();
    }, [auth.isAuthenticated]);
}
