import * as React from 'react';
import { Platform, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Item } from '@/components/Item';
import { ItemGroup } from '@/components/ItemGroup';
import { ItemList } from '@/components/ItemList';
import { RoundButton } from '@/components/RoundButton';
import { MOBILE_GLASS_HEADER_HEIGHT } from '@/components/navigation/headerMetrics';
import { useConnectAccount } from '@/hooks/useConnectAccount';
import { Modal } from '@/modal';
import { useUnistyles } from 'react-native-unistyles';
import { normalizeLoginRequestCode } from '@/components/account/loginRequestCode';
import { Typography } from '@/constants/Typography';
import { t } from '@/text';

/**
 * DESK-06, DESK-16: letting another computer onto this account.
 *
 * The waiting computer shows a one-time code; this screen, on a computer already signed in, approves
 * it (DEV-02). Approval encrypts the account key against that one-time key, which is why the code is
 * checked before anything is encrypted and why a code is only ever good once. Desktops have no
 * camera, so the code is pasted; phones may still scan it.
 */
export default function AddComputerScreen() {
    const { theme } = useUnistyles();
    const router = useRouter();
    const [code, setCode] = React.useState('');
    const { connectAccount, connectWithUrl, isLoading } = useConnectAccount({
        onSuccess: () => router.back(),
    });

    const approve = React.useCallback(async () => {
        const url = normalizeLoginRequestCode(code);
        if (!url) {
            Modal.alert(t('addComputer.badCodeTitle'), t('addComputer.badCodeMessage'));
            return;
        }
        await connectWithUrl(url);
    }, [code, connectWithUrl]);

    return (
        <ItemList
            containerStyle={{ paddingTop: Platform.OS === 'ios' ? MOBILE_GLASS_HEADER_HEIGHT : 0 }}
            keyboardShouldPersistTaps="handled"
        >
            <ItemGroup title={t('addComputer.otherComputer')}>
                <Item
                    title={t('addComputer.otherComputerRow')}
                    subtitle={t('addComputer.otherComputerHint')}
                    subtitleLines={0}
                    showChevron={false}
                />
            </ItemGroup>

            <ItemGroup
                title={t('addComputer.codeTitle')}
                footer={t('addComputer.codeFooter')}
            >
                <View style={{ paddingHorizontal: 16, paddingVertical: 14, gap: 12 }}>
                    <TextInput
                        value={code}
                        onChangeText={setCode}
                        placeholder={t('addComputer.codePlaceholder')}
                        placeholderTextColor={theme.colors.input.placeholder}
                        autoCapitalize="none"
                        autoCorrect={false}
                        multiline
                        editable={!isLoading}
                        style={{
                            backgroundColor: theme.colors.input.background,
                            color: theme.colors.input.text,
                            borderRadius: 8,
                            padding: 14,
                            minHeight: 88,
                            ...Typography.mono(),
                            fontSize: 13,
                            textAlignVertical: 'top',
                        }}
                    />
                    <RoundButton
                        title={isLoading ? t('addComputer.adding') : t('addComputer.add')}
                        size="large"
                        onPress={approve}
                        loading={isLoading}
                        disabled={isLoading || code.trim().length === 0}
                    />
                </View>
            </ItemGroup>

            {Platform.OS !== 'web' && (
                <ItemGroup footer={t('addComputer.scanFooter')}>
                    <Item
                        title={t('addComputer.scan')}
                        onPress={connectAccount}
                        disabled={isLoading}
                        showChevron={false}
                    />
                </ItemGroup>
            )}

            <ItemGroup title={t('addComputer.whatTitle')}>
                <Item
                    title={t('addComputer.whatRow')}
                    subtitle={t('addComputer.whatHint')}
                    subtitleLines={0}
                    showChevron={false}
                />
            </ItemGroup>
        </ItemList>
    );
}
