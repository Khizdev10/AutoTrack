
import "@/global.css";
import { useUser } from "@clerk/expo";
import { Ionicons } from '@expo/vector-icons';
import { Image, Text, View } from "react-native";

const Header = () => {
    const { user } = useUser();
    return (
        <View className="flex-row items-center justify-between px-6 py-4 bg-white">
            <View className="flex-row items-center">
                <Ionicons name="car" size={28} color="#2563eb" />
                <Text className="text-xl font-bold text-gray-900 ml-2">DriveTrack</Text>
            </View>
            <View className="flex-row items-center">
                <Ionicons name="search-outline" size={24} color="black" className="mr-4" />
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
