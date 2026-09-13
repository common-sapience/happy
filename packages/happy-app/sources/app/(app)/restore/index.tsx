import React, { useState, useEffect, useRef } from 'react';
import { Platform, View, Text, TextInput, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { RoundButton } from '@/components/RoundButton';
import { Typography } from '@/constants/Typography';
import * as Clipboard from 'expo-clipboard';
import { encodeBase64 } from '@/encryption/base64';
import { generateAuthKeyPair, authQRStart } from '@/auth/authQRStart';
import { authQRWait } from '@/auth/authQRWait';
import { layout } from '@/components/layout';
import { Modal } from '@/modal';
import { t } from '@/text';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { QRCode } from '@/components/qr/QRCode';
import { MobileGlassSurface } from '@/components/MobileGlass';

const stylesheet = StyleSheet.create((theme) => ({
    scrollView: {
        flex: 1,
        backgroundColor: Platform.select({ web: theme.colors.surface, default: 'transparent' }),
    },
    container: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    contentWrapper: {
        width: '100%',
        maxWidth: layout.maxWidth,
        paddingVertical: 24,
    },
    instructionText: {
        fontSize: 20,
        color: theme.colors.text,
        marginBottom: 24,
        ...Typography.default(),
    },
    secondInstructionText: {
        fontSize: 16,
        color: theme.colors.textSecondary,
        marginBottom: 20,
        marginTop: 30,
        ...Typography.default(),
    },
    qrInstructions: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        marginBottom: 16,
        lineHeight: 22,
        textAlign: 'center',
        ...Typography.default(),
    },
    textInput: {
        backgroundColor: Platform.select({ web: theme.colors.input.background, default: theme.colors.glass.backgroundSubtle }),
        padding: 16,
        borderRadius: 8,
        marginBottom: 24,
        fontFamily: 'IBMPlexMono-Regular',
        fontSize: 14,
        minHeight: 120,
        textAlignVertical: 'top',
        color: theme.colors.input.text,
    },
    codeLabel: {
        fontSize: 13,
        color: theme.colors.textSecondary,
        marginBottom: 8,
        textAlign: 'center',
        ...Typography.default(),
    },
    code: {
        fontSize: 13,
        lineHeight: 20,
        color: theme.colors.text,
        textAlign: 'center',
        ...Typography.mono(),
    },
}));

export default function Restore() {
    const { theme } = useUnistyles();
    const styles = stylesheet;
    const auth = useAuth();
    const router = useRouter();
    const [restoreKey, setRestoreKey] = useState('');
    const [isWaitingForAuth, setIsWaitingForAuth] = useState(false);
    const [authReady, setAuthReady] = useState(false);
    const [waitingDots, setWaitingDots] = useState(0);
    const isCancelledRef = useRef(false);

    // Memoize keypair generation to prevent re-creating on re-renders
    const keypair = React.useMemo(() => generateAuthKeyPair(), []);
    const requestCode = React.useMemo(() => encodeBase64(keypair.publicKey, 'base64url'), [keypair]);
    const [codeCopied, setCodeCopied] = useState(false);

    const handleCopyCode = React.useCallback(async () => {
        await Clipboard.setStringAsync(requestCode);
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2000);
    }, [requestCode]);

    // Start QR authentication when component mounts
    useEffect(() => {
        const startQRAuth = async () => {
            try {
                setIsWaitingForAuth(true);

                // Send authentication request
                const success = await authQRStart(keypair);
                if (!success) {
                    Modal.alert(t('common.error'), t('errors.authenticationFailed'));
                    setIsWaitingForAuth(false);
                    return;
                }

                setAuthReady(true);

                // Start waiting for authentication
                const credentials = await authQRWait(
                    keypair,
                    (dots) => setWaitingDots(dots),
                    () => isCancelledRef.current
                );

                if (credentials && !isCancelledRef.current) {
                    // Convert secret bytes to base64url string for login
                    const secretString = encodeBase64(credentials.secret, 'base64url');
                    await auth.login(credentials.token, secretString);
                    if (!isCancelledRef.current) {
                        router.back();
                    }
                } else if (!isCancelledRef.current) {
                    Modal.alert(t('common.error'), t('errors.authenticationFailed'));
                }

            } catch (error) {
                if (!isCancelledRef.current) {
                    console.error('QR Auth error:', error);
                    Modal.alert(t('common.error'), t('errors.authenticationFailed'));
                }
            } finally {
                if (!isCancelledRef.current) {
                    setIsWaitingForAuth(false);
                    setAuthReady(false);
                }
            }
        };

        startQRAuth();

        // Cleanup function
        return () => {
            isCancelledRef.current = true;
        };
    }, [keypair]);

    return (
        <ScrollView style={styles.scrollView} contentContainerStyle={{ flexGrow: 1 }}>
            <View style={styles.container}>

                {/* DESK-06: this computer is the one asking to join. A computer already signed in
                    approves it — by reading the code below, since desktops have no camera. */}
                <View style={{justifyContent: 'flex-end' }}>
                    <Text style={styles.secondInstructionText}>
                        On a computer or phone that is already signed in:{'\n'}
                        1. Open the account page{'\n'}
                        2. Under Computers, choose "Add a computer"{'\n'}
                        3. Paste the code below, or scan this square
                    </Text>
                </View>
                {authReady && (
                    <Pressable onPress={handleCopyCode} style={{ width: '100%', maxWidth: layout.maxWidth, paddingBottom: 24 }}>
                        <Text style={styles.codeLabel}>
                            {codeCopied ? 'Code copied' : 'Your one-time code (tap to copy)'}
                        </Text>
                        <Text style={styles.code} selectable>
                            {requestCode}
                        </Text>
                    </Pressable>
                )}
                {!authReady && (
                    <MobileGlassSurface intensity={68} style={{ width: 200, height: 200, backgroundColor: Platform.select({ android: theme.colors.glass.backgroundStrong, default: 'transparent' }), alignItems: 'center', justifyContent: 'center', borderRadius: 24, overflow: 'hidden', borderWidth: 0.5, borderColor: theme.colors.glass.border }}>
                        <ActivityIndicator size="small" color={theme.colors.text} />
                    </MobileGlassSurface>
                )}
                {authReady && (
                    <QRCode
                        data={'happy:///account?' + requestCode}
                        size={300}
                        foregroundColor={'black'}
                        backgroundColor={'white'}
                    />
                )}
                <View style={{ flexGrow: 4, paddingTop: 30 }}>
                    <RoundButton title="Restore with Secret Key Instead" display='inverted' onPress={() => {
                        router.push('/restore/manual');
                    }} />
                </View>
            </View>
        </ScrollView>
    );
}
