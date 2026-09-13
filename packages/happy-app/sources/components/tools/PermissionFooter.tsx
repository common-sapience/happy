import * as React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Typography } from '@/constants/Typography';
import { sessionAllow, sessionDeny, sessionSetAgentModes } from '@/sync/ops';
import { t } from '@/text';
import { PermissionCard } from '@/components/kit';
import {
    resolvePermissionRequestCopy,
    type PermissionCategoryKey,
    type PermissionScopeKey,
} from '@/components/permissionRequestCopy';

const stylesheet = StyleSheet.create((theme) => ({
    settled: {
        paddingHorizontal: theme.margins.md,
        paddingBottom: theme.margins.sm,
    },
    settledText: {
        ...Typography.default('regular'),
        color: theme.colors.textSecondary,
        fontSize: theme.typography.caption.fontSize,
        lineHeight: theme.typography.caption.lineHeight,
    },
}));

/** Edits reach further than one file, so "always" has to mean the whole session. */
const EDIT_TOOLS = new Set([
    'edit', 'multiedit', 'write', 'notebookedit', 'apply_patch', 'exit_plan_mode', 'exitplanmode',
]);

const EXIT_PLAN_TOOLS = new Set(['exit_plan_mode', 'exitplanmode']);

const CATEGORY_LABELS: Record<PermissionCategoryKey, () => string> = {
    runCommand: () => t('permissionRequest.runCommand'),
    readFile: () => t('permissionRequest.readFile'),
    createFile: () => t('permissionRequest.createFile'),
    changeFile: () => t('permissionRequest.changeFile'),
    searchFiles: () => t('permissionRequest.searchFiles'),
    fetchWeb: () => t('permissionRequest.fetchWeb'),
    searchWeb: () => t('permissionRequest.searchWeb'),
    startHelper: () => t('permissionRequest.startHelper'),
    startChanges: () => t('permissionRequest.startChanges'),
    useTool: () => t('permissionRequest.useTool'),
};

const SCOPE_LABELS: Record<PermissionScopeKey, () => string> = {
    folder: () => t('permissionRequest.scopeFolder'),
    computer: () => t('permissionRequest.scopeComputer'),
    web: () => t('permissionRequest.scopeWeb'),
};

interface PermissionFooterProps {
    permission: {
        id: string;
        status: 'pending' | 'approved' | 'denied' | 'canceled';
        reason?: string;
        mode?: string;
        allowedTools?: string[];
        decision?: 'approved' | 'approved_for_session' | 'denied' | 'abort';
    };
    sessionId: string;
    toolName: string;
    toolInput?: unknown;
    metadata?: unknown;
}

/**
 * The permission request as it appears in the transcript (DESK-03): a card where
 * the agent stopped, with exactly three answers. Once answered it collapses to
 * one line saying what was decided — an answered request is history, not a
 * control.
 */
export const PermissionFooter = React.memo(function PermissionFooter({
    permission,
    sessionId,
    toolName,
    toolInput,
}: PermissionFooterProps) {
    const styles = stylesheet;
    // A ref, not state: two taps in the same frame would both read a state
    // flag as false and answer the request twice.
    const answering = React.useRef(false);
    const isPending = permission.status === 'pending';

    const answer = React.useCallback(async (send: () => Promise<unknown>) => {
        if (!isPending || answering.current) {
            return;
        }
        answering.current = true;
        try {
            await send();
        } catch (error) {
            console.error('Failed to answer a permission request', error);
            answering.current = false;
        }
    }, [isPending]);

    const handleAllowOnce = React.useCallback(() => answer(async () => {
        await sessionAllow(sessionId, permission.id);
        // Leaving plan mode is an approval of the mode switch as well: without
        // this the next message carries the stale mode and undoes the answer.
        if (EXIT_PLAN_TOOLS.has(toolName.toLowerCase())) {
            sessionSetAgentModes(sessionId, { permissionMode: 'default' });
        }
    }), [answer, permission.id, sessionId, toolName]);

    const handleAllowAlways = React.useCallback(() => answer(async () => {
        if (EDIT_TOOLS.has(toolName.toLowerCase())) {
            await sessionAllow(sessionId, permission.id, 'acceptEdits');
            sessionSetAgentModes(sessionId, { permissionMode: 'acceptEdits' });
            return;
        }
        const record = toolInput !== null && typeof toolInput === 'object'
            ? toolInput as Record<string, unknown>
            : {};
        // A shell rule that covered every future command would be a blanket
        // grant, so "always" is pinned to the exact command that was asked.
        const identifier = toolName === 'Bash' && typeof record.command === 'string'
            ? `Bash(${record.command})`
            : toolName;
        await sessionAllow(sessionId, permission.id, undefined, [identifier]);
    }), [answer, permission.id, sessionId, toolInput, toolName]);

    const handleDeny = React.useCallback(() => answer(
        () => sessionDeny(sessionId, permission.id),
    ), [answer, permission.id, sessionId]);

    if (!isPending) {
        return (
            <View style={styles.settled}>
                <Text style={styles.settledText}>
                    {permission.status === 'approved'
                        ? t('permissionRequest.answeredAllowed')
                        : t('permissionRequest.answeredDenied')}
                </Text>
            </View>
        );
    }

    const copy = resolvePermissionRequestCopy({ toolName, toolInput });

    return (
        <PermissionCard
            category={CATEGORY_LABELS[copy.categoryKey]()}
            target={copy.target}
            scope={SCOPE_LABELS[copy.scopeKey]()}
            raw={copy.raw}
            allowOnceLabel={t('permissionRequest.allowOnce')}
            allowAlwaysLabel={t('permissionRequest.allowAlways')}
            denyLabel={t('permissionRequest.deny')}
            onAllowOnce={handleAllowOnce}
            onAllowAlways={handleAllowAlways}
            onDeny={handleDeny}
        />
    );
});
