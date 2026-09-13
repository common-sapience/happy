import React from 'react';
import { View, Pressable, FlatList, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Text } from '@/components/StyledText';
import { usePathname } from 'expo-router';
import { SessionListViewItem, useSettingMutable } from '@/sync/storage';
import { FlatSessionRow, flatListBackgroundColor } from './FlatSessionRow';
import { toFlatSessionRow, type FlatSessionRowData } from '@/utils/flatSessionList';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHasArchivedSessions, useVisibleSessionListViewData } from '@/hooks/useVisibleSessionListViewData';
import { Typography } from '@/constants/Typography';
import { StyleSheet } from 'react-native-unistyles';
import { useIsTablet } from '@/utils/responsive';
import { requestReview } from '@/utils/requestReview';
import { UpdateBanner } from './UpdateBanner';
import { layout } from './layout';
import { t } from '@/text';

/**
 * The agent list has one shape (DESK-11): a single column of agents, newest
 * activity first, split by the day they were last worked on, with the archive as
 * a tail the reader can fold away. There is no project hierarchy and no second
 * layout to choose between — one concept, one entry.
 */
type SessionListDisplayItem = SessionListViewItem | {
    type: 'archive-toggle';
    hidden: boolean;
} | {
    type: 'agent';
    row: FlatSessionRowData;
    last: boolean;
    archived: boolean;
};

const stylesheet = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'stretch',
        backgroundColor: flatListBackgroundColor(theme),
    },
    contentContainer: {
        flex: 1,
        maxWidth: layout.maxWidth,
    },
    // A date heading is a label sitting between rows, not a band across the
    // page: the list paints one background from edge to edge.
    headerSection: {
        backgroundColor: flatListBackgroundColor(theme),
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 8,
    },
    headerText: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.groupped.sectionTitle,
        letterSpacing: 0.1,
        ...Typography.default('semiBold'),
    },
    // The toggle heads the archive rather than dividing the page, so it sits on
    // the same background the rows use.
    archiveToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 8,
        backgroundColor: flatListBackgroundColor(theme),
    },
    archiveTogglePressed: {
        opacity: 0.5,
    },
    archiveToggleLine: {
        flex: 1,
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.divider,
    },
    archiveToggleText: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        ...Typography.default('regular'),
    },
    phoneUpdateBanner: {
        paddingBottom: 16,
    },
    phoneUpdateBannerHeader: {
        paddingTop: 4,
    },
}));

