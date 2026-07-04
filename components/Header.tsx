import "@/global.css";
import { useUser, useAuth } from "@clerk/expo";
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from "react";
import { Image, Text, View, TouchableOpacity, Modal } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/app/context/ThemeContext";

interface HeaderProps {
    showBack?: boolean;
    title?: string;
    subtitle?: string;
    rightElement?: React.ReactNode;
    hideProfile?: boolean;
}

const Header = ({ showBack, title, subtitle, rightElement, hideProfile }: HeaderProps) => {
    const { user } = useUser();
    const { signOut } = useAuth();
    const [showMenu, setShowMenu] = useState(false);
    const router = useRouter();
    const { colors, theme } = useTheme();

    const handleSignOut = async () => {
        setShowMenu(false);
        try {
            await signOut();
        } catch (err) {
            console.error("Error signing out:", err);
        }
    };

    return (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingVertical: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                {showBack ? (
                    <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: colors.accent, padding: 8, borderRadius: 12 }}>
                        <Ionicons name="arrow-back" size={20} color={colors.text} />
                    </TouchableOpacity>
                ) : (
                    <View style={{ backgroundColor: colors.primary, borderRadius: 12, width: 36, height: 36, justifyContent: "center", alignItems: "center" }}>
                        <Ionicons name="car-sport" size={20} color="#fff" />
                    </View>
                )}
                <View style={{ flex: 1 }}>
                    {title ? (
                        <>
                            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }} numberOfLines={1}>{title}</Text>
                            {subtitle && <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }} numberOfLines={1}>{subtitle}</Text>}
                        </>
                    ) : (
                        <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text, letterSpacing: -0.5 }}>
                            Auto<Text style={{ color: colors.primary }}>Track</Text>
                        </Text>
                    )}
                </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                {rightElement}
                
                {!hideProfile && (
                    <TouchableOpacity onPress={() => setShowMenu(true)} style={{ flexDirection: "row", alignItems: "center" }}>
                        {user?.imageUrl ? (
                            <Image
                                source={{ uri: user.imageUrl }}
                                style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.border }}
                            />
                        ) : (
                            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.border, justifyContent: "center", alignItems: "center" }}>
                                <Ionicons name="person" size={22} color={colors.textMuted} />
                            </View>
                        )}
                    </TouchableOpacity>
                )}
            </View>

            {/* Account Modal */}
            <Modal visible={showMenu} transparent animationType="fade">
                <TouchableOpacity 
                    activeOpacity={1} 
                    onPress={() => setShowMenu(false)}
                    style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 24 }}
                >
                    <TouchableOpacity 
                        activeOpacity={1}
                        style={{ backgroundColor: colors.card, borderRadius: 24, padding: 24, width: "100%", maxWidth: 320, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 20, elevation: 10, alignItems: "center", borderWidth: 1, borderColor: colors.border }}
                    >
                        {user?.imageUrl ? (
                            <Image
                                source={{ uri: user.imageUrl }}
                                style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: colors.border, marginBottom: 16 }}
                            />
                        ) : (
                            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.border, justifyContent: "center", alignItems: "center", marginBottom: 16 }}>
                                <Ionicons name="person" size={48} color={colors.textMuted} />
                            </View>
                        )}

                        <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text, textAlign: "center" }}>
                            {user?.fullName || "User Profile"}
                        </Text>
                        <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: "center", marginTop: 4, marginBottom: 24 }}>
                            {user?.primaryEmailAddress?.emailAddress || ""}
                        </Text>

                        <View style={{ width: "100%", gap: 10 }}>
                            <TouchableOpacity 
                                onPress={handleSignOut}
                                style={{ backgroundColor: "#EF4444", paddingVertical: 14, borderRadius: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
                            >
                                <Ionicons name="log-out-outline" size={18} color="#fff" />
                                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Logout</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                onPress={handleSignOut}
                                style={{ backgroundColor: colors.accent, paddingVertical: 14, borderRadius: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
                            >
                                <Ionicons name="people-outline" size={18} color={colors.text} />
                                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>Switch Account</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                onPress={() => setShowMenu(false)}
                                style={{ paddingVertical: 14, alignItems: "center" }}
                            >
                                <Text style={{ color: colors.textMuted, fontWeight: "600", fontSize: 14 }}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </View>
    );
};

export default Header;
