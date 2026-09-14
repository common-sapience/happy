/**
 * The unauthenticated welcome screen offers a different pair of entry points per
 * platform, and the screen must not decide that itself: the desktop and web
 * builds have no camera and nothing to scan, so linking from another device is
 * a mobile-only path until platform login replaces both (P-02, DESK-08).
 */

export type WelcomePlatform = 'mobile' | 'desktop';

export type WelcomeActionId = 'createAccount' | 'restoreWithSecretKey' | 'linkOrRestoreAccount';

export type WelcomeActionLabelKey =
    | 'welcome.createAccount'
    | 'welcome.restoreWithSecretKey'
    | 'welcome.linkOrRestoreAccount';

/** The screen that pairs this device with an already signed-in one by QR. */
export const WELCOME_DEVICE_LINK_ROUTE = '/restore';
/** The screen that takes a typed secret key. */
export const WELCOME_SECRET_KEY_ROUTE = '/restore/manual';

export type WelcomeRoute = typeof WELCOME_DEVICE_LINK_ROUTE | typeof WELCOME_SECRET_KEY_ROUTE;

export type WelcomeAction = {
    id: WelcomeActionId;
    labelKey: WelcomeActionLabelKey;
    emphasis: 'primary' | 'secondary';
    /** `null` means the action is handled on the screen itself, not by navigation. */
    route: WelcomeRoute | null;
};

const MOBILE_OPERATING_SYSTEMS = ['ios', 'android'];

export function resolveWelcomePlatform(operatingSystem: string): WelcomePlatform {
    return MOBILE_OPERATING_SYSTEMS.includes(operatingSystem) ? 'mobile' : 'desktop';
}

export function resolveWelcomeActions(platform: WelcomePlatform): WelcomeAction[] {
    if (platform === 'mobile') {
        return [
            {
                id: 'createAccount',
                labelKey: 'welcome.createAccount',
                emphasis: 'primary',
                route: null,
            },
            {
                id: 'linkOrRestoreAccount',
                labelKey: 'welcome.linkOrRestoreAccount',
                emphasis: 'secondary',
                route: WELCOME_DEVICE_LINK_ROUTE,
            },
        ];
    }

    return [
        {
            id: 'restoreWithSecretKey',
            labelKey: 'welcome.restoreWithSecretKey',
            emphasis: 'primary',
            route: WELCOME_SECRET_KEY_ROUTE,
        },
        {
            id: 'createAccount',
            labelKey: 'welcome.createAccount',
            emphasis: 'secondary',
            route: null,
        },
    ];
}
