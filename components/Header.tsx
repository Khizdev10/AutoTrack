
import "@/global.css";
import { useUser, useAuth } from "@clerk/expo";
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from "react";
import { Image, Text, View, TouchableOpacity, Modal } from "react-native";
import { useRouter } from "expo-router";

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

    const handleSignOut = async () => {
        setShowMenu(false);
        try {
            await signOut();
        } catch (err) {
            console.error("Error signing out:", err);
        }
    };

    return (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingVertical: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                {showBack ? (
                    <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: "#F1F5F9", padding: 8, borderRadius: 12 }}>
                        <Ionicons name="arrow-back" size={20} color="#1E293B" />
                    </TouchableOpacity>
                ) : (
                    <View style={{ backgroundColor: "#2563EB", borderRadius: 12, width: 36, height: 36, justifyContent: "center", alignItems: "center" }}>
                        <Ionicons name="car-sport" size={20} color="#fff" />
                    </View>
                )}
                <View style={{ flex: 1 }}>
                    {title ? (
                        <>
                            <Text style={{ fontSize: 16, fontWeight: "700", color: "#1E293B" }} numberOfLines={1}>{title}</Text>
                            {subtitle && <Text style={{ fontSize: 11, color: "#64748B", marginTop: 2 }} numberOfLines={1}>{subtitle}</Text>}
                        </>
                    ) : (
                        <Text style={{ fontSize: 20, fontWeight: "800", color: "#111827", letterSpacing: -0.5 }}>
                            Auto<Text style={{ color: "#2563EB" }}>Track</Text>
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
                                style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: "#E2E8F0" }}
                            />
                        ) : (
                            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#E2E8F0", justifyContent: "center", alignItems: "center" }}>
                                <Ionicons name="person" size={22} color="#475569" />
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
                    style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 }}
                >
                    <TouchableOpacity 
                        activeOpacity={1}
                        style={{ backgroundColor: "#fff", borderRadius: 24, padding: 24, width: "100%", maxWidth: 320, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 20, elevation: 10, alignItems: "center" }}
                    >
                        {user?.imageUrl ? (
                            <Image
                                source={{ uri: user.imageUrl }}
                                style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: "#E2E8F0", marginBottom: 16 }}
                            />
                        ) : (
                            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: "#E2E8F0", justifyContent: "center", alignItems: "center", marginBottom: 16 }}>
                                <Ionicons name="person" size={48} color="#475569" />
                            </View>
                        )}

                        <Text style={{ fontSize: 18, fontWeight: "800", color: "#1E293B", textAlign: "center" }}>
                            {user?.fullName || "User Profile"}
                        </Text>
                        <Text style={{ fontSize: 13, color: "#64748B", textAlign: "center", marginTop: 4, marginBottom: 24 }}>
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
                                style={{ backgroundColor: "#F1F5F9", paddingVertical: 14, borderRadius: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
                            >
                                <Ionicons name="people-outline" size={18} color="#475569" />
                                <Text style={{ color: "#475569", fontWeight: "700", fontSize: 15 }}>Switch Account</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                onPress={() => setShowMenu(false)}
                                style={{ paddingVertical: 14, alignItems: "center" }}
                            >
                                <Text style={{ color: "#94A3B8", fontWeight: "600", fontSize: 14 }}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </View>
    );
};

export default Header;
