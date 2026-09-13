/** The four states an agent can be in on the list (DESK-11, DESK-14). */
export type KitAgentStatus = 'running' | 'idle' | 'waiting' | 'archived';

export type KitAgentStatusPresentation = {
    animated: boolean;
    emphasis: 'strong' | 'normal' | 'muted';
    /** Colour never carries the state on its own; the row always shows the word. */
    labelRequired: true;
};

/**
 * How much of the row the state is allowed to claim. The word and the colour are
 * not decided here: `agentListState` owns both, so the list, the conversation and
 * notifications cannot drift apart.
 */
export function resolveKitAgentStatusPresentation(status: KitAgentStatus): KitAgentStatusPresentation {
    switch (status) {
        case 'running':
            return { animated: true, emphasis: 'normal', labelRequired: true };
        case 'waiting':
            return { animated: true, emphasis: 'strong', labelRequired: true };
        case 'archived':
            return { animated: false, emphasis: 'muted', labelRequired: true };
        default:
            return { animated: false, emphasis: 'normal', labelRequired: true };
    }
}
