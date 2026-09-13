import React from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Text } from '@/components/StyledText';
import { Typography } from '@/constants/Typography';
import { Avatar } from './Avatar';
import { StatusDot } from './StatusDot';
import { SessionActionsAnchor, SessionActionsPopover } from './SessionActionsPopover';
import { SessionShortcutHintBadge } from './ShortcutHints';
import { useSessionPressHandlers } from '@/hooks/useNavigateToSession';
import { useSessionActionAlert } from '@/hooks/useSessionQuickActions';
import { useHappyAction } from '@/hooks/useHappyAction';
import { HappyError } from '@/utils/errors';
import { sessionKill } from '@/sync/ops';
import type { FlatSessionRowData } from '@/utils/flatSessionList';
import { formatSessionListTimestamp } from '@/utils/sessionListTimestamp';
import type { Theme } from '@/theme';
import { t } from '@/text';
import { AgentListRow } from './kit';
import { resolveFlatSessionRowPresentation } from '@/utils/flatSessionRowPresentation';
import { agentListStateColor, agentListStateLabel, resolveAgentListState } from './agentListState';

const AVATAR_SIZE = 44;
const ROW_PADDING = 16;
const AVATAR_GAP = 12;
const TOP_RIGHT_DOT_SIZE = 20;
const TOP_RIGHT_SLOT_WIDTH = 56;
const UNREAD_DOT_CLEAR_GRACE_MS = 350;

/**
 * The single colour the flat list paints, rows and page alike, so nothing reads
 * as a card sitting on a backdrop: plain white in light, the page's own black in
 * dark. `surface` is deliberately not used — in dark it is a lifted graphite
 * meant to contrast against exactly the backdrop this variant removes.
 */
export function flatListBackgroundColor(theme: Theme): string {
    return theme.dark ? theme.colors.groupped.background : '#FFFFFF';
}

/**
 * One agent in the list. The row's shape is the kit's `AgentListRow` (DESK-19);
 * this adds what only a session has: the avatar, the time of its last activity
 * or an unread mark, and swipe-to-archive.
 *
 * There is no vendor mark anywhere on it: the product has one kind of agent, so
 * naming its engine on every row would be noise (DESK-11).
 */
