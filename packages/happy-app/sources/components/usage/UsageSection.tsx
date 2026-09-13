import * as React from 'react';
import { Item } from '@/components/Item';
import { ItemGroup } from '@/components/ItemGroup';
import { openExternalUrl } from '@/utils/openExternalUrl';
import {
    fetchPlatformUsage,
    resolvePlatformUsageConfig,
    type PlatformUsageResult,
} from './platformUsage';

/**
 * DESK-13: the usage board of the account page.
 *
 * Everything shown here is the platform's own answer. Nothing is totalled on this end and nothing is
 * asked of the relay (RULE-03, DESK-07); when the platform has no query to call, the board is a link
 * to the platform console and says so in one line.
 */

function formatAmount(amount: number): string {
    return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

function formatBalance(balance: { amount: number; currency: string }): string {
    return `${formatAmount(balance.amount)} ${balance.currency}`;
}

function formatPeriod(period: { start: string; end: string } | null): string | undefined {
    if (!period) return undefined;
    return `${period.start} to ${period.end}`;
}

export const UsageSection = React.memo(function UsageSection() {
    const config = React.useMemo(() => resolvePlatformUsageConfig(), []);
    const [result, setResult] = React.useState<PlatformUsageResult | null>(null);

    React.useEffect(() => {
        let cancelled = false;
        void fetchPlatformUsage(config).then((next) => {
            if (!cancelled) setResult(next);
        });
        return () => { cancelled = true; };
    }, [config]);

    if (result === null) {
        return (
            <ItemGroup title="Usage">
                <Item title="Reading your usage from the platform" loading showChevron={false} />
            </ItemGroup>
        );
    }

    if (result.state === 'usage') {
        const { usage } = result;
        return (
            <ItemGroup title="Usage" footer="These numbers come from the platform that bills you.">
                {usage.balance && (
                    <Item
                        title="Balance left"
                        detail={formatBalance(usage.balance)}
                        subtitle={formatPeriod(usage.period)}
                        showChevron={false}
                    />
                )}
                {usage.items.map((item) => (
                    <Item
                        key={item.label}
                        title={item.label}
                        detail={item.unit ? `${formatAmount(item.amount)} ${item.unit}` : formatAmount(item.amount)}
                        showChevron={false}
                    />
                ))}
                {config.consoleUrl && (
                    <Item
                        title="Open the platform console"
                        subtitle="Invoices, payment and the full history live there"
                        onPress={() => void openExternalUrl(config.consoleUrl!)}
                        showChevron={false}
                    />
                )}
            </ItemGroup>
        );
    }

    return (
        <ItemGroup title="Usage" footer="Usage and balance are kept by the platform, not by this app.">
            {config.consoleUrl ? (
                <Item
                    title="See your usage on the platform"
                    subtitle="Opens the platform console in your browser"
                    onPress={() => void openExternalUrl(config.consoleUrl!)}
                    showChevron={false}
                />
            ) : (
                <Item
                    title="Usage is shown on the platform"
                    subtitle="Sign in to the platform that issued your API key to see usage and balance."
                    showChevron={false}
                />
            )}
        </ItemGroup>
    );
});