export function SessionsList({
    topContentInset = 0,
    scrollIndicatorTopInset = 0,
    bottomContentInset = 128,
    onScroll,
}: {
    topContentInset?: number;
    scrollIndicatorTopInset?: number;
    bottomContentInset?: number;
    onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
} = {}) {
    const styles = stylesheet;
    const safeArea = useSafeAreaInsets();
    const sourceData = useVisibleSessionListViewData();
    const hasArchivedSessions = useHasArchivedSessions();
    // Stored under its original `hideInactiveSessions` key — synced settings
    // have no rename migration — but it hides archived agents only.
    const [hideArchivedSessions, setHideArchivedSessions] = useSettingMutable('hideInactiveSessions');
    const pathname = usePathname();
    const isTablet = useIsTablet();
    // Selection is derived once from pathname so the data array stays stable
    // across navigations. This keeps FlatList virtualization intact: only
    // the previously- and newly-selected rows re-render, instead of the
    // whole visible window.
    const selectedSessionId = React.useMemo<string | undefined>(() => {
        if (!isTablet) return undefined;
        if (!pathname.startsWith('/session/')) return undefined;
        return pathname.split('/')[2];
    }, [isTablet, pathname]);

    // Request review
    React.useEffect(() => {
        if (sourceData && sourceData.length > 0) {
            requestReview();
        }
    }, [sourceData && sourceData.length > 0]);

    const data = React.useMemo<SessionListDisplayItem[] | null>(() => {
        if (!sourceData) return sourceData;

        const items: SessionListDisplayItem[] = [];
        let archiveOpened = false;
        sourceData.forEach((item, index) => {
            if (item.type === 'header') {
                items.push(item);
                return;
            }
            const archived = item.session.archived;
            // One divider, directly above the first retired agent, wherever the
            // archive happens to start.
            if (archived && !archiveOpened) {
                archiveOpened = true;
                if (hasArchivedSessions) {
                    items.push({ type: 'archive-toggle', hidden: hideArchivedSessions });
                }
            }
            items.push({
                type: 'agent',
                row: toFlatSessionRow(item.session),
                last: index === sourceData.length - 1,
                archived,
            });
        });
        // Hidden archive: the toggle is the only way back to it, so it trails
        // the live rows instead of heading rows that are not there.
        if (hasArchivedSessions && !archiveOpened) {
            items.push({ type: 'archive-toggle', hidden: hideArchivedSessions });
        }
        return items;
    }, [hasArchivedSessions, hideArchivedSessions, sourceData]);

    const keyExtractor = React.useCallback((item: SessionListDisplayItem, index: number) => {
        switch (item.type) {
            case 'archive-toggle': return 'archive-toggle';
            case 'agent': return `agent-${item.row.session.id}`;
            case 'header': return `header-${item.title}-${index}`;
            case 'session': return `session-${item.session.id}`;
        }
    }, []);

    const renderItem = React.useCallback(({ item }: { item: SessionListDisplayItem }) => {
        switch (item.type) {
            case 'agent':
                return (
                    <FlatSessionRow
                        row={item.row}
                        selected={item.row.session.id === selectedSessionId}
                        showBorder={!item.last}
                        archived={item.archived}
                    />
                );

            case 'archive-toggle':
                return (
                    <Pressable
                        onPress={() => setHideArchivedSessions(!item.hidden)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: !item.hidden }}
                        style={({ pressed }) => [
                            styles.archiveToggle,
                            pressed && styles.archiveTogglePressed,
                        ]}
                    >
                        <View style={styles.archiveToggleLine} />
                        <Text style={styles.archiveToggleText}>
                            {item.hidden ? t('sidebar.showArchived') : t('sidebar.hideArchived')}
                        </Text>
                        <View style={styles.archiveToggleLine} />
                    </Pressable>
                );

            case 'header':
                return (
                    <View style={styles.headerSection}>
                        <Text style={styles.headerText}>
                            {item.title}
                        </Text>
                    </View>
                );

            // `session` items are mapped to `agent` rows above; the branch only
            // exists so the union stays exhaustive.
            case 'session':
                return null;
        }
    }, [selectedSessionId, setHideArchivedSessions, styles]);

    const HeaderComponent = React.useCallback(() => {
        const isPhoneLayout = topContentInset > 0;
        return (
            <UpdateBanner
                style={isPhoneLayout ? styles.phoneUpdateBanner : undefined}
                headerStyle={isPhoneLayout ? styles.phoneUpdateBannerHeader : undefined}
            />
        );
    }, [styles.phoneUpdateBanner, styles.phoneUpdateBannerHeader, topContentInset]);

    // Early return if no data yet
    if (!data) {
        return (
            <View style={styles.container} />
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.contentContainer}>
                <FlatList
                    data={data}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    extraData={selectedSessionId}
                    contentContainerStyle={{
                        paddingTop: topContentInset,
                        paddingBottom: safeArea.bottom + bottomContentInset,
                        maxWidth: layout.maxWidth,
                    }}
                    ListHeaderComponent={HeaderComponent}
                    automaticallyAdjustsScrollIndicatorInsets={scrollIndicatorTopInset === 0}
                    scrollIndicatorInsets={scrollIndicatorTopInset > 0
                        ? { top: scrollIndicatorTopInset }
                        : undefined}
                    windowSize={5}
                    maxToRenderPerBatch={8}
                    initialNumToRender={12}
                    onScroll={onScroll}
                    scrollEventThrottle={16}
                />
            </View>
        </View>
    );
}
