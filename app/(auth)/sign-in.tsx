import { useOAuth, useSignIn } from "@clerk/expo";
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

// Required so the auth session closes properly after OAuth redirect
WebBrowser.maybeCompleteAuthSession();

export default function SignIn() {
    const { signIn, errors, fetchStatus } = useSignIn();
    const router = useRouter();

    const { startOAuthFlow } = useOAuth({ strategy: "oauth_google" });

    const [emailAddress, setEmailAddress] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [code, setCode] = React.useState("");

    // ── Google OAuth ──────────────────────────────────────────────────────────
    const handleGoogleSignIn = async () => {
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
        const { error } = await signIn.password({ emailAddress, password });
        if (error) {
            console.error(JSON.stringify(error, null, 2));
            return;
        }

        if (signIn.status === "complete") {
            await signIn.finalize({
                navigate: ({ session, decorateUrl }) => {
                    if (session?.currentTask) {
                        console.log(session?.currentTask);
                        return;
                    }
                    const url = decorateUrl("/");
                    if (!url.startsWith("http")) router.replace(url as Href);
                },
            });
        } else if (signIn.status === "needs_client_trust") {
            const emailCodeFactor = signIn.supportedSecondFactors?.find(
                (f) => f.strategy === "email_code"
            );
            if (emailCodeFactor) await signIn.mfa.sendEmailCode();
        } else {
            console.error("Sign-in not complete:", signIn);
        }
    };

    const handleVerify = async () => {
        await signIn.mfa.verifyEmailCode({ code });
        if (signIn.status === "complete") {
            await signIn.finalize({
                navigate: ({ session, decorateUrl }) => {
                    if (session?.currentTask) return;
                    const url = decorateUrl("/");
                    if (!url.startsWith("http")) router.replace(url as Href);
                },
            });
        } else {
            console.error("MFA verify not complete:", signIn);
        }
    };

    // ── MFA screen ────────────────────────────────────────────────────────────
    if (signIn.status === "needs_client_trust") {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>Verify your account</Text>
                <TextInput
                    style={styles.input}
                    value={code}
                    placeholder="Enter verification code"
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
                    <Text style={styles.buttonText}>Verify</Text>
                </Pressable>
                <Pressable
                    style={({ pressed }) => [styles.linkButton, pressed && styles.buttonPressed]}
                    onPress={() => signIn.mfa.sendEmailCode()}
                >
                    <Text style={styles.linkText}>Resend code</Text>
                </Pressable>
                <Pressable
                    style={({ pressed }) => [styles.linkButton, pressed && styles.buttonPressed]}
                    onPress={() => signIn.reset()}
                >
                    <Text style={styles.linkText}>Start over</Text>
                </Pressable>
            </View>
        );
    }

    // ── Main sign-in screen ───────────────────────────────────────────────────
    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <ScrollView
                contentContainerStyle={styles.container}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={styles.title}>Welcome back</Text>
                <Text style={styles.subtitle}>Sign in to AutoTrack</Text>

                {/* ── Google button ── */}
                <Pressable
                    style={({ pressed }) => [
                        styles.googleButton,
                        pressed && styles.buttonPressed,
                    ]}
                    onPress={handleGoogleSignIn}
                >
                    {/* Google "G" colour mark */}
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
                {errors?.fields?.identifier && (
                    <Text style={styles.error}>{errors.fields.identifier.message}</Text>
                )}

                <Text style={styles.label}>Password</Text>
                <TextInput
                    style={styles.input}
                    value={password}
                    placeholder="Enter your password"
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
                        {fetchStatus === "fetching" ? "Signing in…" : "Sign in"}
                    </Text>
                </Pressable>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Don't have an account? </Text>
                    <Link href="/(auth)/sign-up">
                        <Text style={styles.linkText}>Sign up</Text>
                    </Link>
                </View>
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
