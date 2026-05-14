import { createClerkSupabaseClient } from "@/app/lib/supabase";
import AddCar from "@/components/AddCar";
import Header from "@/components/Header";
import "@/global.css";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { styled } from "nativewind";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaView);

export default function App() {
  const [cars, setCars] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { getToken } = useAuth();

  const fetchCarData = async () => {
    setIsLoading(true);
    try {
      const token = await getToken({ template: "supabase" });
      if (!token) return;
      const supabase = createClerkSupabaseClient(token);
      const { data, error } = await supabase.from("cars").select("*").order('created_at', { ascending: false });

      if (data) setCars(data);
      if (error) console.error("Error fetching cars:", error);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCarData();
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFC]">
      <Header />
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : cars.length === 0 ? (
        <AddCar onCarAdded={fetchCarData} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} className="px-5 mt-6">
          <View className="mb-6 flex-row justify-between items-center">
            <Text className="text-2xl font-bold text-gray-900">Your Garage</Text>
            <TouchableOpacity 
              className="bg-blue-100 px-4 py-2 rounded-full flex-row items-center"
              onPress={() => setCars([])} // Temporarily allow them to go back to Add Car
            >
              <Ionicons name="add" size={16} color="#2563eb" />
              <Text className="text-blue-600 font-bold text-xs ml-1">ADD CAR</Text>
            </TouchableOpacity>
          </View>

          <View className="gap-y-6 pb-20">
            {cars.map((car, index) => (
              <View key={index} className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm">
                <View className="h-48 w-full bg-black relative">
                  <Image 
                    source={{ uri: car.imageUrl || 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=1000' }} 
                    className="w-full h-full opacity-80" 
                    resizeMode="cover" 
                  />
                  <View className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-full backdrop-blur-md">
                    <Text className="text-white font-bold tracking-widest text-xs">{car.productionYear}</Text>
                  </View>
                </View>
                <View className="p-5">
                  <Text className="text-xl font-extrabold text-gray-900">{car.vehicleMake} {car.modelName}</Text>
                  <View className="flex-row items-center mt-2">
                    <Ionicons name="speedometer-outline" size={16} color="#64748b" />
                    <Text className="text-gray-500 font-medium ml-2">{car.currentMileage?.toLocaleString() || 0} mi</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}