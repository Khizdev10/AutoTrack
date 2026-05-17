
import "@/global.css";
import { useUser } from "@clerk/expo";
import { Ionicons } from '@expo/vector-icons';
import { Image, Text, View } from "react-native";

const Header = () => {
    const { user } = useUser();
    return (
        <View className="flex-row items-center justify-between px-6 py-4 bg-white">
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ backgroundColor: "#2563EB", borderRadius: 12, width: 36, height: 36, justifyContent: "center", alignItems: "center" }}>
                    <Ionicons name="car-sport" size={20} color="#fff" />
                </View>
                <Text style={{ fontSize: 20, fontWeight: "800", color: "#111827", letterSpacing: -0.5 }}>
                    Auto<Text style={{ color: "#2563EB" }}>Track</Text>
                </Text>
            </View>

            <View className="flex-row items-center">
                {user?.imageUrl ? (
                    <Image
                        source={{ uri: user.imageUrl }}
                        className="w-10 h-10 rounded-full border border-gray-300"
                    />
                ) : (
                    <View className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden border border-gray-300">
                        <Ionicons name="person" size={28} color="#475569" className="mt-1 ml-1" />
                    </View>
                )}
            </View>
        </View>
    )
}

export default Header;
