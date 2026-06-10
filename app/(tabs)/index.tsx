import { createClerkSupabaseClient } from "@/app/lib/supabase";
import AddCar from "@/components/AddCar";
import Header from "@/components/Header";
import "@/global.css";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { styled } from "nativewind";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView as RNSafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaView);

export default function App() {
  const [cars, setCars] = useState<any[]>([]);
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(true);
  const [carToDelete, setCarToDelete] = useState<any>(null);
  const [carToEdit, setCarToEdit] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddCar, setShowAddCar] = useState(false);
  const [selectedCarForMenu, setSelectedCarForMenu] = useState<any>(null);

  const getServiceStatus = (car: any) => {
    if (!car.service_schedules || car.service_schedules.length === 0) {
      return { label: "Active", bg: "#DCFCE7", text: "#166534" };
    }
    const currentMileage = parseInt(car.currentMileage || 0);
    const hasOverdue = car.service_schedules.some((schedule: any) => {
      const nextMiles = (schedule.last_service_mileage || 0) + schedule.interval_miles;
      return currentMileage >= nextMiles;
    });
    if (hasOverdue) {
      return { label: "Service Needed", bg: "#FEF3C7", text: "#92400E" };
    }
    return { label: "Active", bg: "#DCFCE7", text: "#166534" };
  };

  const filteredCars = cars.filter((car) =>
    `${car.vehicleMake} ${car.modelName}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Edit form fields
  const [editMake, setEditMake] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editYear, setEditYear] = useState("");
  const [editMileage, setEditMileage] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editVin, setEditVin] = useState("");
  const [editNickname, setEditNickname] = useState("");
  const [editFuelRange, setEditFuelRange] = useState("");
  const [editAvgConsumption, setEditAvgConsumption] = useState("");
  const [editTirePressure, setEditTirePressure] = useState("");

  const { getToken } = useAuth();

  const fetchCarData = async () => {
    setIsLoading(true);
    try {
      const token = await getToken({ template: "supabase" });
      if (!token) return;
      const supabase = createClerkSupabaseClient(token);
      const { data, error } = await supabase
        .from("cars")
        .select("*, service_schedules(*)")
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
          vin: editVin,
          nickname: editNickname,
          fuel_range: editFuelRange ? parseInt(editFuelRange) : null,
          avg_consumption: editAvgConsumption ? parseFloat(editAvgConsumption) : null,
          tire_pressure: editTirePressure ? parseInt(editTirePressure) : null,
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
    setEditVin(car.vin || "");
    setEditNickname(car.nickname || "");
    setEditFuelRange(car.fuel_range?.toString() || "");
    setEditAvgConsumption(car.avg_consumption?.toString() || "");
    setEditTirePressure(car.tire_pressure?.toString() || "");
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
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
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
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 20 }} style={{ maxHeight: 420 }}>
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
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "#374151", marginBottom: 6 }}>Odometer (km)</Text>
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

              {/* Row: Nickname + VIN */}
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "#374151", marginBottom: 6 }}>Nickname (Optional)</Text>
                  <View style={{ backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 }}>
                    <Ionicons name="pricetag-outline" size={16} color="#94A3B8" />
                    <TextInput
                      value={editNickname}
                      onChangeText={setEditNickname}
                      placeholder="e.g. Silver Bullet"
                      placeholderTextColor="#94A3B8"
                      style={{ flex: 1, marginLeft: 8, color: "#111827", fontSize: 14 }}
                    />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "#374151", marginBottom: 6 }}>VIN (Optional)</Text>
                  <View style={{ backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 }}>
                    <Ionicons name="barcode-outline" size={16} color="#94A3B8" />
                    <TextInput
                      value={editVin}
                      onChangeText={setEditVin}
                      placeholder="e.g. 1HGCM..."
                      placeholderTextColor="#94A3B8"
                      style={{ flex: 1, marginLeft: 8, color: "#111827", fontSize: 14 }}
                    />
                  </View>
                </View>
              </View>

              {/* Row: Fuel Range + MPG */}
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "#374151", marginBottom: 6 }}>Fuel Range (km) (Optional)</Text>
                  <View style={{ backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 }}>
                    <Ionicons name="water-outline" size={16} color="#94A3B8" />
                    <TextInput
                      value={editFuelRange}
                      onChangeText={setEditFuelRange}
                      placeholder="350"
                      keyboardType="numeric"
                      placeholderTextColor="#94A3B8"
                      style={{ flex: 1, marginLeft: 8, color: "#111827", fontSize: 14 }}
                    />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "#374151", marginBottom: 6 }}>Avg km/l (Optional)</Text>
                  <View style={{ backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 }}>
                    <Ionicons name="leaf-outline" size={16} color="#94A3B8" />
                    <TextInput
                      value={editAvgConsumption}
                      onChangeText={setEditAvgConsumption}
                      placeholder="24.5"
                      keyboardType="numeric"
                      placeholderTextColor="#94A3B8"
                      style={{ flex: 1, marginLeft: 8, color: "#111827", fontSize: 14 }}
                    />
                  </View>
                </View>
              </View>

              {/* Row: Tire Pressure */}
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "#374151", marginBottom: 6 }}>Tire Pressure (Optional)</Text>
                  <View style={{ backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 }}>
                    <Ionicons name="disc-outline" size={16} color="#94A3B8" />
                    <TextInput
                      value={editTirePressure}
                      onChangeText={setEditTirePressure}
                      placeholder="32"
                      keyboardType="numeric"
                      placeholderTextColor="#94A3B8"
                      style={{ flex: 1, marginLeft: 8, color: "#111827", fontSize: 14 }}
                    />
                  </View>
                </View>
                <View style={{ flex: 1 }} />
              </View>

            </ScrollView>

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
        </KeyboardAvoidingView>
      </Modal>


      {isLoading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : showAddCar ? (
        <AddCar
          onCarAdded={() => { fetchCarData(); setShowAddCar(false); }}
          onCancel={cars.length > 0 ? () => setShowAddCar(false) : undefined}
        />
      ) : cars.length === 0 ? (
        /* ── Welcome / Onboarding Screen ── */
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
          <View style={{ flex: 1, alignItems: "center", paddingHorizontal: 28, paddingTop: 48, paddingBottom: 48 + insets.bottom }}>

            {/* Hero icon */}
            <View style={{ width: 120, height: 120, borderRadius: 36, backgroundColor: "#EFF6FF", justifyContent: "center", alignItems: "center", marginBottom: 28, borderWidth: 1, borderColor: "#BFDBFE" }}>
              <Ionicons name="car-sport" size={64} color="#2563EB" />
            </View>

            <Text style={{ fontSize: 28, fontWeight: "800", color: "#111827", textAlign: "center", marginBottom: 12 }}>
              Welcome to{" "}
              <Text style={{ color: "#2563EB" }}>AutoTrack</Text>
            </Text>
            <Text style={{ fontSize: 15, color: "#6B7280", textAlign: "center", lineHeight: 24, marginBottom: 40 }}>
              Your personal garage, right in your pocket. Register your first vehicle to get started.
            </Text>

            {/* Feature pills */}
            {[
              { icon: "shield-checkmark-outline", label: "Secure & private data" },
              { icon: "speedometer-outline", label: "Track mileage over time" },
              { icon: "construct-outline", label: "Log maintenance records" },
            ].map((f, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 16, paddingHorizontal: 20, paddingVertical: 14, marginBottom: 12, width: "100%", borderWidth: 1, borderColor: "#F1F5F9", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}>
                <View style={{ backgroundColor: "#EFF6FF", borderRadius: 10, padding: 8, marginRight: 14 }}>
                  <Ionicons name={f.icon as any} size={20} color="#2563EB" />
                </View>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#374151" }}>{f.label}</Text>
              </View>
            ))}

            {/* CTA */}
            <TouchableOpacity
              onPress={() => setShowAddCar(true)}
              style={{ backgroundColor: "#2563EB", borderRadius: 999, paddingVertical: 18, paddingHorizontal: 40, flexDirection: "row", alignItems: "center", gap: 10, marginTop: 36, width: "100%", justifyContent: "center", shadowColor: "#2563EB", shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 }}
            >
              <Ionicons name="add-circle-outline" size={22} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>Register Your First Vehicle</Text>
            </TouchableOpacity>

          </View>
        </ScrollView>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} className="px-5 mt-5">

          {/* Header row */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <View>
              <Text style={{ fontSize: 22, fontWeight: "800", color: "#111827" }}>Your Garage</Text>
              <Text style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>{cars.length} vehicle{cars.length !== 1 ? "s" : ""} registered</Text>
            </View>
            <TouchableOpacity
              style={{ backgroundColor: "#2563EB", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 6 }}
              onPress={() => setShowAddCar(true)}
            >
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>ADD CAR</Text>
            </TouchableOpacity>
          </View>

          {/* Blended Search Bar */}
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 20, borderWidth: 1, borderColor: "#E2E8F0" }}>
            <Ionicons name="search-outline" size={17} color="#94A3B8" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search make or model..."
              placeholderTextColor="#94A3B8"
              style={{ flex: 1, marginLeft: 10, color: "#111827", fontSize: 14 }}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* ── Car Action Menu Modal (Three Dots Menu) ── */}
          <Modal
            transparent
            visible={!!selectedCarForMenu}
            animationType="slide"
            onRequestClose={() => setSelectedCarForMenu(null)}
          >
            <TouchableOpacity 
              activeOpacity={1} 
              onPress={() => setSelectedCarForMenu(null)} 
              style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
            >
              <TouchableOpacity 
                activeOpacity={1}
                style={{ backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 }}
              >
                <Text style={{ fontSize: 16, fontWeight: "800", color: "#1F2937", marginBottom: 6, textAlign: "center" }}>
                  {selectedCarForMenu?.nickname || `${selectedCarForMenu?.vehicleMake} ${selectedCarForMenu?.modelName}`}
                </Text>
                <Text style={{ fontSize: 12, color: "#6B7280", marginBottom: 20, textAlign: "center" }}>
                  Manage vehicle settings and details
                </Text>
                
                <View style={{ gap: 10 }}>
                  <TouchableOpacity 
                    onPress={() => {
                      const car = selectedCarForMenu;
                      setSelectedCarForMenu(null);
                      openEditModal(car);
                    }}
                    style={{ backgroundColor: "#F3F4F6", borderRadius: 16, paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
                  >
                    <Ionicons name="create-outline" size={20} color="#374151" />
                    <Text style={{ color: "#374151", fontWeight: "700", fontSize: 15 }}>Edit Details</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    onPress={() => {
                      const car = selectedCarForMenu;
                      setSelectedCarForMenu(null);
                      setCarToDelete(car);
                    }}
                    style={{ backgroundColor: "#FEE2E2", borderRadius: 16, paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
                  >
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                    <Text style={{ color: "#EF4444", fontWeight: "700", fontSize: 15 }}>Delete Vehicle</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    onPress={() => setSelectedCarForMenu(null)}
                    style={{ paddingVertical: 14, alignItems: "center" }}
                  >
                    <Text style={{ color: "#94A3B8", fontWeight: "600", fontSize: 14 }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>

          <View style={{ flexDirection: "column", gap: 20, paddingBottom: 100 + insets.bottom }}>
            {filteredCars.length === 0 ? (
              <View style={{ width: "100%", alignItems: "center", paddingVertical: 48 }}>
                <Ionicons name="search-outline" size={40} color="#CBD5E1" />
                <Text style={{ color: "#94A3B8", fontWeight: "600", fontSize: 15, marginTop: 12 }}>No cars match "{searchQuery}"</Text>
              </View>
            ) : filteredCars.map((car, index) => {
              const status = getServiceStatus(car);
              
              // Dynamic secondary stat configuration
              let stat2Icon = "water-outline";
              let stat2Label = "Range";
              let stat2Value = car.fuel_range ? `${car.fuel_range} km` : "--";

              if (!car.fuel_range) {
                if (car.tire_pressure) {
                  stat2Icon = "aperture-outline";
                  stat2Label = "Tire Pressure";
                  stat2Value = `${car.tire_pressure} psi`;
                } else if (car.avg_consumption) {
                  stat2Icon = "leaf-outline";
                  stat2Label = "Consumption";
                  stat2Value = `${car.avg_consumption} km/l`;
                }
              }

              return (
                <TouchableOpacity 
                  key={index} 
                  activeOpacity={0.9} 
                  onPress={() => router.push(`/car/${car.id}` as any)} 
                  style={{ width: "100%", backgroundColor: "#fff", borderRadius: 24, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 15, elevation: 3, borderWidth: 1, borderColor: "#F1F5F9" }}
                >
                  {/* Full-bleed image area */}
                  <View style={{ height: 200, position: "relative", backgroundColor: "#0f172a" }}>
                    <Image
                      source={{ uri: car.imageUrl || "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?q=80&w=1000" }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                    />

                    {/* Status badge — top right */}
                    <View style={{ position: "absolute", top: 12, right: 12, backgroundColor: status.bg, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
                      <Text style={{ color: status.text, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 }}>{status.label.toUpperCase()}</Text>
                    </View>
                  </View>

                  {/* Details section */}
                  <View style={{ padding: 20 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ fontSize: 18, fontWeight: "800", color: "#111827" }}>
                          {car.nickname || `${car.vehicleMake} ${car.modelName}`}
                        </Text>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: "#94A3B8", marginTop: 4, letterSpacing: 0.5 }}>
                          {car.vehicleMake.toUpperCase()} {car.modelName.toUpperCase()} • {car.productionYear}
                        </Text>
                      </View>
                      <TouchableOpacity 
                        onPress={(e) => {
                          e.stopPropagation();
                          setSelectedCarForMenu(car);
                        }} 
                        style={{ padding: 8, marginRight: -8 }}
                      >
                        <Ionicons name="ellipsis-vertical" size={18} color="#94A3B8" />
                      </TouchableOpacity>
                    </View>

                    {/* Separator line */}
                    <View style={{ height: 1, backgroundColor: "#F1F5F9", marginVertical: 16 }} />

                    {/* Stats section */}
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      {/* Odometer */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                        <View style={{ backgroundColor: "#EFF6FF", padding: 8, borderRadius: 10 }}>
                          <Ionicons name="speedometer-outline" size={16} color="#2563EB" />
                        </View>
                        <View>
                          <Text style={{ fontSize: 10, color: "#64748B", fontWeight: "700", letterSpacing: 0.2 }}>Mileage</Text>
                          <Text style={{ fontSize: 13, fontWeight: "700", color: "#1E293B", marginTop: 2 }}>
                            {Number(car.currentMileage || 0).toLocaleString()} km
                          </Text>
                        </View>
                      </View>

                      {/* Secondary Dynamic Stat */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                        <View style={{ backgroundColor: "#EFF6FF", padding: 8, borderRadius: 10 }}>
                          <Ionicons name={stat2Icon as any} size={16} color="#2563EB" />
                        </View>
                        <View>
                          <Text style={{ fontSize: 10, color: "#64748B", fontWeight: "700", letterSpacing: 0.2 }}>{stat2Label}</Text>
                          <Text style={{ fontSize: 13, fontWeight: "700", color: "#1E293B", marginTop: 2 }}>
                            {stat2Value}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}