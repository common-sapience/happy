import { t } from '@/text';
import type { Session } from '@/sync/storageTypes';
import { getAgentProfileName } from '@/utils/agentProfiles';

const TITLE_MAX_LENGTH = 60;

/** One line, collapsed whitespace, cut on a word boundary when it has to be cut. */
export function summarizeOpeningMessage(text: string | null | undefined): string | null {
    const single = text?.replace(/\s+/g, ' ').trim();
    if (!single) return null;
    if (single.length <= TITLE_MAX_LENGTH) return single;
    const cut = single.slice(0, TITLE_MAX_LENGTH);
    const lastSpace = cut.lastIndexOf(' ');
    const head = lastSpace > TITLE_MAX_LENGTH / 2 ? cut.slice(0, lastSpace) : cut;
    return `${head.trimEnd()}…`;
}

/** The last segment of a working directory, which is what a person calls the place. */
export function directoryName(path: string | null | undefined): string | null {
    const normalized = path?.trim().replace(/[/\\]+$/, '');
    if (!normalized) return null;
    return normalized.split(/[/\\]/).pop() || null;
}

/**
 * The name an agent carries in the list, its header and every board that lists agents.
 *
 * The engine generates a title of its own, but nothing forwards it: the only writer of
 * `metadata.summary` is the host's title tool, which the agent calls only if it decides to. So the
 * app needs a name it can always produce, and labelling every agent alike is the one answer that
 * tells the user nothing — hence the opening message, then the profile and the folder it works in.
 */
export function resolveAgentTitle(session: Session): string {
    if (session.metadata?.bot) return session.metadata.bot.name;

    const summary = session.metadata?.summary?.text?.trim();
    if (summary) return summary;

    const opening = summarizeOpeningMessage(session.openingUserText);
    if (opening) return opening;

    const directory = directoryName(session.metadata?.path);
    const profile = getAgentProfileName(session.metadata?.agentProfile);
    if (profile && directory) {
        return t('session.agentInDirectory', { profile, directory });
    }
    return profile ?? directory ?? t('session.newAgent');
}
