import * as React from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { MarkdownView, type Option } from "./markdown/MarkdownView";
import { t } from '@/text';
import type { AgentTextMessage, Message, UserTextMessage } from "@/sync/typesMessage";
import { ToolView } from "./tools/ToolView";
import type { AgentEvent } from "@/sync/typesRaw";
import { sync } from '@/sync/sync';
import { useSetting } from '@/sync/storage';
import { resolveUserMessageBubbleColor } from '@/utils/userMessageBubbleColor';
import { LongPressCopyable } from './LongPressCopyable';
import {
    ActivityRow,
    formatTranscriptDuration,
    MessageBubble,
    MessageRow,
    resolveTranscriptRowKind,
} from './kit';

/**
 * One message from the agent stream, in the transcript's single column: the
 * user's own in a bubble on the trailing edge, the reply flat on the page, and
 * every kind of step the stream reports — a tool call, a thinking block, an
 * engine notice — on one collapsed line (DESK-01, DESK-20).
 */
export const MessageView = React.memo((props: {
    message: Message;
    sessionId: string;
    copyText?: string;
    /** How long the agent spent thinking, when the next message is known. */
    thinkingDurationMs?: number;
}) => {
    const kind = resolveTranscriptRowKind(props.message);

    if (kind === 'hidden') {
        return null;
    }
    if (kind === 'user') {
        return <UserTextBlock message={props.message as UserTextMessage} sessionId={props.sessionId} />;
    }
    if (kind === 'reply') {
        return (
            <AgentTextBlock
                message={props.message as AgentTextMessage}
                sessionId={props.sessionId}
                copyText={props.copyText}
            />
        );
    }
    if (kind === 'thinking') {
        return <ThinkingBlock message={props.message as AgentTextMessage} durationMs={props.thinkingDurationMs} />;
    }
    if (kind === 'activity' && props.message.kind === 'tool-call') {
        return <ToolView tool={props.message.tool} sessionId={props.sessionId} />;
    }
    if (props.message.kind === 'agent-event') {
        return <NoticeBlock event={props.message.event} />;
    }
    return null;
});

function UserTextBlock(props: {
    message: UserTextMessage;
    sessionId: string;
}) {
    const handleOptionPress = React.useCallback((option: Option) => {
        sync.sendMessage(props.sessionId, option.title, { source: 'option' });
    }, [props.sessionId]);

    const userMessageBubbleColor = useSetting('userMessageBubbleColor');
    const { theme } = useUnistyles();
    const bubblePalette = resolveUserMessageBubbleColor(userMessageBubbleColor, theme.dark);
    const text = props.message.displayText || props.message.text;

    return (
        <MessageRow author="user">
            {/* Long-press copies the whole message through our own menu rather than
                the OS selection callout. Rewind remains in session actions. */}
            <LongPressCopyable style={styles.userCopyTarget} text={text}>
                <MessageBubble style={[
                    styles.userMessageBubble,
                    { backgroundColor: bubblePalette.background, borderColor: bubblePalette.border },
                ]}>
                    <MarkdownView externalCopyHandler markdown={text} onOptionPress={handleOptionPress} sessionId={props.sessionId} />
                </MessageBubble>
            </LongPressCopyable>
        </MessageRow>
    );
}

function AgentTextBlock(props: {
    message: AgentTextMessage;
    sessionId: string;
    copyText?: string;
}) {
    const handleOptionPress = React.useCallback((option: Option) => {
        sync.sendMessage(props.sessionId, option.title, { source: 'option' });
    }, [props.sessionId]);

    return (
        <MessageRow author="agent">
            <MarkdownView markdown={props.message.text} onOptionPress={handleOptionPress} sessionId={props.sessionId} />
            {props.copyText ? <MessageCopyButton text={props.copyText} /> : null}
        </MessageRow>
    );
}

/**
 * Reasoning is one line, not a wall of text: the reader is told the agent thought
 * and for how long, and can open it if they want to read along.
 */
function ThinkingBlock(props: { message: AgentTextMessage; durationMs?: number }) {
    return (
        <ActivityRow
            label={props.durationMs != null
                ? t('transcript.thoughtFor', { duration: formatTranscriptDuration(props.durationMs) })
                : t('transcript.thinking')}
            detail={props.message.text}
            expandLabel={t('transcript.showThinking')}
            collapseLabel={t('transcript.hideThinking')}
        />
    );
}

// The glyph is deliberately small, so widen the touch target well past it.
const COPY_HIT_SLOP = { top: 14, bottom: 14, left: 14, right: 20 };

function MessageCopyButton(props: { text: string }) {
    const { theme } = useUnistyles();
    const [copied, setCopied] = React.useState(false);
    const resetTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    React.useEffect(() => () => {
        if (resetTimerRef.current) {
            clearTimeout(resetTimerRef.current);
        }
    }, []);

    const handleCopy = React.useCallback(async () => {
        try {
            await Clipboard.setStringAsync(props.text);
            setCopied(true);
            if (resetTimerRef.current) {
                clearTimeout(resetTimerRef.current);
            }
            resetTimerRef.current = setTimeout(() => setCopied(false), 1500);
        } catch (error) {
            console.error('Failed to copy message:', error);
        }
    }, [props.text]);

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={copied ? t('common.copied') : t('common.copy')}
            hitSlop={COPY_HIT_SLOP}
            onPress={handleCopy}
            style={({ pressed }) => [
                styles.copyAction,
                pressed && styles.copyActionPressed,
            ]}
        >
            <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={theme.iconSize.medium}
                color={theme.colors.textSecondary}
            />
        </Pressable>
    );
}

/** Something the engine reports about itself, in the same muted line as a step. */
function NoticeBlock(props: { event: AgentEvent }) {
    const text = resolveNoticeText(props.event);
    if (!text) {
        return null;
    }
    return (
        <MessageRow author="event">
            <Text style={styles.noticeText}>{text}</Text>
        </MessageRow>
    );
}

function resolveNoticeText(event: AgentEvent): string | null {
    if (event.type === 'switch') {
        return t('message.switchedToMode', { mode: event.mode });
    }
    if (event.type === 'message') {
        return event.message;
    }
    if (event.type === 'limit-reached') {
        return t('message.usageLimitUntil', { time: formatLimitTime(event.endsAt) });
    }
    return null;
}

function formatLimitTime(endsAt: number): string {
    try {
        // The engine reports the reset point as a Unix timestamp.
        return new Date(endsAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
        return t('message.unknownTime');
    }
}

const styles = StyleSheet.create((theme) => ({
    userMessageBubble: {
        borderWidth: Platform.select({ web: 0, default: StyleSheet.hairlineWidth }),
        overflow: 'hidden',
    },
    copyAction: {
        // No width, so the box shrink-wraps the glyph and its left edge lands on
        // the same x as the markdown text above it. hitSlop carries the touch target.
        alignSelf: 'flex-start',
        height: theme.margins.xl,
        justifyContent: 'center',
    },
    copyActionPressed: {
        opacity: 0.5,
    },
    userCopyTarget: {
        alignItems: 'flex-end',
        maxWidth: '100%',
    },
    noticeText: {
        color: theme.colors.textSecondary,
        fontSize: theme.typography.caption.fontSize,
        lineHeight: theme.typography.caption.lineHeight,
    },
}));
