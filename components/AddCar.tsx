
import { createClerkSupabaseClient } from '@/app/lib/supabase';
import "@/global.css";
import { useAuth } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { styled } from 'nativewind';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

interface AddCarProps {
    onCarAdded: () => void;
    onCancel?: () => void;
}

const SafeAreaView = styled(RNSafeAreaView);

const AddCar = ({ onCarAdded, onCancel }: AddCarProps) => {
    const { getToken, userId } = useAuth();
    const [vehicleMake, setVehicleMake] = useState("");
    const [modelName, setModelName] = useState("");
    const [productionYear, setProductionYear] = useState("");
    const [currentMileage, setCurrentMileage] = useState("");
    const [imageUrl, setImageUrl] = useState('https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?q=80&w=1000');
    const [vin, setVin] = useState("");
    const [nickname, setNickname] = useState("");
    const [fuelRange, setFuelRange] = useState("");
    const [avgConsumption, setAvgConsumption] = useState("");
    const [tirePressure, setTirePressure] = useState("");
    const [isSaving, setIsSaving] = useState(false);


    const saveCarData = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            const token = await getToken({ template: 'supabase' });
            if (!token) return;
            const supabase = createClerkSupabaseClient(token);
            const { error } = await supabase.from('cars').insert([
                {
                    user_id: userId,
                    vehicleMake,
                    modelName,
                    productionYear,
                    currentMileage,
                    imageUrl,
                    vin,
                    nickname,
                    fuel_range: fuelRange ? parseInt(fuelRange) : null,
                    avg_consumption: avgConsumption ? parseFloat(avgConsumption) : null,
                    tire_pressure: tirePressure ? parseInt(tirePressure) : null,
                },
            ]);
            if (!error) {
                console.log("Car added successfully");
                onCarAdded();
            } else {
                console.error("Error adding car:", error);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
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
                                placeholder="e.g. Toyota"
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
                                placeholder="e.g. Corolla"
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
                        <Text className="text-gray-700 font-semibold mb-2">Odometer (km)</Text>
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
                            <Text className="text-gray-400">km</Text>
                        </View>
                    </View>

                    <View>
                        <Text className="text-gray-700 font-semibold mb-2">Nickname (Optional)</Text>
                        <View className="bg-[#F1F5F9] border border-gray-200 rounded-xl flex-row items-center p-4">
                            <Ionicons name="pricetag-outline" size={20} color="#94A3B8" />
                            <TextInput
                                className="ml-3 flex-1 text-gray-900"
                                placeholder="e.g. The Silver Bullet"
                                placeholderTextColor="#94A3B8"
                                value={nickname}
                                onChangeText={setNickname}
                            />
                        </View>
                    </View>

                    <View>
                        <Text className="text-gray-700 font-semibold mb-2">VIN (Optional)</Text>
                        <View className="bg-[#F1F5F9] border border-gray-200 rounded-xl flex-row items-center p-4">
                            <Ionicons name="barcode-outline" size={20} color="#94A3B8" />
                            <TextInput
                                className="ml-3 flex-1 text-gray-900"
                                placeholder="e.g. 1HGCM..."
                                placeholderTextColor="#94A3B8"
                                value={vin}
                                onChangeText={setVin}
                            />
                        </View>
                    </View>

                    <View className="flex-row gap-x-4">
                        <View className="flex-1">
                            <Text className="text-gray-700 font-semibold mb-2">Fuel Range (km) (Optional)</Text>
                            <View className="bg-[#F1F5F9] border border-gray-200 rounded-xl flex-row items-center p-4">
                                <Ionicons name="water-outline" size={20} color="#94A3B8" />
                                <TextInput
                                    className="ml-3 flex-1 text-gray-900"
                                    placeholder="350"
                                    placeholderTextColor="#94A3B8"
                                    keyboardType="numeric"
                                    value={fuelRange}
                                    onChangeText={setFuelRange}
                                />
                            </View>
                        </View>
                        <View className="flex-1">
                            <Text className="text-gray-700 font-semibold mb-2">Avg km/l (Optional)</Text>
                            <View className="bg-[#F1F5F9] border border-gray-200 rounded-xl flex-row items-center p-4">
                                <Ionicons name="leaf-outline" size={20} color="#94A3B8" />
                                <TextInput
                                    className="ml-3 flex-1 text-gray-900"
                                    placeholder="24.5"
                                    placeholderTextColor="#94A3B8"
                                    keyboardType="numeric"
                                    value={avgConsumption}
                                    onChangeText={setAvgConsumption}
                                />
                            </View>
                        </View>
                    </View>

                    <View>
                        <Text className="text-gray-700 font-semibold mb-2">Tire Pressure (Optional)</Text>
                        <View className="bg-[#F1F5F9] border border-gray-200 rounded-xl flex-row items-center p-4">
                            <Ionicons name="disc-outline" size={20} color="#94A3B8" />
                            <TextInput
                                className="ml-3 flex-1 text-gray-900"
                                placeholder="32"
                                placeholderTextColor="#94A3B8"
                                keyboardType="numeric"
                                value={tirePressure}
                                onChangeText={setTirePressure}
                            />
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
                <TouchableOpacity 
                    className="bg-black py-5 rounded-2xl mt-8 flex-row justify-center items-center" 
                    onPress={saveCarData}
                    disabled={isSaving}
                >
                    {isSaving ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <>
                            <Text className="text-white font-bold text-lg mr-2">Save Vehicle Details</Text>
                            <Ionicons name="chevron-forward" size={20} color="white" />
                        </>
                    )}
                </TouchableOpacity>

                {onCancel && (
                    <TouchableOpacity className="py-5 rounded-2xl mt-2 mb-40 border border-gray-200 bg-white" onPress={onCancel}>
                        <Text className="text-gray-900 text-center font-semibold">Cancel</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </SafeAreaView>

    );
};

export default AddCar;