import { describe, expect, it } from 'vitest';
import {
    WELCOME_DEVICE_LINK_ROUTE,
    WELCOME_SECRET_KEY_ROUTE,
    resolveWelcomeActions,
    resolveWelcomePlatform,
} from './welcomeActions';

describe('resolveWelcomePlatform', () => {
    it('treats only the phone operating systems as mobile', () => {
        expect(resolveWelcomePlatform('ios')).toBe('mobile');
        expect(resolveWelcomePlatform('android')).toBe('mobile');
        expect(resolveWelcomePlatform('web')).toBe('desktop');
        expect(resolveWelcomePlatform('macos')).toBe('desktop');
        expect(resolveWelcomePlatform('windows')).toBe('desktop');
    });
});

describe('resolveWelcomeActions', () => {
    it('offers exactly restore-with-key then create-account on desktop and web', () => {
        const actions = resolveWelcomeActions('desktop');

        expect(actions.map((action) => action.id)).toEqual(['restoreWithSecretKey', 'createAccount']);
        expect(actions.map((action) => action.emphasis)).toEqual(['primary', 'secondary']);
        expect(actions[0].labelKey).toBe('welcome.restoreWithSecretKey');
        expect(actions[0].route).toBe(WELCOME_SECRET_KEY_ROUTE);
        expect(actions[1].route).toBeNull();
    });

    it('never routes desktop or web to the device linking screen', () => {
        const routes = resolveWelcomeActions('desktop').map((action) => action.route);

        expect(routes).not.toContain(WELCOME_DEVICE_LINK_ROUTE);
    });

    it('keeps device linking on mobile, where a camera can scan', () => {
        const actions = resolveWelcomeActions('mobile');

        expect(actions.map((action) => action.id)).toEqual(['createAccount', 'linkOrRestoreAccount']);
        expect(actions[0].emphasis).toBe('primary');
        expect(actions[0].route).toBeNull();
        expect(actions[1].labelKey).toBe('welcome.linkOrRestoreAccount');
        expect(actions[1].route).toBe(WELCOME_DEVICE_LINK_ROUTE);
    });

    it('gives every screen exactly one primary action', () => {
        for (const platform of ['desktop', 'mobile'] as const) {
            const primaries = resolveWelcomeActions(platform).filter((action) => action.emphasis === 'primary');
            expect(primaries).toHaveLength(1);
        }
    });
});
