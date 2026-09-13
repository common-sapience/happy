import * as React from 'react';
import { Text, TextInput, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useHeaderHeight } from '@/utils/responsive';
import { useSettingMutable } from '@/sync/storage';
import { MainView } from './MainView';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { t } from '@/text';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@/constants/Typography';
import { ShortcutHintBadge, useShortcutHints } from './ShortcutHints';
import { useHasArchivedSessions } from '@/hooks/useVisibleSessionListViewData';
import { NewAgentButton } from './kit';
import { useAgentListSearch } from './agentListSearch';

const stylesheet = StyleSheet.create((theme) => ({
    // The shell around this view is the glass layer (SidebarNavigator), so the
    // sidebar paints no ground of its own and no box of its own: the material
    // shows through and the shell owns the single edge facing the content pane.
    container: {
        flex: 1,
    },
    topControls: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: theme.margins.lg,
        marginTop: theme.margins.sm,
        marginBottom: theme.margins.xs,
        gap: theme.margins.sm,
    },
    newAgentButton: {
        flex: 1,
    },
    shortcutBadgeOverlay: {
        position: 'absolute',
        top: -6,
        right: -6,
    },
    archiveButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.borderRadius.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.divider,
        backgroundColor: theme.colors.surface,
    },
    archiveButtonActive: {
        backgroundColor: theme.colors.surfaceSelected,
    },
    archiveButtonPressed: {
        backgroundColor: theme.colors.surfacePressed,
    },
    shortcutTargetActive: {
        backgroundColor: theme.colors.surfacePressed,
    },
    settingsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.margins.lg,
        paddingVertical: theme.margins.md,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.divider,
        gap: theme.margins.sm,
    },
    settingsText: {
        fontSize: theme.typography.body.fontSize,
        lineHeight: theme.typography.body.lineHeight,
        color: theme.colors.text,
        ...Typography.default(),
    },
    shortcutBadgeInline: {
        marginLeft: 'auto',
    },
    search: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.margins.sm,
        marginHorizontal: theme.margins.lg,
        marginBottom: theme.margins.sm,
        paddingHorizontal: theme.margins.md,
        height: 36,
        borderRadius: theme.borderRadius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.divider,
        backgroundColor: theme.colors.surface,
    },
    searchInput: {
        flex: 1,
        minWidth: 0,
        color: theme.colors.text,
        fontSize: theme.typography.body.fontSize,
        ...Typography.default(),
    },
}));

export const SidebarView = React.memo(() => {
    const styles = stylesheet;
    const { theme } = useUnistyles();
    const safeArea = useSafeAreaInsets();
    const router = useRouter();
    const headerHeight = useHeaderHeight();
    const hasArchivedSessions = useHasArchivedSessions();
    // Stored under its original `hideInactiveSessions` key — synced settings
    // have no rename migration — but it hides archived sessions only.
    const [hideArchivedSessions, setHideArchivedSessions] = useSettingMutable('hideInactiveSessions');
    const { visible: shortcutHintsVisible } = useShortcutHints();
    const searchQuery = useAgentListSearch((state) => state.query);
    const setSearchQuery = useAgentListSearch((state) => state.setQuery);

    const handleNewAgent = React.useCallback(() => {
        router.navigate('/new');
    }, [router]);
    const handleArchiveVisibility = React.useCallback(() => {
        setHideArchivedSessions(!hideArchivedSessions);
    }, [hideArchivedSessions, setHideArchivedSessions]);

    return (
        <View style={[styles.container, { paddingTop: safeArea.top + headerHeight }]}>
            <View style={styles.topControls}>
                <View style={styles.newAgentButton}>
                    <NewAgentButton title={t('sidebar.newAgent')} onPress={handleNewAgent} />
                    <ShortcutHintBadge shortcutKey="N" style={styles.shortcutBadgeOverlay} />
                </View>
                {hasArchivedSessions && (
                    <Pressable
                        onPress={handleArchiveVisibility}
                        accessibilityLabel={hideArchivedSessions
                            ? t('sidebar.showArchived')
                            : t('sidebar.hideArchived')}
                        accessibilityRole="button"
                        accessibilityState={{ selected: !hideArchivedSessions }}
                        style={({ pressed }) => [
                            styles.archiveButton,
                            !hideArchivedSessions && styles.archiveButtonActive,
                            pressed && styles.archiveButtonPressed,
                        ]}
                    >
                        <Ionicons
                            name={hideArchivedSessions ? 'archive-outline' : 'archive'}
                            size={theme.iconSize.large}
                            color={theme.colors.text}
                        />
                    </Pressable>
                )}
            </View>

            <View style={styles.search}>
                <Ionicons name="search" size={theme.iconSize.medium} color={theme.colors.textSecondary} />
                <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder={t('harness.searchAgents')}
                    placeholderTextColor={theme.colors.textSecondary}
                    accessibilityLabel={t('harness.searchAgents')}
                    style={styles.searchInput}
                    autoCorrect={false}
                    returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                    <Pressable
                        onPress={() => setSearchQuery('')}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={t('harness.clearSearch')}
                    >
                        <Ionicons
                            name="close-circle"
                            size={theme.iconSize.large}
                            color={theme.colors.textSecondary}
                        />
                    </Pressable>
                )}
            </View>

            <MainView variant="sidebar" />

            <Pressable
                onPress={() => router.push('/settings')}
                style={[
                    styles.settingsRow,
                    shortcutHintsVisible && styles.shortcutTargetActive,
                ]}
            >
                <Ionicons name="settings-outline" size={theme.iconSize.large} color={theme.colors.text} />
                <Text style={styles.settingsText}>{t('settings.title')}</Text>
                <ShortcutHintBadge shortcutKey="," style={styles.shortcutBadgeInline} />
            </Pressable>
        </View>
    );
});
