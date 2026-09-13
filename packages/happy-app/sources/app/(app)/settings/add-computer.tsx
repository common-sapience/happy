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
            Modal.alert(
                'That code does not look right',
                'Copy the code exactly as the other computer shows it, then paste it here.',
            );
            return;
        }
        await connectWithUrl(url);
    }, [code, connectWithUrl]);

    return (
        <ItemList
            containerStyle={{ paddingTop: Platform.OS === 'ios' ? MOBILE_GLASS_HEADER_HEIGHT : 0 }}
            keyboardShouldPersistTaps="handled"
        >
            <ItemGroup title="On the other computer">
                <Item
                    title="Open this app and choose to join an account"
                    subtitle="It will show a one-time code and wait."
                    subtitleLines={0}
                    showChevron={false}
                />
            </ItemGroup>

            <ItemGroup
                title="Code from the other computer"
                footer="The code works once. If it stops working, let the other computer show a new one."
            >
                <View style={{ paddingHorizontal: 16, paddingVertical: 14, gap: 12 }}>
                    <TextInput
                        value={code}
                        onChangeText={setCode}
                        placeholder="Paste the code here"
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
                            fontFamily: 'IBMPlexMono-Regular',
                            fontSize: 13,
                            textAlignVertical: 'top',
                        }}
                    />
                    <RoundButton
                        title={isLoading ? 'Adding the computer…' : 'Add this computer'}
                        size="large"
                        onPress={approve}
                        loading={isLoading}
                        disabled={isLoading || code.trim().length === 0}
                    />
                </View>
            </ItemGroup>

            {Platform.OS !== 'web' && (
                <ItemGroup footer="Phones can read the code from the other computer's screen instead of typing it.">
                    <Item
                        title="Scan the code instead"
                        onPress={connectAccount}
                        disabled={isLoading}
                        showChevron={false}
                    />
                </ItemGroup>
            )}

            <ItemGroup title="What this does">
                <Item
                    title="The other computer joins this account"
                    subtitle="It can then run agents for you, and it appears in the list of computers on the account page. Remove it there whenever you want."
                    subtitleLines={0}
                    showChevron={false}
                />
            </ItemGroup>
        </ItemList>
    );
}
