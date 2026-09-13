/**
 * Folds the composer's extra instructions into the first message.
 *
 * DESK-10 asks for "an addition to the system prompt" on a new agent, and
 * ENG-17 puts that addition in the agent profile. The daemon's spawn request has
 * no field for it yet (`spawn-happy-session` takes directory, agent and
 * `agentProfile` only), and the app must not write the engine's profile files
 * itself — the host owns them. So until the host exposes a per-session
 * instruction field, the addition is sent as the opening of the first message,
 * which reaches the same model in the same turn.
 *
 * It is deliberately visible in the conversation rather than hidden: the user
 * wrote it, and an instruction the agent is following should be readable.
 */
export function buildFirstMessage({ prompt, systemPromptAddition }: {
    prompt: string;
    systemPromptAddition: string | null | undefined;
}): string {
    const instructions = systemPromptAddition?.trim() ?? '';
    const body = prompt.trim();
    if (!instructions) {
        return body;
    }
    if (!body) {
        return instructions;
    }
    return `${instructions}\n\n${body}`;
}
