import { useOAuth, useSignIn } from "@clerk/expo";
import * as Linking from "expo-linking";
import { type Href, Link, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
import { useWarmUpBrowser } from "../../hooks/useWarmUpBrowser";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    ActivityIndicator,
} from "react-native";

// Required so the auth session closes properly after OAuth redirect
WebBrowser.maybeCompleteAuthSession();

export default function SignIn() {
    useWarmUpBrowser();
    const { signIn, errors, fetchStatus } = useSignIn();
    const router = useRouter();

    const { startOAuthFlow } = useOAuth({ strategy: "oauth_google" });

    const [emailAddress, setEmailAddress] = useState("");
    const [password, setPassword] = useState("");
    const [code, setCode] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    // ── Google OAuth ──────────────────────────────────────────────────────────
    const handleGoogleSignIn = async () => {
        try {
            const { createdSessionId, setActive } = await startOAuthFlow({
                redirectUrl: Linking.createURL("/", __DEV__ ? undefined : { scheme: "autotrack" }),
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
            <LinearGradient colors={["#F8FAFC", "#EEF2F6"]} style={{ flex: 1 }}>
                <View style={styles.mfaContainer}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="shield-checkmark" size={32} color="#2563EB" />
                    </View>
                    <Text style={styles.title}>Verify your account</Text>
                    <Text style={styles.subtitle}>Enter the code sent to your email factor</Text>
                    
                    <View style={styles.inputContainer}>
                        <Ionicons name="key-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            value={code}
                            placeholder="Enter verification code"
                            placeholderTextColor="#94A3B8"
                            onChangeText={setCode}
                            keyboardType="numeric"
                        />
                    </View>
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
            </LinearGradient>
        );
    }

    // ── Main sign-in screen ───────────────────────────────────────────────────
    return (
        <LinearGradient colors={["#F8FAFC", "#EFF6FF"]} style={{ flex: 1 }}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.container}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.logoCircle}>
                            <Ionicons name="car-sport" size={36} color="#2563EB" />
                        </View>
                        <Text style={styles.title}>AutoTrack</Text>
                        <Text style={styles.subtitle}>Log back in to manage your vehicles</Text>
                    </View>

                    {/* Google button */}
                    <Pressable
                        style={({ pressed }) => [
                            styles.googleButton,
                            pressed && styles.buttonPressed,
                        ]}
                        onPress={handleGoogleSignIn}
                    >
                        <Ionicons name="logo-google" size={18} color="#000" style={{ marginRight: 8 }} />
                        <Text style={styles.googleButtonText}>Continue with Google</Text>
                    </Pressable>

                    {/* Divider */}
                    <View style={styles.divider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>or email sign in</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    {/* Form Fields */}
                    <View style={styles.form}>
                        <Text style={styles.label}>Email Address</Text>
                        <View style={styles.inputContainer}>
                            <Ionicons name="mail-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                autoCapitalize="none"
                                value={emailAddress}
                                placeholder="you@example.com"
                                placeholderTextColor="#94A3B8"
                                onChangeText={setEmailAddress}
                                keyboardType="email-address"
                            />
                        </View>
                        {errors?.fields?.identifier && (
                            <Text style={styles.error}>{errors.fields.identifier.message}</Text>
                        )}

                        <Text style={styles.label}>Password</Text>
                        <View style={styles.inputContainer}>
                            <Ionicons name="lock-closed-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                value={password}
                                placeholder="Enter your password"
                                placeholderTextColor="#94A3B8"
                                secureTextEntry={!showPassword}
                                onChangeText={setPassword}
                            />
                            <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color="#94A3B8" />
                            </Pressable>
                        </View>
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
                            {fetchStatus === "fetching" ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text style={styles.buttonText}>Sign In</Text>
                            )}
                        </Pressable>
                    </View>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Don't have an account? </Text>
                        <Link href="/(auth)/sign-up">
                            <Text style={styles.linkText}>Sign up</Text>
                        </Link>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        padding: 24,
        paddingTop: Platform.OS === "ios" ? 80 : 60,
        justifyContent: "center",
    },
    mfaContainer: {
        flex: 1,
        padding: 24,
        justifyContent: "center",
        alignItems: "center",
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: "#EFF6FF",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 24,
        borderWidth: 1,
        borderColor: "#DBEAFE",
    },
    header: {
        alignItems: "center",
        marginBottom: 32,
    },
    logoCircle: {
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: "#fff",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 16,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
        borderWidth: 1,
        borderColor: "#F1F5F9",
    },
    title: {
        fontSize: 28,
        fontWeight: "800",
        color: "#0F172A",
        textAlign: "center",
    },
    subtitle: {
        fontSize: 14,
        color: "#64748B",
        textAlign: "center",
        marginTop: 6,
        lineHeight: 20,
    },
    form: {
        gap: 14,
        marginBottom: 20,
    },
    label: {
        fontSize: 13,
        fontWeight: "600",
        color: "#334155",
        marginBottom: -6,
        marginLeft: 4,
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 14,
        paddingHorizontal: 14,
        height: 52,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: "#0F172A",
    },
    eyeButton: {
        padding: 6,
    },
    button: {
        backgroundColor: "#2563EB",
        height: 52,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 12,
        shadowColor: "#2563EB",
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 2,
    },
    buttonPressed: { opacity: 0.85 },
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
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 14,
        height: 52,
        backgroundColor: "#fff",
        shadowColor: "#000",
        shadowOpacity: 0.02,
        shadowRadius: 5,
        elevation: 1,
    },
    googleButtonText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#0F172A",
    },
    divider: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginVertical: 24,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: "#E2E8F0",
    },
    dividerText: {
        fontSize: 13,
        color: "#94A3B8",
        fontWeight: "500",
    },
    linkButton: {
        alignItems: "center",
        paddingVertical: 10,
        width: "100%",
    },
    linkText: {
        color: "#2563EB",
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
        color: "#64748B",
        fontSize: 14,
    },
    error: {
        color: "#EF4444",
        fontSize: 12,
        marginTop: -6,
        marginLeft: 4,
        fontWeight: "500",
    },
});
