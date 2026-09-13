import React from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { ItemGroup } from '@/components/ItemGroup';
import { ItemList } from '@/components/ItemList';
import { RelayAddressEntry } from '@/components/RelayAddressEntry';
import { t } from '@/text';
import { StyleSheet } from 'react-native-unistyles';

const stylesheet = StyleSheet.create(() => ({
    keyboardAvoidingView: {
        flex: 1,
    },
    itemListContainer: {
        flex: 1,
    },
}));

export default function RelayConfigScreen() {
    const styles = stylesheet;

    return (
        <>
            <Stack.Screen
                options={{
                    headerShown: true,
                    headerTitle: t('relay.title'),
                    headerBackTitle: t('common.back'),
                }}
            />

            <KeyboardAvoidingView
                style={styles.keyboardAvoidingView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ItemList style={styles.itemListContainer}>
                    <ItemGroup footer={t('relay.footer')}>
                        <RelayAddressEntry variant="settings" />
                    </ItemGroup>
                </ItemList>
            </KeyboardAvoidingView>
        </>
    );
}
