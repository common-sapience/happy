import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { SettingsRow } from '@/components/kit';
import { ItemGroup } from '@/components/ItemGroup';
import { ItemList } from '@/components/ItemList';
import { useSettingMutable } from '@/sync/storage';
import { useUnistyles } from 'react-native-unistyles';
import { t, getLanguageNativeName, SUPPORTED_LANGUAGES, SUPPORTED_LANGUAGE_CODES, type SupportedLanguage } from '@/text';
import { Modal } from '@/modal';
import { useUpdates } from '@/hooks/useUpdates';
import * as Localization from 'expo-localization';

type LanguageOption = 'auto' | SupportedLanguage;

interface LanguageItem {
    key: LanguageOption;
    title: string;
    subtitle?: string;
}

export default function LanguageSettingsScreen() {
    const { theme } = useUnistyles();
    const [preferredLanguage, setPreferredLanguage] = useSettingMutable('preferredLanguage');
    const { reloadApp } = useUpdates();

    // Get device locale for automatic detection
    const deviceLocale = Localization.getLocales()?.[0]?.languageTag ?? 'en-US';
    const deviceLanguage = deviceLocale.split('-')[0].toLowerCase();
    const detectedLanguageName = deviceLanguage in SUPPORTED_LANGUAGES ? 
                                 getLanguageNativeName(deviceLanguage as keyof typeof SUPPORTED_LANGUAGES) : 
                                 getLanguageNativeName('en');

    // Current selection
    const currentSelection: LanguageOption = preferredLanguage === null ? 'auto' : 
                                           SUPPORTED_LANGUAGE_CODES.includes(preferredLanguage as SupportedLanguage) ? 
                                           preferredLanguage as SupportedLanguage : 'auto';

    // Language options - dynamically generated from supported languages
    const languageOptions: LanguageItem[] = [
        {
            key: 'auto',
            title: t('settingsLanguage.automatic'),
            subtitle: `${t('settingsLanguage.automaticSubtitle')} (${detectedLanguageName})`
        },
        ...SUPPORTED_LANGUAGE_CODES.map(code => ({
            key: code,
            title: getLanguageNativeName(code)
        }))
    ];

    const handleLanguageChange = async (newLanguage: LanguageOption) => {
        if (newLanguage === currentSelection) {
            return; // No change
        }

        // Show confirmation modal
        const confirmed = await Modal.confirm(
            t('settingsLanguage.needsRestart'),
            t('settingsLanguage.needsRestartMessage')
        );

        if (confirmed) {
            // Update the preference
            const newPreference = newLanguage === 'auto' ? null : newLanguage;
            setPreferredLanguage(newPreference);

            // Small delay to ensure setting is saved
            setTimeout(() => {
                reloadApp();
            }, 100);
        }
    };

    return (
        <ItemList style={{ paddingTop: 0 }}>
            <ItemGroup 
                title={t('settingsLanguage.currentLanguage')} 
                footer={t('settingsLanguage.description')}
            >
                {languageOptions.map((option) => (
                    <SettingsRow
                        key={option.key}
                        title={option.title}
                        subtitle={option.subtitle}
                        icon="language-outline"
                        onPress={() => handleLanguageChange(option.key)}
                        trailing={
                            currentSelection === option.key ? (
                                <Ionicons
                                    name="checkmark"
                                    size={theme.iconSize.large}
                                    color={theme.colors.button.primary.background}
                                />
                            ) : null
                        }
                        showChevron={false}
                    />
                ))}
            </ItemGroup>
        </ItemList>
    );
}