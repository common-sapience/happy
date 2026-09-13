import * as React from 'react';
// @ts-expect-error react-test-renderer has no declarations in this workspace.
import { act, create } from 'react-test-renderer';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const socketStatus = vi.hoisted(() => ({
    status: 'disconnected' as 'disconnected' | 'connecting' | 'connected' | 'error',
}));

vi.mock('react-native', async () => {
    const ReactModule = await import('react');
    const host = (name: string) => (props: any) => ReactModule.createElement(name, props, props.children);
    return {
        Platform: { OS: 'ios' },
        Pressable: host('Pressable'),
        Text: host('Text'),
        View: host('View'),
    };
});

vi.mock('./navigation/Header', async () => {
    const ReactModule = await import('react');
    return { Header: (props: any) => ReactModule.createElement('Header', props) };
});

vi.mock('@/sync/storage', () => ({
    useSocketStatus: () => socketStatus,
}));

vi.mock('expo-router', () => ({
    useRouter: () => ({ navigate: vi.fn(), push: vi.fn() }),
    useSegments: () => [],
}));

vi.mock('@/sync/serverConfig', () => ({
    getServerInfo: () => ({ isCustom: true, hostname: '192.168.0.108', port: 3005 }),
}));

vi.mock('expo-image', async () => {
    const ReactModule = await import('react');
    return { Image: (props: any) => ReactModule.createElement('Image', props) };
});

vi.mock('react-native-unistyles', () => ({
    StyleSheet: {
        create: (factory: any) => typeof factory === 'function' ? factory({
            borderRadius: { md: 8 },
            colors: {
                groupped: { background: 'background' },
                header: { tint: 'tint' },
                status: {
                    connected: 'connected',
                    connecting: 'connecting',
                    disconnected: 'disconnected',
                    error: 'error',
                    default: 'default',
                },
                surfaceSelected: 'selected',
                textSecondary: 'secondary',
            },
        }) : factory,
        hairlineWidth: 1,
    },
    useUnistyles: () => ({
        theme: {
            colors: {
                groupped: { background: 'background' },
                header: { tint: 'tint' },
            },
        },
    }),
}));

vi.mock('@expo/vector-icons', async () => {
    const ReactModule = await import('react');
    return { Ionicons: (props: any) => ReactModule.createElement('Ionicons', props) };
});

vi.mock('@/constants/Typography', () => ({ Typography: { default: () => ({}) } }));
vi.mock('@/text', () => ({ t: (key: string) => key }));
vi.mock('./ShortcutHints', () => ({
    ShortcutHintBadge: () => null,
    useShortcutHints: () => ({ visible: false }),
}));
vi.mock('./StatusDot', () => ({ StatusDot: () => null }));

import { HomeHeader, HomeHeaderNotAuth } from './HomeHeader';

const originalConsoleError = console.error;

beforeAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.spyOn(console, 'error').mockImplementation((message?: unknown, ...args: unknown[]) => {
        if (typeof message === 'string' && message.startsWith('react-test-renderer is deprecated')) return;
        originalConsoleError(message, ...args);
    });
});

afterAll(() => vi.restoreAllMocks());
afterEach(() => {
    socketStatus.status = 'disconnected';
});

function renderHeader(component: React.ReactElement) {
    let renderer: ReturnType<typeof create>;
    act(() => {
        renderer = create(component);
    });
    return renderer!.root.findByType('Header' as any);
}

describe('HomeHeaderNotAuth', () => {
    it('uses the standard plain mobile title instead of the glass title pill', () => {
        const header = renderHeader(React.createElement(HomeHeaderNotAuth));
        expect(header.props.mobileTitleSurface).toBe('plain');
        expect(header.props.mobileTitleAlignment).toBe('center');
    });
});

describe('HomeHeader', () => {
    it('names the one list the product has, in words the bar typesets itself', () => {
        const header = renderHeader(React.createElement(HomeHeader));
        expect(header.props.title).toBe('sidebar.agentsTitle');
        expect(header.props.mobileTitleSurface).toBe('plain');
        expect(header.props.mobileTitleAlignment).toBe('center');
    });
});

describe('home header connection status', () => {
    it('says nothing about a healthy socket', () => {
        socketStatus.status = 'connected';
        expect(renderHeader(React.createElement(HomeHeader)).props.subtitle).toBeUndefined();
    });

    it.each(['connecting', 'disconnected', 'error'] as const)('reports the %s socket', (status) => {
        socketStatus.status = status;
        expect(renderHeader(React.createElement(HomeHeader)).props.subtitle).toBe(`status.${status}`);
    });

    it('lets a custom server own the secondary line', () => {
        socketStatus.status = 'connected';
        expect(renderHeader(React.createElement(HomeHeaderNotAuth)).props.subtitle).toBe('192.168.0.108:3005');
    });
});
