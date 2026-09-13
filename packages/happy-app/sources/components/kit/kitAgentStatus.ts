/** The four states an agent can be in on the list (DESK-11, DESK-14). */
export type KitAgentStatus = 'running' | 'idle' | 'waiting' | 'archived';

export type KitAgentStatusTokens = {
    running: string;
    waiting: string;
    idle: string;
    archived: string;
};

export type KitAgentStatusPresentation = {
    dotColor: string;
    animated: boolean;
    emphasis: 'strong' | 'normal' | 'muted';
    /** Colour never carries the state on its own; the row always shows the word. */
    labelRequired: true;
};

export function resolveKitAgentStatusPresentation(
    status: KitAgentStatus,
    tokens: KitAgentStatusTokens,
): KitAgentStatusPresentation {
    switch (status) {
        case 'running':
            return { dotColor: tokens.running, animated: true, emphasis: 'normal', labelRequired: true };
        case 'waiting':
            return { dotColor: tokens.waiting, animated: true, emphasis: 'strong', labelRequired: true };
        case 'archived':
            return { dotColor: tokens.archived, animated: false, emphasis: 'muted', labelRequired: true };
        default:
            return { dotColor: tokens.idle, animated: false, emphasis: 'normal', labelRequired: true };
    }
}
