export type VisibleGitLineChanges = {
    approximate: boolean;
    deletions: number;
    insertions: number;
};

/** Matches happy-desktop's dense-row count formatting. */
export function compactCount(value: number): string {
    const count = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
    if (count < 1_000) return String(count);
    if (count < 5_000) {
        const thousands = Math.round(count / 100) / 10;
        return `${String(thousands)}k`;
    }
    return `${String(Math.round(count / 1_000))}k`;
}
