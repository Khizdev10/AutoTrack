import { createClerkSupabaseClient } from '@/app/lib/supabase';
import "@/global.css";
import { useAuth } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { styled } from 'nativewind';
import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Image, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView as RNSafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from '@/app/context/ThemeContext';

interface AddCarProps {
    onCarAdded: () => void;
    onCancel?: () => void;
}

const AddCar = ({ onCarAdded, onCancel }: AddCarProps) => {
    const { getToken, userId } = useAuth();
    const insets = useSafeAreaInsets();
    const { colors, theme } = useTheme();

    useEffect(() => {
        const backAction = () => {
            if (onCancel) {
                onCancel();
                return true; // Intercepts the back action
            }
            return false; // Let the default back action happen
        };

        const backHandler = BackHandler.addEventListener(
            "hardwareBackPress",
            backAction
        );

        return () => backHandler.remove();
    }, [onCancel]);

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
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [16, 9],
            quality: 1,
        });

        if (!result.canceled) {
            setImageUrl(result.assets[0].uri);
        }
    };

    return (
        <RNSafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 + insets.bottom }}>
                    <View style={{ alignItems: "center", marginTop: 16 }}>
                        <View style={{ backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 4, borderRadius: 999 }}>
                            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 10, letterSpacing: 1.5 }}>REGISTRATION</Text>
                        </View>
                        <Text style={{ fontSize: 26, fontWeight: "800", color: colors.text, marginTop: 8 }}>Register Your Vehicle</Text>
                        <Text style={{ color: colors.textMuted, textAlign: "center", marginTop: 8, paddingHorizontal: 16, fontSize: 13, lineHeight: 18 }}>
                            Enter the core details to start tracking performance and maintenance.
                        </Text>
                    </View>

                    {/* HERO IMAGE CARD */}
                    <View style={{ marginTop: 20, borderRadius: 24, overflow: "hidden", height: 140, backgroundColor: "#000", position: "relative" }}>
                        <Image
                            source={{ uri: imageUrl }}
                            style={{ width: "100%", height: "100%", opacity: 0.7 }}
                            resizeMode="cover"
                        />

                        {/* Edit Image Button */}
                        <TouchableOpacity
                            style={{ position: "absolute", top: 12, right: 12, backgroundColor: "rgba(255,255,255,0.25)", padding: 8, borderRadius: 999 }}
                            onPress={pickImage}
                        >
                            <Ionicons name="pencil" size={18} color="white" />
                        </TouchableOpacity>
                    </View>

                    {/* INPUT FIELDS */}
                    <View style={{ marginTop: 20, gap: 14 }}>
                        <View>
                            <Text style={{ color: colors.text, fontWeight: "600", marginBottom: 6, fontSize: 13 }}>Vehicle Make</Text>
                            <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, flexDirection: "row", alignItems: "center", padding: 14 }}>
                                <Ionicons name="business-outline" size={18} color={colors.textMuted} />
                                <TextInput
                                    style={{ marginLeft: 12, flex: 1, color: colors.text, fontSize: 14 }}
                                    placeholder="e.g. Toyota"
                                    placeholderTextColor={colors.textMuted}
                                    value={vehicleMake}
                                    onChangeText={setVehicleMake}
                                />
                            </View>
                        </View>

                        <View>
                            <Text style={{ color: colors.text, fontWeight: "600", marginBottom: 6, fontSize: 13 }}>Model Name</Text>
                            <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, flexDirection: "row", alignItems: "center", padding: 14 }}>
                                <Ionicons name="git-branch-outline" size={18} color={colors.textMuted} />
                                <TextInput
                                    style={{ marginLeft: 12, flex: 1, color: colors.text, fontSize: 14 }}
                                    placeholder="e.g. Corolla"
                                    placeholderTextColor={colors.textMuted}
                                    value={modelName}
                                    onChangeText={setModelName}
                                />
                            </View>
                        </View>

                        <View>
                            <Text style={{ color: colors.text, fontWeight: "600", marginBottom: 6, fontSize: 13 }}>Production Year</Text>
                            <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, flexDirection: "row", alignItems: "center", padding: 14 }}>
                                <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
                                <TextInput
                                    style={{ marginLeft: 12, flex: 1, color: colors.text, fontSize: 14 }}
                                    placeholder="e.g. 2024"
                                    placeholderTextColor={colors.textMuted}
                                    keyboardType="numeric"
                                    value={productionYear}
                                    onChangeText={setProductionYear}
                                />
                            </View>
                        </View>

                        <View>
                            <Text style={{ color: colors.text, fontWeight: "600", marginBottom: 6, fontSize: 13 }}>Odometer (km)</Text>
                            <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, flexDirection: "row", alignItems: "center", padding: 14, justifyContent: "space-between" }}>
                                <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                                    <Ionicons name="speedometer-outline" size={18} color={colors.textMuted} />
                                    <TextInput
                                        style={{ marginLeft: 12, flex: 1, color: colors.text, fontSize: 14 }}
                                        placeholder="0"
                                        placeholderTextColor={colors.textMuted}
                                        keyboardType="numeric"
                                        value={currentMileage}
                                        onChangeText={setCurrentMileage}
                                    />
                                </View>
                                <Text style={{ color: colors.textMuted }}>km</Text>
                            </View>
                        </View>

                        <View>
                            <Text style={{ color: colors.text, fontWeight: "600", marginBottom: 6, fontSize: 13 }}>Nickname (Optional)</Text>
                            <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, flexDirection: "row", alignItems: "center", padding: 14 }}>
                                <Ionicons name="pricetag-outline" size={18} color={colors.textMuted} />
                                <TextInput
                                    style={{ marginLeft: 12, flex: 1, color: colors.text, fontSize: 14 }}
                                    placeholder="e.g. The Silver Bullet"
                                    placeholderTextColor={colors.textMuted}
                                    value={nickname}
                                    onChangeText={setNickname}
                                />
                            </View>
                        </View>

                        <View>
                            <Text style={{ color: colors.text, fontWeight: "600", marginBottom: 6, fontSize: 13 }}>VIN (Optional)</Text>
                            <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, flexDirection: "row", alignItems: "center", padding: 14 }}>
                                <Ionicons name="barcode-outline" size={18} color={colors.textMuted} />
                                <TextInput
                                    style={{ marginLeft: 12, flex: 1, color: colors.text, fontSize: 14 }}
                                    placeholder="e.g. 1HGCM..."
                                    placeholderTextColor={colors.textMuted}
                                    value={vin}
                                    onChangeText={setVin}
                                />
                            </View>
                        </View>

                        <View style={{ flexDirection: "row", gap: 12 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: colors.text, fontWeight: "600", marginBottom: 6, fontSize: 13 }}>Fuel Range (km) (Opt)</Text>
                                <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, flexDirection: "row", alignItems: "center", padding: 14 }}>
                                    <Ionicons name="water-outline" size={18} color={colors.textMuted} />
                                    <TextInput
                                        style={{ marginLeft: 10, flex: 1, color: colors.text, fontSize: 14 }}
                                        placeholder="350"
                                        placeholderTextColor={colors.textMuted}
                                        keyboardType="numeric"
                                        value={fuelRange}
                                        onChangeText={setFuelRange}
                                    />
                                </View>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: colors.text, fontWeight: "600", marginBottom: 6, fontSize: 13 }}>Avg km/l (Optional)</Text>
                                <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, flexDirection: "row", alignItems: "center", padding: 14 }}>
                                    <Ionicons name="leaf-outline" size={18} color={colors.textMuted} />
                                    <TextInput
                                        style={{ marginLeft: 10, flex: 1, color: colors.text, fontSize: 14 }}
                                        placeholder="24.5"
                                        placeholderTextColor={colors.textMuted}
                                        keyboardType="numeric"
                                        value={avgConsumption}
                                        onChangeText={setAvgConsumption}
                                    />
                                </View>
                            </View>
                        </View>

                        <View>
                            <Text style={{ color: colors.text, fontWeight: "600", marginBottom: 6, fontSize: 13 }}>Tire Pressure (Optional)</Text>
                            <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, flexDirection: "row", alignItems: "center", padding: 14 }}>
                                <Ionicons name="disc-outline" size={18} color={colors.textMuted} />
                                <TextInput
                                    style={{ marginLeft: 12, flex: 1, color: colors.text, fontSize: 14 }}
                                    placeholder="32"
                                    placeholderTextColor={colors.textMuted}
                                    keyboardType="numeric"
                                    value={tirePressure}
                                    onChangeText={setTirePressure}
                                />
                            </View>
                        </View>
                    </View>

                    {/* INFO TILES */}
                    <View style={{ marginTop: 20, gap: 10 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.accent, padding: 14, borderRadius: 14 }}>
                            <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
                            <Text style={{ marginLeft: 10, color: colors.text, fontSize: 13 }}>Data is encrypted and stored locally.</Text>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.accent, padding: 14, borderRadius: 14 }}>
                            <Ionicons name="sync" size={18} color={colors.primary} />
                            <Text style={{ marginLeft: 10, color: colors.text, fontSize: 13 }}>Automatic service schedule sync.</Text>
                        </View>
                    </View>

                    {/* BUTTONS */}
                    <TouchableOpacity 
                        style={{ backgroundColor: colors.text, borderRadius: 16, marginTop: 24, paddingVertical: 16, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 }} 
                        onPress={saveCarData}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <ActivityIndicator color={theme === 'dark' ? "black" : "white"} />
                        ) : (
                            <>
                                <Text style={{ color: theme === 'dark' ? "black" : "white", fontWeight: "700", fontSize: 16 }}>Save Vehicle Details</Text>
                                <Ionicons name="chevron-forward" size={18} color={theme === 'dark' ? "black" : "white"} />
                            </>
                        )}
                    </TouchableOpacity>

                    {onCancel && (
                        <TouchableOpacity style={{ paddingVertical: 16, borderRadius: 16, marginTop: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: "center" }} onPress={onCancel}>
                            <Text style={{ color: colors.text, fontWeight: "600" }}>Cancel</Text>
                        </TouchableOpacity>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </RNSafeAreaView>
    );
};

export default AddCar;