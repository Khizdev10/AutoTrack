import { createClerkSupabaseClient } from "@/app/lib/supabase";
import AddCar from "@/components/AddCar";
import Header from "@/components/Header";
import "@/global.css";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { styled } from "nativewind";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaView);

export default function App() {
  const [cars, setCars] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [carToDelete, setCarToDelete] = useState<any>(null);
  const [carToEdit, setCarToEdit] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Edit form fields
  const [editMake, setEditMake] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editYear, setEditYear] = useState("");
  const [editMileage, setEditMileage] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");

  const { getToken } = useAuth();

  const fetchCarData = async () => {
    setIsLoading(true);
    try {
      const token = await getToken({ template: "supabase" });
      if (!token) return;
      const supabase = createClerkSupabaseClient(token);
      const { data, error } = await supabase
        .from("cars")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setCars(data);
      if (error) console.error("Error fetching cars:", error);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteCar = async (id: string) => {
    try {
      const token = await getToken({ template: "supabase" });
      if (!token) return;
      const supabase = createClerkSupabaseClient(token);
      const { error } = await supabase.from("cars").delete().eq("id", id).select();
      if (error) console.error("Error deleting car:", error);
    } catch (err) {
      console.error("Exception in deleteCar:", err);
    }
  };

  const updateCar = async () => {
    if (!carToEdit) return;
    setIsSaving(true);
    try {
      const token = await getToken({ template: "supabase" });
      if (!token) return;
      const supabase = createClerkSupabaseClient(token);
      const { error } = await supabase
        .from("cars")
        .update({
          vehicleMake: editMake,
          modelName: editModel,
          productionYear: editYear,
          currentMileage: editMileage,
          imageUrl: editImageUrl,
        })
        .eq("id", carToEdit.id);
      if (error) console.error("Error updating car:", error);
    } catch (err) {
      console.error("Exception in updateCar:", err);
    } finally {
      setIsSaving(false);
      setCarToEdit(null);
      await fetchCarData();
    }
  };

  const openEditModal = (car: any) => {
    setEditMake(car.vehicleMake || "");
    setEditModel(car.modelName || "");
    setEditYear(car.productionYear || "");
    setEditMileage(car.currentMileage?.toString() || "");
    setEditImageUrl(car.imageUrl || "");
    setCarToEdit(car);
  };

  const pickEditImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 1,
    });
    if (!result.canceled) setEditImageUrl(result.assets[0].uri);
  };

  const handleConfirmDelete = async () => {
    if (!carToDelete) return;
    setCarToDelete(null);
    setCars((prev) => prev.filter((c) => c.id !== carToDelete.id));
    await deleteCar(carToDelete.id);
    await fetchCarData();
  };

  useEffect(() => {
    fetchCarData();
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFC]">
      <Header />

      {/* ── Delete Confirmation Modal ── */}
      <Modal
        transparent
        visible={!!carToDelete}
        animationType="fade"
        onRequestClose={() => setCarToDelete(null)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 28, padding: 28, width: "100%", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 }}>
            <View style={{ alignItems: "center", marginBottom: 20 }}>
              <View style={{ backgroundColor: "#FEE2E2", borderRadius: 50, width: 64, height: 64, justifyContent: "center", alignItems: "center" }}>
                <Ionicons name="trash-bin-outline" size={30} color="#EF4444" />
              </View>
            </View>
            <Text style={{ fontSize: 20, fontWeight: "800", color: "#111827", textAlign: "center", marginBottom: 8 }}>
              Delete Vehicle
            </Text>
            <Text style={{ fontSize: 14, color: "#6B7280", textAlign: "center", lineHeight: 22, marginBottom: 28 }}>
              Are you sure you want to remove your{" "}
              <Text style={{ fontWeight: "700", color: "#111827" }}>
                {carToDelete?.vehicleMake} {carToDelete?.modelName}
              </Text>
              ? This action cannot be undone.
            </Text>
            <TouchableOpacity
              onPress={handleConfirmDelete}
              style={{ backgroundColor: "#EF4444", borderRadius: 16, paddingVertical: 16, alignItems: "center", marginBottom: 12 }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Yes, Delete Vehicle</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setCarToDelete(null)}
              style={{ backgroundColor: "#F1F5F9", borderRadius: 16, paddingVertical: 16, alignItems: "center" }}
            >
              <Text style={{ color: "#374151", fontWeight: "600", fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Edit Modal ── */}
      <Modal
        transparent
        visible={!!carToEdit}
        animationType="slide"
        onRequestClose={() => setCarToEdit(null)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#F8FAFC", borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 28, paddingBottom: 40 }}>

            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <View>
                <Text style={{ fontSize: 20, fontWeight: "800", color: "#111827" }}>Edit Vehicle</Text>
                <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>Update your car details below</Text>
              </View>
              <TouchableOpacity
                onPress={() => setCarToEdit(null)}
                style={{ backgroundColor: "#F1F5F9", borderRadius: 50, padding: 8 }}
              >
                <Ionicons name="close" size={20} color="#374151" />
              </TouchableOpacity>
            </View>

            {/* Image Preview + Picker */}
            <TouchableOpacity onPress={pickEditImage} style={{ marginBottom: 20, borderRadius: 20, overflow: "hidden", height: 140, backgroundColor: "#000", position: "relative" }}>
              <Image
                source={{ uri: editImageUrl || "https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=1000" }}
                style={{ width: "100%", height: "100%", opacity: 0.75 }}
                resizeMode="cover"
              />
              <View style={{ position: "absolute", bottom: 12, right: 12, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 50, padding: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.4)" }}>
                <Ionicons name="camera-outline" size={20} color="#fff" />
              </View>
              <View style={{ position: "absolute", bottom: 12, left: 12, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600" }}>Tap to change photo</Text>
              </View>
            </TouchableOpacity>

            {/* Input Fields */}
            <View style={{ gap: 12 }}>
              {/* Row: Make + Model */}
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "#374151", marginBottom: 6 }}>Make</Text>
                  <View style={{ backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 }}>
                    <Ionicons name="business-outline" size={16} color="#94A3B8" />
                    <TextInput
                      value={editMake}
                      onChangeText={setEditMake}
                      placeholder="e.g. Toyota"
                      placeholderTextColor="#94A3B8"
                      style={{ flex: 1, marginLeft: 8, color: "#111827", fontSize: 14 }}
                    />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "#374151", marginBottom: 6 }}>Model</Text>
                  <View style={{ backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 }}>
                    <Ionicons name="git-branch-outline" size={16} color="#94A3B8" />
                    <TextInput
                      value={editModel}
                      onChangeText={setEditModel}
                      placeholder="e.g. Supra"
                      placeholderTextColor="#94A3B8"
                      style={{ flex: 1, marginLeft: 8, color: "#111827", fontSize: 14 }}
                    />
                  </View>
                </View>
              </View>

              {/* Row: Year + Mileage */}
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "#374151", marginBottom: 6 }}>Year</Text>
                  <View style={{ backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 }}>
                    <Ionicons name="calendar-outline" size={16} color="#94A3B8" />
                    <TextInput
                      value={editYear}
                      onChangeText={setEditYear}
                      placeholder="2024"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      style={{ flex: 1, marginLeft: 8, color: "#111827", fontSize: 14 }}
                    />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "#374151", marginBottom: 6 }}>Mileage (mi)</Text>
                  <View style={{ backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 }}>
                    <Ionicons name="speedometer-outline" size={16} color="#94A3B8" />
                    <TextInput
                      value={editMileage}
                      onChangeText={setEditMileage}
                      placeholder="0"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      style={{ flex: 1, marginLeft: 8, color: "#111827", fontSize: 14 }}
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              onPress={updateCar}
              disabled={isSaving}
              style={{ backgroundColor: "#2563EB", borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 24, flexDirection: "row", justifyContent: "center", gap: 8 }}
            >
              {isSaving
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Save Changes</Text>
                  </>
              }
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

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
              onPress={() => setCars([])}
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
                    source={{ uri: car.imageUrl || "https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=1000" }}
                    className="w-full h-full opacity-80"
                    resizeMode="cover"
                  />
                  <View className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-full">
                    <Text className="text-white font-bold tracking-widest text-xs">{car.productionYear}</Text>
                  </View>
                </View>
                <View className="p-5">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xl font-extrabold text-gray-900 flex-1 mr-3" numberOfLines={1}>
                      {car.vehicleMake} {car.modelName}
                    </Text>
                    {/* Action buttons */}
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => openEditModal(car)}
                        style={{ backgroundColor: "#EFF6FF", borderRadius: 20, padding: 8, borderWidth: 1, borderColor: "#BFDBFE" }}
                      >
                        <Ionicons name="pencil-outline" size={16} color="#2563EB" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setCarToDelete(car)}
                        style={{ backgroundColor: "#FEF2F2", borderRadius: 20, padding: 8, borderWidth: 1, borderColor: "#FECACA" }}
                      >
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
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