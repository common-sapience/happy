/**
 * A settings row's leading glyph carries a tone, not a colour: the accent marks
 * the rows that lead somewhere, and the rest stay neutral so the list reads as
 * one block (DESK-19).
 */
export type KitSettingsRowTone = 'neutral' | 'accent' | 'destructive' | 'warning' | 'success';

export type KitSettingsRowTokens = {
    text: string;
    secondary: string;
    accent: string;
    destructive: string;
    warning: string;
    success: string;
};

export function resolveKitSettingsRowIconColor(
    tone: KitSettingsRowTone,
    tokens: KitSettingsRowTokens,
): string {
    switch (tone) {
        case 'accent':
            return tokens.accent;
        case 'destructive':
            return tokens.destructive;
        case 'warning':
            return tokens.warning;
        case 'success':
            return tokens.success;
        default:
            return tokens.secondary;
    }
}

export function resolveKitSettingsRowTitleColor(
    tone: KitSettingsRowTone,
    tokens: KitSettingsRowTokens,
): string {
    return tone === 'destructive' ? tokens.destructive : tokens.text;
}
