import React from 'react';
import { Platform } from 'react-native';
import { storage } from '@/sync/storage';
import { isInternalSession } from '@/sync/agentListView';
import { updateFaviconWithNotification, resetFavicon } from '@/utils/web/faviconGenerator';

/**
 * Component that monitors all sessions and updates the favicon
 * when any online session has pending permissions.
 *
 * The host's own sessions are excluded: a background pass the user did not start must not put a
 * badge on the window.
 */
export const FaviconPermissionIndicator = React.memo(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
        return null;
    }

    const hasOnlineSessionWithPermissions = storage((state) => {
        return Object.values(state.sessions).some(session => {
            if (isInternalSession(session)) {
                return false;
            }
            // Use centralized presence logic - only "online" sessions matter
            const isOnline = session.presence === 'online';

            const hasPermissions = session.agentState?.requests && 
                Object.keys(session.agentState.requests).length > 0;

            return isOnline && hasPermissions;
        });
    });

    React.useLayoutEffect(() => {
        if (hasOnlineSessionWithPermissions) {
            updateFaviconWithNotification();
        } else {
            resetFavicon();
        }
    }, [hasOnlineSessionWithPermissions]);

    React.useLayoutEffect(() => {
        return () => {
            resetFavicon();
        };
    }, []);

    return null;
});

FaviconPermissionIndicator.displayName = 'FaviconPermissionIndicator';