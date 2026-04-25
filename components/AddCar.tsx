
import { createClerkSupabaseClient } from '@/app/lib/supabase';
import "@/global.css";
import { useAuth } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { styled } from 'nativewind';
import { useEffect, useState } from 'react';
import { Image, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const AddCar = () => {
    const [cars, setCars] = useState<any[]>([]);
    const { getToken } = useAuth();
    const [vehicleMake, setVehicleMake] = useState("");
    const [modelName, setModelName] = useState("");
    const [productionYear, setProductionYear] = useState("");
    const [currentMileage, setCurrentMileage] = useState("");
    const [imageUrl, setImageUrl] = useState('https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=1000');


    useEffect(() => {
        // async function fetchCarData() {
        //     try {
        //         const token = await getToken({ template: 'supabase' });
        //         if (!token) return;
        //         const supabase = createClerkSupabaseClient(token);
        //         const { data, error } = await supabase.from('cars').select('*');

        //         if (data) setCars(data);
        //         if (error) console.error("Error fetching cars:", error);
        //     } catch (err) {
        //         console.error(err);
        //     }
        // }
        // fetchCarData();
    }, [getToken]);

    const saveCarData = async () => {
        try {
            const token = await getToken({ template: 'supabase' });
            if (!token) return;
            const supabase = createClerkSupabaseClient(token);
            const { data, error } = await supabase.from('cars').insert([
                {
                    vehicleMake,
                    modelName,
                    productionYear,
                    currentMileage,
                    imageUrl,
                },
            ]);

            if (data) console.log("Car added successfully:", data);
            if (error) console.error("Error adding car:", error);
        } catch (err) {
            console.error(err);
        }
    };


    const pickImage = async () => {
        // No permissions request is necessary for launching the image library
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'], // Only photos
            allowsEditing: true, // Let the user crop the photo into a square/rectangle
            aspect: [16, 9],     // Aspect ratio (good for banners)
            quality: 1,          // Highest quality
        });

        if (!result.canceled) {
            setImageUrl(result.assets[0].uri); // Update the state with the new image
        }
    };

    const SafeAreaView = styled(RNSafeAreaView);

    return (

        <SafeAreaView className="flex-1 bg-[#F8FAFC]">

            <ScrollView showsVerticalScrollIndicator={false} className="px-5">
                <View className="items-center mt-8">
                    <View className="bg-blue-100 px-4 py-1 rounded-full">
                        <Text className="text-blue-600 font-bold text-[10px] tracking-widest">REGISTRATION</Text>
                    </View>
                    <Text className="text-3xl font-bold text-gray-900 mt-2">Register Your Vehicle</Text>
                    <Text className="text-gray-500 text-center mt-2 px-4">
                        Enter the core details to start tracking performance and maintenance.
                    </Text>
                </View>

                {/* HERO IMAGE CARD */}
                <View className="mt-8 rounded-3xl overflow-hidden h-48 bg-black relative">
                    <Image
                        source={{ uri: imageUrl }}
                        className="w-full h-full opacity-70"
                        resizeMode="cover"
                    />

                    {/* Edit Image Button */}
                    <TouchableOpacity
                        className="absolute top-4 right-4 bg-white/30 p-2 rounded-full"
                        onPress={pickImage}
                    >
                        <Ionicons name="pencil" size={20} color="white" />
                    </TouchableOpacity>
                </View>

                {/* INPUT FIELDS (Mimicking the design) */}
                <View className="mt-8 gap-y-4">
                    <View>
                        <Text className="text-gray-700 font-semibold mb-2">Vehicle Make</Text>
                        <View className="bg-[#F1F5F9] border border-gray-200 rounded-xl flex-row items-center p-4">
                            <Ionicons name="business-outline" size={20} color="#94A3B8" />
                            <TextInput
                                className="ml-3 flex-1 text-gray-900"
                                placeholder="e.g. Porsche"
                                placeholderTextColor="#94A3B8"
                                value={vehicleMake}
                                onChangeText={setVehicleMake}
                            />
                        </View>
                    </View>

                    <View>
                        <Text className="text-gray-700 font-semibold mb-2">Model Name</Text>
                        <View className="bg-[#F1F5F9] border border-gray-200 rounded-xl flex-row items-center p-4">
                            <Ionicons name="git-branch-outline" size={20} color="#94A3B8" />
                            <TextInput
                                className="ml-3 flex-1 text-gray-900"
                                placeholder="e.g. 911 Carrera"
                                placeholderTextColor="#94A3B8"
                                value={modelName}
                                onChangeText={setModelName}
                            />
                        </View>
                    </View>

                    <View>
                        <Text className="text-gray-700 font-semibold mb-2">Production Year</Text>
                        <View className="bg-[#F1F5F9] border border-gray-200 rounded-xl flex-row items-center p-4">
                            <Ionicons name="calendar-outline" size={20} color="#94A3B8" />
                            <TextInput
                                className="ml-3 flex-1 text-gray-900"
                                placeholder="e.g. 2024"
                                placeholderTextColor="#94A3B8"
                                keyboardType="numeric"
                                value={productionYear}
                                onChangeText={setProductionYear}
                            />
                        </View>
                    </View>

                    <View>
                        <Text className="text-gray-700 font-semibold mb-2">Current Mileage</Text>
                        <View className="bg-[#F1F5F9] border border-gray-200 rounded-xl flex-row items-center p-4 justify-between">
                            <View className="flex-row items-center flex-1">
                                <Ionicons name="speedometer-outline" size={20} color="#94A3B8" />
                                <TextInput
                                    className="ml-3 flex-1 text-gray-900"
                                    placeholder="0"
                                    placeholderTextColor="#94A3B8"
                                    keyboardType="numeric"
                                    value={currentMileage}
                                    onChangeText={setCurrentMileage}
                                />
                            </View>
                            <Text className="text-gray-400">mi</Text>
                        </View>
                    </View>

                </View>
                {/* INFO TILES */}
                <View className="mt-6 gap-y-3">
                    <View className="flex-row items-center bg-[#EFF6FF] p-4 rounded-xl">
                        <Ionicons name="shield-checkmark" size={20} color="#2563eb" />
                        <Text className="ml-3 text-gray-700 text-sm">Data is encrypted and stored locally.</Text>
                    </View>
                    <View className="flex-row items-center bg-[#EFF6FF] p-4 rounded-xl">
                        <Ionicons name="sync" size={20} color="#2563eb" />
                        <Text className="ml-3 text-gray-700 text-sm">Automatic service schedule sync.</Text>
                    </View>
                </View>

                {/* BUTTONS */}
                <TouchableOpacity className="bg-black py-5 rounded-2xl mt-8 flex-row justify-center items-center">
                    <Text className="text-white font-bold text-lg mr-2" onPress={saveCarData}>Save Vehicle Details</Text>
                    <Ionicons name="chevron-forward" size={20} color="white" />
                </TouchableOpacity>

                <TouchableOpacity className="py-5 rounded-2xl mt-2 mb-10 border border-gray-200 bg-white mb-40">
                    <Text className="text-gray-900 text-center font-semibold">Cancel</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>

    );
};

export default AddCar;