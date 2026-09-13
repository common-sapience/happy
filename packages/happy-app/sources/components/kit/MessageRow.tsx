import * as React from 'react';
import { LayoutChangeEvent, View, type StyleProp, type ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { layout } from '../layout';
import {
    resolveKitMessageRowMaxWidth,
    resolveKitMessageRowPresentation,
    type KitMessageAuthor,
} from './kitMessageRow';

const stylesheet = StyleSheet.create((theme) => ({
    row: {
        flexDirection: 'column',
        width: '100%',
        maxWidth: layout.maxWidth,
        alignSelf: 'center',
        paddingHorizontal: theme.margins.lg,
    },
    content: {
        maxWidth: '100%',
    },
    flat: {
        paddingVertical: theme.margins.sm,
    },
    muted: {
        opacity: 0.72,
    },
    bubble: {
        backgroundColor: theme.colors.userMessageBackground,
        borderColor: theme.colors.divider,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: theme.borderRadius.xl,
        paddingHorizontal: theme.margins.md,
        paddingVertical: theme.margins.xs,
        maxWidth: '100%',
    },
}));

export type MessageRowProps = {
    author: KitMessageAuthor;
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
};

/**
 * Places one message in the transcript column: the user's on the trailing edge
 * and capped well short of the column width, a reply flat across the whole of it,
 * an activity line centred and muted. The box itself is `MessageBubble`, so a row
 * can carry a copy target or a caption around it without nesting two boxes.
 */
export const MessageRow = React.memo(function MessageRow({ author, children, style }: MessageRowProps) {
    const styles = stylesheet;
    const presentation = resolveKitMessageRowPresentation(author);
    const [rowWidth, setRowWidth] = React.useState(0);

    const handleLayout = React.useCallback((event: LayoutChangeEvent) => {
        setRowWidth(event.nativeEvent.layout.width);
    }, []);

    const constrainedWidth = presentation.maxWidthRatio < 1 && rowWidth > 0
        ? resolveKitMessageRowMaxWidth(rowWidth, presentation.maxWidthRatio)
        : undefined;

    return (
        <View
            onLayout={presentation.maxWidthRatio < 1 ? handleLayout : undefined}
            style={[styles.row, { alignItems: presentation.align }, style]}
        >
            <View
                style={[
                    styles.content,
                    !presentation.bubble && styles.flat,
                    presentation.emphasis === 'muted' && styles.muted,
                    constrainedWidth ? { maxWidth: constrainedWidth } : undefined,
                ]}
            >
                {children}
            </View>
        </View>
    );
});

export type MessageBubbleProps = {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
};

/** The box around a user message. Opaque: a message is content, never glass. */
export const MessageBubble = React.memo(function MessageBubble({ children, style }: MessageBubbleProps) {
    return <View style={[stylesheet.bubble, style]}>{children}</View>;
});
