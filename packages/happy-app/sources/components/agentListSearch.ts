import { create } from 'zustand';

/**
 * What the sidebar's search field is filtering the agent list by. The field and
 * the list live in different trees, so the query is a store rather than a prop,
 * and it is deliberately not persisted: a search is a way of looking at the list
 * right now, not a setting.
 */
export const useAgentListSearch = create<{
    query: string;
    setQuery: (query: string) => void;
}>((set) => ({
    query: '',
    setQuery: (query: string) => set({ query }),
}));

export type AgentSearchable = {
    name: string;
    projectName: string | null;
    workspaceName: string | null;
    path: string | null;
    machineName?: string | null;
};

/**
 * Matches an agent against the search field: its name first, then the places it
 * works in, so looking for a folder finds the agents working there.
 */
export function matchesAgentSearch(agent: AgentSearchable, query: string): boolean {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) {
        return true;
    }
    return [agent.name, agent.projectName, agent.workspaceName, agent.path, agent.machineName]
        .some((field) => typeof field === 'string' && field.toLowerCase().includes(needle));
}
