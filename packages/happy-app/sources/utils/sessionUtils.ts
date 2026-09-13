import { useUnistyles } from 'react-native-unistyles';
import { Session } from '@/sync/storageTypes';
import { resolveSessionState } from '@/sync/sessionState';
import type { SessionState } from '@/sync/sessionState';
import { agentListStateColor, agentListStateLabel, resolveAgentListState } from '@/components/agentListState';
import { isSessionArchived } from '@/sync/sessionArchived';
import { t } from '@/text';

export type { SessionState } from '@/sync/sessionState';

export interface SessionStatus {
    state: SessionState;
    isConnected: boolean;
    statusText: string;
    statusColor: string;
    statusDotColor: string;
    isPulsing?: boolean;
}

/**
 * The state of one session, in the four words the product uses for it.
 *
 * Word and colour come from `agentListState`: the list, the transcript's running
 * indicator and this hook all read the same authority, so an agent is never
 * "working" in one place and "waiting" in another (design.md §5).
 */
export function useSessionStatus(session: Session): SessionStatus {
    const { theme } = useUnistyles();
    const isOnline = session.presence === "online";
    const state = resolveSessionState({
        agentState: session.agentState,
        thinking: session.thinking,
        isOnline,
    });
    const listState = resolveAgentListState({ state, archived: isSessionArchived(session) });
    const color = agentListStateColor(listState, theme);
    const isPulsing = listState === 'running' || listState === 'waiting';

    return {
        state,
        isConnected: isOnline,
        statusText: state === 'disconnected'
            ? t('status.lastSeen', { time: formatLastSeen(session.activeAt, false) })
            : agentListStateLabel(listState),
        statusColor: color,
        statusDotColor: color,
        isPulsing,
    };
}

/**
 * Extracts a display name from a session's metadata path.
 * Returns the last segment of the path, or 'unknown' if no path is available.
 */
export function getSessionName(session: Session): string {
    if (session.metadata?.bot) return session.metadata.bot.name;
    if (session.metadata?.summary) {
        return session.metadata.summary.text;
    }
    return t('session.newChat');
}

/**
 * Generates a deterministic avatar ID from machine ID and path.
 * This ensures the same machine + path combination always gets the same avatar.
 */
export function getSessionAvatarId(session: Session): string {
    if (session.metadata?.bot) return `${session.metadata.machineId ?? ''}:bot:${session.metadata.bot.id}`;
    if (session.metadata?.machineId && session.metadata?.path) {
        // Combine machine ID and path for a unique, deterministic avatar
        return `${session.metadata.machineId}:${session.metadata.path}`;
    }
    // Fallback to session ID if metadata is missing
    return session.id;
}

/**
 * Returns the CLI command to resume a disconnected session, or null if not resumable.
 * Uses flavor-specific commands which work without happy-agent auth.
 */
/**
 * Formats a path relative to home directory if possible.
 * If the path starts with the home directory, replaces it with ~
 * Otherwise returns the full path.
 */
export function formatPathRelativeToHome(path: string, homeDir?: string): string {
    if (!homeDir) return path;
    
    // Normalize paths to handle trailing slashes
    const normalizedHome = homeDir.endsWith('/') ? homeDir.slice(0, -1) : homeDir;
    const normalizedPath = path;
    
    // Check if path starts with home directory
    if (normalizedPath.startsWith(normalizedHome)) {
        // Replace home directory with ~
        const relativePath = normalizedPath.slice(normalizedHome.length);
        // Add ~ and ensure there's a / after it if needed
        if (relativePath.startsWith('/')) {
            return '~' + relativePath;
        } else if (relativePath === '') {
            return '~';
        } else {
            return '~/' + relativePath;
        }
    }
    
    return path;
}

/**
 * Returns the session path for the subtitle.
 */
export function getSessionSubtitle(session: Session): string {
    if (session.metadata) {
        return formatPathRelativeToHome(session.metadata.path, session.metadata.homeDir);
    }
    return t('status.unknown');
}

/**
 * Checks if a session is currently online based on the active flag.
 * A session is considered online if the active flag is true.
 */
export function isSessionOnline(session: Session): boolean {
    return session.active;
}

/**
 * Checks if a session should be shown in the active sessions group.
 * Uses the active flag directly.
 */
export function isSessionActive(session: Session): boolean {
    return session.active;
}

export { getSessionActivityAt } from './sessionActivity';

/**
 * Formats OS platform string into a more readable format
 */
export function formatOSPlatform(platform?: string): string {
    if (!platform) return '';

    const osMap: Record<string, string> = {
        'darwin': 'macOS',
        'win32': 'Windows',
        'linux': 'Linux',
        'android': 'Android',
        'ios': 'iOS',
        'aix': 'AIX',
        'freebsd': 'FreeBSD',
        'openbsd': 'OpenBSD',
        'sunos': 'SunOS'
    };

    return osMap[platform.toLowerCase()] || platform;
}

/**
 * Formats the last seen time of a session into a human-readable relative time.
 * @param activeAt - Timestamp when the session was last active
 * @param isActive - Whether the session is currently active
 * @returns Formatted string like "Active now", "5 minutes ago", "2 hours ago", or a date
 */
export function formatLastSeen(activeAt: number, isActive: boolean = false): string {
    if (isActive) {
        return t('status.activeNow');
    }

    const now = Date.now();
    const diffMs = now - activeAt;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) {
        return t('time.justNow');
    } else if (diffMinutes < 60) {
        return t('time.minutesAgo', { count: diffMinutes });
    } else if (diffHours < 24) {
        return t('time.hoursAgo', { count: diffHours });
    } else if (diffDays < 7) {
        return t('sessionHistory.daysAgo', { count: diffDays });
    } else {
        // Format as date
        const date = new Date(activeAt);
        const options: Intl.DateTimeFormatOptions = {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
        };
        return date.toLocaleDateString(undefined, options);
    }
}