export const FlatSessionRow = React.memo(({ row, selected, showBorder, archived }: {
    row: FlatSessionRowData;
    selected?: boolean;
    showBorder?: boolean;
    /** Retired work: the same row, faded back and drained of avatar colour. */
    archived?: boolean;
}) => {
    const { session, projectName, workspaceName } = row;
    const styles = stylesheet;
    const { theme } = useUnistyles();
    const sessionPressHandlers = useSessionPressHandlers(session.id);
    const swipeableRef = React.useRef<Swipeable | null>(null);
    const swipeEnabled = Platform.OS !== 'web';
    const [actionsAnchor, setActionsAnchor] = React.useState<SessionActionsAnchor | null>(null);

    // Greying out is about the machine, not the session's own socket. A session
    // idle since yesterday on a machine that is still up is ordinary work you
    // can pick back up, and drawing it as dead makes a healthy list look like a
    // graveyard. Only retired work, or work whose machine is actually gone,
    // fades.
    const faded = !!archived || session.machineOffline;

    // SessionView clears the real unread state when the destination gains
    // focus. Keep only the row's visual badge around long enough for the
    // navigation transition to cover it, instead of briefly exposing the
    // timestamp underneath. Read semantics remain immediate.
    const [showUnreadDot, setShowUnreadDot] = React.useState(session.hasUnread);
    React.useEffect(() => {
        if (session.hasUnread) {
            setShowUnreadDot(true);
            return;
        }
        if (!showUnreadDot) return;

        const timeout = setTimeout(() => setShowUnreadDot(false), UNREAD_DOT_CLEAR_GRACE_MS);
        return () => clearTimeout(timeout);
    }, [session.hasUnread, showUnreadDot]);

    const presentation = resolveFlatSessionRowPresentation({
        state: session.state,
        hasUnread: showUnreadDot,
        faded,
    });
    const listState = resolveAgentListState({ state: session.state, archived: !!archived });
    const listStateLabel = agentListStateLabel(listState);
    const topRightAccessibilityLabel = presentation.topRight.type === 'dot'
        ? listState === 'waiting'
            ? listStateLabel
            : t('status.unread')
        : undefined;

    // The same `lastActivityAt` the flat list sorts on, so the stamps run in
    // the order the rows do.
    const timestamp = React.useMemo(
        () => formatSessionListTimestamp(session.lastActivityAt),
        [session.lastActivityAt],
    );

    const [archiving, performArchive] = useHappyAction(async () => {
        const result = await sessionKill(session.id);
        if (!result.success) {
            throw new HappyError(result.message || t('sessionInfo.failedToArchiveSession'), false);
        }
    });

    const handleArchive = React.useCallback(() => {
        swipeableRef.current?.close();
        performArchive();
    }, [performArchive]);

    const handleContextMenu = React.useCallback((event: any) => {
        event.preventDefault?.();
        event.stopPropagation?.();
        setActionsAnchor({
            type: 'point',
            x: event.nativeEvent.clientX ?? event.nativeEvent.pageX ?? 0,
            y: event.nativeEvent.clientY ?? event.nativeEvent.pageY ?? 0,
        });
    }, []);

    const showActionAlert = useSessionActionAlert(session.id);
    const menuProps = Platform.OS === 'web' ? {
        onContextMenu: handleContextMenu,
    } as any : {
        onLongPress: showActionAlert,
    };

    const subtitle = [projectName, workspaceName].filter(Boolean).join(' · ');

    const content = (
        <AgentListRow
            title={session.name}
            subtitle={subtitle || undefined}
            status={listState}
            statusLabel={listStateLabel}
            statusColor={agentListStateColor(listState, theme)}
            selected={selected}
            showDivider={showBorder}
            dividerInset={ROW_PADDING + AVATAR_SIZE + AVATAR_GAP}
            style={styles.row}
            leading={(
                <View style={[styles.avatar, faded && styles.faded]}>
                    <Avatar
                        id={session.avatarId}
                        size={AVATAR_SIZE}
                        monochrome={faded}
                        imageUrl={session.projectAvatarUri}
                        thumbhash={session.projectAvatarThumbhash}
                    />
                </View>
            )}
            trailing={(
                <>
                    <SessionShortcutHintBadge sessionId={session.id} style={styles.shortcutBadge} />
                    <View
                        style={styles.topRightStatus}
                        accessible={topRightAccessibilityLabel !== undefined}
                        accessibilityRole={topRightAccessibilityLabel ? 'text' : undefined}
                        accessibilityLabel={topRightAccessibilityLabel}
                    >
                        {presentation.topRight.type === 'dot' ? (
                            <StatusDot color={presentation.topRight.color} size={TOP_RIGHT_DOT_SIZE} />
                        ) : (
                            <Text style={styles.timestamp} numberOfLines={1}>{timestamp}</Text>
                        )}
                    </View>
                </>
            )}
            {...sessionPressHandlers}
            {...menuProps}
        />
    );

    if (!swipeEnabled) {
        return (
            <>
                {content}
                <SessionActionsPopover
                    anchor={actionsAnchor}
                    onClose={() => setActionsAnchor(null)}
                    sessionId={session.id}
                    visible={!!actionsAnchor}
                />
            </>
        );
    }

    const renderRightActions = () => (
        <Pressable style={styles.swipeAction} onPress={handleArchive} disabled={archiving}>
            <Ionicons name="archive-outline" size={20} color="#FFFFFF" />
            <Text style={styles.swipeActionText} numberOfLines={2}>
                {t('sessionInfo.archiveSession')}
            </Text>
        </Pressable>
    );

    return (
        <Swipeable
            ref={swipeableRef}
            renderRightActions={renderRightActions}
            overshootRight={false}
            enabled={!archiving}
        >
            {content}
        </Swipeable>
    );
});

const stylesheet = StyleSheet.create((theme) => ({
    row: {
        backgroundColor: flatListBackgroundColor(theme),
    },
    avatar: {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
    },
    // Faded rows keep the exact geometry of live ones and differ only by being
    // pulled back, so the list stays one column rather than two designs.
    faded: {
        opacity: 0.5,
    },
    shortcutBadge: {
        flexShrink: 0,
    },
    // The dot and time share a right column, so changing status never makes the
    // title jump horizontally. It is only as wide as the longest timestamp; the
    // dot occupies that same slot instead of reserving a second lane.
    topRightStatus: {
        width: TOP_RIGHT_SLOT_WIDTH,
        flexShrink: 0,
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    timestamp: {
        fontSize: theme.typography.caption.fontSize,
        lineHeight: theme.typography.caption.lineHeight,
        color: theme.colors.textSecondary,
        fontVariant: ['tabular-nums'],
        textAlign: 'right',
        ...Typography.default('regular'),
    },
    swipeAction: {
        width: 112,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.status.error,
    },
    swipeActionText: {
        marginTop: 4,
        fontSize: 12,
        color: '#FFFFFF',
        textAlign: 'center',
        ...Typography.default('semiBold'),
    },
}));
