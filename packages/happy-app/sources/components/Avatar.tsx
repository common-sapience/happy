import * as React from "react";
import { View } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { Image } from "expo-image";
import { AvatarSkia } from "./AvatarSkia";
import { AvatarGradient } from "./AvatarGradient";
import { AvatarBrutalist } from "./AvatarBrutalist";
import { useSetting } from '@/sync/storage';
import { useUnistyles } from 'react-native-unistyles';
import { normalizeAvatarStyle } from '@/utils/avatarStyle';

export type AvatarBadgeLocation = 'sessionHeader' | 'sessionList' | 'none';

interface AvatarProps {
    bot?: boolean;
    id: string;
    title?: boolean;
    square?: boolean;
    size?: number;
    monochrome?: boolean;
    flavor?: string | null;
    clientId?: string | null;
    /** Where this avatar is rendered; omitted avatars never get a harness badge. */
    badgeLocation?: AvatarBadgeLocation;
    imageUrl?: string | null;
    thumbhash?: string | null;
}

export const Avatar = React.memo((props: AvatarProps) => {
    const { bot, flavor, clientId, badgeLocation = 'none', size = 48, imageUrl, thumbhash, ...avatarProps } = props;
    const avatarStyle = normalizeAvatarStyle(useSetting('avatarStyle'));
    // The black-and-white preference applies to every generated style; a
    // caller passing monochrome explicitly (e.g. offline rows) still wins.
    const monochromeSetting = useSetting('avatarMonochrome');
    if (monochromeSetting) {
        avatarProps.monochrome = true;
    }
    const { theme } = useUnistyles();
    if (bot) {
        return (
            <View style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.surface,
            }}>
                <Ionicons
                    name="hardware-chip-outline"
                    size={Math.round(size * 0.55)}
                    color={avatarProps.monochrome ? theme.colors.textSecondary : theme.colors.text}
                />
            </View>
        );
    }

    // Render custom image if provided
    if (imageUrl) {
        const imageElement = (
            <Image
                source={{ uri: imageUrl, thumbhash: thumbhash || undefined }}
                placeholder={thumbhash ? { thumbhash: thumbhash } : undefined}
                cachePolicy={imageUrl.startsWith('data:') ? 'memory' : 'disk'}
                contentFit="cover"
                style={{
                    width: size,
                    height: size,
                    borderRadius: avatarProps.square ? 0 : size / 2
                }}
            />
        );
        return imageElement;
    }

    // Original generated avatar logic
    // Determine which avatar variant to render
    let AvatarComponent: React.ComponentType<any>;
    if (avatarStyle === 'pixelated') {
        AvatarComponent = AvatarSkia;
    } else if (avatarStyle === 'brutalist') {
        AvatarComponent = AvatarBrutalist;
    } else {
        AvatarComponent = AvatarGradient;
    }

    return <AvatarComponent {...avatarProps} size={size} />;
});
