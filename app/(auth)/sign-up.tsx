import { useOAuth, useSignUp } from "@clerk/expo";
import * as Linking from "expo-linking";
import { type Href, Link, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React from "react";
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

WebBrowser.maybeCompleteAuthSession();

export default function SignUp() {
    const { signUp, errors, fetchStatus } = useSignUp();
    const router = useRouter();

    const { startOAuthFlow } = useOAuth({ strategy: "oauth_google" });

    const [emailAddress, setEmailAddress] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [code, setCode] = React.useState("");

    // ── Google OAuth ──────────────────────────────────────────────────────────
    const handleGoogleSignUp = async () => {
        try {
            const { createdSessionId, setActive } = await startOAuthFlow({
                redirectUrl: Linking.createURL("/", { scheme: "autotrack" }),
            });
            if (createdSessionId) {
                await setActive!({ session: createdSessionId });
                router.replace("/(tabs)");
            }
        } catch (err: any) {
            console.error("Google OAuth error:", err?.message ?? err);
            if (err?.errors) console.error("Clerk errors:", JSON.stringify(err.errors, null, 2));
        }
    };

    // ── Email / password ──────────────────────────────────────────────────────
    const handleSubmit = async () => {
        const { error } = await signUp.password({ emailAddress, password });
        if (error) {
            console.error(JSON.stringify(error, null, 2));
            return;
        }
        await signUp.verifications.sendEmailCode();
    };

    const handleVerify = async () => {
        await signUp.verifications.verifyEmailCode({ code });
        if (signUp.status === "complete") {
            await signUp.finalize({
                navigate: ({ session, decorateUrl }) => {
                    if (session?.currentTask) {
                        console.log(session?.currentTask);
                        return;
                    }
                    const url = decorateUrl("/");
                    if (!url.startsWith("http")) router.replace(url as Href);
                },
            });
        } else {
            console.error("Sign-up not complete:", signUp);
        }
    };

    // ── Email verification step ───────────────────────────────────────────────
    if (
        signUp.status === "missing_requirements" &&
        signUp.unverifiedFields?.includes("email_address") &&
        signUp.missingFields?.length === 0
    ) {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>Check your email</Text>
                <Text style={styles.subtitle}>We sent a code to {emailAddress}</Text>
                <TextInput
                    style={styles.input}
                    value={code}
                    placeholder="6-digit code"
                    placeholderTextColor="#888"
                    onChangeText={setCode}
                    keyboardType="numeric"
                />
                {errors?.fields?.code && (
                    <Text style={styles.error}>{errors.fields.code.message}</Text>
                )}
                <Pressable
                    style={({ pressed }) => [
                        styles.button,
                        fetchStatus === "fetching" && styles.buttonDisabled,
                        pressed && styles.buttonPressed,
                    ]}
                    onPress={handleVerify}
                    disabled={fetchStatus === "fetching"}
                >
                    <Text style={styles.buttonText}>
                        {fetchStatus === "fetching" ? "Verifying…" : "Verify"}
                    </Text>
                </Pressable>
                <Pressable
                    style={({ pressed }) => [styles.linkButton, pressed && styles.buttonPressed]}
                    onPress={() => signUp.verifications.sendEmailCode()}
                >
                    <Text style={styles.linkText}>Resend code</Text>
                </Pressable>
            </View>
        );
    }

    // ── Main sign-up screen ───────────────────────────────────────────────────
    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <ScrollView
                contentContainerStyle={styles.container}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={styles.title}>Create account</Text>
                <Text style={styles.subtitle}>Start tracking with AutoTrack</Text>

                {/* ── Google button ── */}
                <Pressable
                    style={({ pressed }) => [
                        styles.googleButton,
                        pressed && styles.buttonPressed,
                    ]}
                    onPress={handleGoogleSignUp}
                >
                    <View style={styles.googleIconBox}>
                        <Text style={styles.googleG}>G</Text>
                    </View>
                    <Text style={styles.googleButtonText}>Continue with Google</Text>
                </Pressable>

                {/* ── Divider ── */}
                <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>or</Text>
                    <View style={styles.dividerLine} />
                </View>

                <Text style={styles.label}>Email</Text>
                <TextInput
                    style={styles.input}
                    autoCapitalize="none"
                    value={emailAddress}
                    placeholder="you@example.com"
                    placeholderTextColor="#888"
                    onChangeText={setEmailAddress}
                    keyboardType="email-address"
                />
                {errors?.fields?.emailAddress && (
                    <Text style={styles.error}>{errors.fields.emailAddress.message}</Text>
                )}

                <Text style={styles.label}>Password</Text>
                <TextInput
                    style={styles.input}
                    value={password}
                    placeholder="Create a password"
                    placeholderTextColor="#888"
                    secureTextEntry
                    onChangeText={setPassword}
                />
                {errors?.fields?.password && (
                    <Text style={styles.error}>{errors.fields.password.message}</Text>
                )}

                <Pressable
                    style={({ pressed }) => [
                        styles.button,
                        (!emailAddress || !password || fetchStatus === "fetching") &&
                        styles.buttonDisabled,
                        pressed && styles.buttonPressed,
                    ]}
                    onPress={handleSubmit}
                    disabled={!emailAddress || !password || fetchStatus === "fetching"}
                >
                    <Text style={styles.buttonText}>
                        {fetchStatus === "fetching" ? "Creating account…" : "Sign up"}
                    </Text>
                </Pressable>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Already have an account? </Text>
                    <Link href="/(auth)/sign-in">
                        <Text style={styles.linkText}>Sign in</Text>
                    </Link>
                </View>

                {/* Required by Clerk for bot protection */}
                <View nativeID="clerk-captcha" />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        padding: 24,
        paddingTop: 60,
        backgroundColor: "#fff",
        gap: 12,
    },
    title: {
        fontSize: 28,
        fontWeight: "700",
        color: "#111",
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 15,
        color: "#666",
        marginBottom: 4,
    },
    label: {
        fontSize: 13,
        fontWeight: "600",
        color: "#333",
        marginBottom: -4,
    },
    input: {
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 10,
        padding: 14,
        fontSize: 16,
        backgroundColor: "#fafafa",
        color: "#111",
    },
    button: {
        backgroundColor: "#4976fb",
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: "center",
        marginTop: 8,
    },
    buttonPressed: { opacity: 0.75 },
    buttonDisabled: { opacity: 0.45 },
    buttonText: {
        color: "#fff",
        fontWeight: "700",
        fontSize: 16,
    },
    googleButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1.5,
        borderColor: "#ddd",
        borderRadius: 10,
        paddingVertical: 13,
        paddingHorizontal: 16,
        backgroundColor: "#fff",
        gap: 10,
        marginTop: 4,
    },
    googleIconBox: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
    },
    googleG: {
        fontSize: 16,
        fontWeight: "700",
        color: "#4285F4",
    },
    googleButtonText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#111",
    },
    divider: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginVertical: 4,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: "#e5e5e5",
    },
    dividerText: {
        fontSize: 13,
        color: "#888",
    },
    linkButton: {
        alignItems: "center",
        paddingVertical: 8,
    },
    linkText: {
        color: "#4976fb",
        fontWeight: "600",
        fontSize: 15,
    },
    footer: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginTop: 16,
    },
    footerText: {
        color: "#555",
        fontSize: 14,
    },
    error: {
        color: "#d32f2f",
        fontSize: 12,
        marginTop: -6,
    },
});
