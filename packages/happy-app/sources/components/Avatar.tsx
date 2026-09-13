import * as React from "react";
import { View } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { Image } from "expo-image";
import { AvatarBrutalist } from "./AvatarBrutalist";
import { useUnistyles } from 'react-native-unistyles';

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

    return <AvatarBrutalist {...avatarProps} size={size} />;
});
