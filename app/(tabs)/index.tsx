import { createClerkSupabaseClient } from "@/app/lib/supabase";
import { getPreferences, formatCurrency } from "@/app/lib/settings";
import { useIsFocused } from "@react-navigation/native";
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
import { useTheme } from "@/app/context/ThemeContext";
import {
  checkOnline,
  getFromCache,
  saveToCache,
  mergeQueueWithState,
  syncOfflineQueue,
  getOfflineQueue,
  addToOfflineQueue
} from "@/app/lib/offlineSync";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function App() {
  const [cars, setCars] = useState<any[]>([]);
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [carToDelete, setCarToDelete] = useState<any>(null);
  const [carToEdit, setCarToEdit] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddCar, setShowAddCar] = useState(false);
  const [selectedCarForMenu, setSelectedCarForMenu] = useState<any>(null);

  const [allServiceLogs, setAllServiceLogs] = useState<any[]>([]);
  const [allPetrolLogs, setAllPetrolLogs] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all'); // 0-indexed (0 = Jan)
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [prefCurrency, setPrefCurrency] = useState("Rs.");
  const isFocused = useIsFocused();
  const { colors, theme } = useTheme();

  const getUniqueYears = () => {
    const yearsSet = new Set<number>();
    yearsSet.add(new Date().getFullYear());
    
    allServiceLogs.forEach(log => {
      if (log.date_performed) {
        const y = new Date(log.date_performed).getFullYear();
        if (!isNaN(y)) yearsSet.add(y);
      }
    });
    allPetrolLogs.forEach(log => {
      if (log.date) {
        const y = new Date(log.date).getFullYear();
        if (!isNaN(y)) yearsSet.add(y);
      }
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  };

  const filterLogsByYearAndMonth = (logsList: any[], dateField: string) => {
    return logsList.filter(log => {
      if (!log[dateField]) return false;
      const logDate = new Date(log[dateField]);
      if (isNaN(logDate.getTime())) return false;
      
      const matchYear = selectedYear === 'all' || logDate.getFullYear() === selectedYear;
      const matchMonth = selectedMonth === 'all' || logDate.getMonth() === selectedMonth;
      
      return matchYear && matchMonth;
    });
  };

  const filteredServiceLogs = filterLogsByYearAndMonth(allServiceLogs, 'date_performed');
  const filteredPetrolLogs = filterLogsByYearAndMonth(allPetrolLogs, 'date');

  const totalMaintenanceCost = filteredServiceLogs.reduce((sum, item) => sum + parseFloat(item.cost || 0), 0);
  const totalPetrolCost = filteredPetrolLogs.reduce((sum, item) => sum + parseFloat(item.total_cost || 0), 0);

  const [breakdownTab, setBreakdownTab] = useState<'monthly' | 'yearly'>('monthly');

  const getMonthlyBreakdown = (serviceLogsList: any[], petrolLogsList: any[]) => {
    const breakdown: { [key: string]: { service: number; petrol: number; total: number } } = {};
    
    serviceLogsList.forEach(log => {
      if (!log.date_performed || !log.cost) return;
      const date = new Date(log.date_performed);
      if (isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!breakdown[key]) {
        breakdown[key] = { service: 0, petrol: 0, total: 0 };
      }
      breakdown[key].service += parseFloat(log.cost || 0);
      breakdown[key].total += parseFloat(log.cost || 0);
    });

    petrolLogsList.forEach(log => {
      if (!log.date || !log.total_cost) return;
      const date = new Date(log.date);
      if (isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!breakdown[key]) {
        breakdown[key] = { service: 0, petrol: 0, total: 0 };
      }
      breakdown[key].petrol += parseFloat(log.total_cost || 0);
      breakdown[key].total += parseFloat(log.total_cost || 0);
    });

    return Object.entries(breakdown)
      .map(([key, val]) => {
        const [year, month] = key.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        const label = date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        return { key, label, year: parseInt(year), ...val };
      })
      .sort((a, b) => b.key.localeCompare(a.key));
  };

  const getYearlyBreakdown = (serviceLogsList: any[], petrolLogsList: any[]) => {
    const breakdown: { [key: number]: { service: number; petrol: number; total: number } } = {};

    serviceLogsList.forEach(log => {
      if (!log.date_performed || !log.cost) return;
      const date = new Date(log.date_performed);
      if (isNaN(date.getTime())) return;
      const year = date.getFullYear();
      if (!breakdown[year]) {
        breakdown[year] = { service: 0, petrol: 0, total: 0 };
      }
      breakdown[year].service += parseFloat(log.cost || 0);
      breakdown[year].total += parseFloat(log.cost || 0);
    });

    petrolLogsList.forEach(log => {
      if (!log.date || !log.total_cost) return;
      const date = new Date(log.date);
      if (isNaN(date.getTime())) return;
      const year = date.getFullYear();
      if (!breakdown[year]) {
        breakdown[year] = { service: 0, petrol: 0, total: 0 };
      }
      breakdown[year].petrol += parseFloat(log.total_cost || 0);
      breakdown[year].total += parseFloat(log.total_cost || 0);
    });

    return Object.entries(breakdown)
      .map(([yearStr, val]) => ({
        year: parseInt(yearStr),
        label: yearStr,
        ...val
      }))
      .sort((a, b) => b.year - a.year);
  };

  const monthlyBreakdown = getMonthlyBreakdown(allServiceLogs, allPetrolLogs);
  const yearlyBreakdown = getYearlyBreakdown(allServiceLogs, allPetrolLogs);

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
      const online = await checkOnline();
      setIsOffline(!online);

      const queue = await getOfflineQueue();

      if (online) {
        const token = await getToken({ template: "supabase" });
        if (token) {
          setIsSyncing(true);
          await syncOfflineQueue(token);
          setIsSyncing(false);

          const supabase = createClerkSupabaseClient(token);
          const { data, error } = await supabase
            .from("cars")
            .select("*, service_schedules(*)")
            .order("created_at", { ascending: false });
          if (data) {
            setCars(data);
            await saveToCache("garage_cars", data);
          }
          if (error) console.error("Error fetching cars:", error);

          const { data: serviceLogs } = await supabase
            .from("service_logs")
            .select("cost, date_performed");
          if (serviceLogs) {
            setAllServiceLogs(serviceLogs);
            await saveToCache("overall_service_logs", serviceLogs);
          }

          const { data: petrolLogs } = await supabase
            .from("petrol_logs")
            .select("total_cost, date");
          if (petrolLogs) {
            setAllPetrolLogs(petrolLogs);
            await saveToCache("overall_petrol_logs", petrolLogs);
          }
          return;
        }
      }

      // Fallback if offline or if token fetching failed/returned null
      const cachedCars = await getFromCache("garage_cars") || [];
      const cachedServiceLogs = await getFromCache("overall_service_logs") || [];
      const cachedPetrolLogs = await getFromCache("overall_petrol_logs") || [];

      const finalCars = mergeQueueWithState(cachedCars, queue, 'cars');
      const finalServiceLogs = mergeQueueWithState(cachedServiceLogs, queue, 'service_logs');
      const finalPetrolLogs = mergeQueueWithState(cachedPetrolLogs, queue, 'petrol_logs');

      setCars(finalCars);
      setAllServiceLogs(finalServiceLogs);
      setAllPetrolLogs(finalPetrolLogs);
    } catch (err) {
      console.error(err);
      const queue = await getOfflineQueue();
      const cachedCars = await getFromCache("garage_cars") || [];
      const cachedServiceLogs = await getFromCache("overall_service_logs") || [];
      const cachedPetrolLogs = await getFromCache("overall_petrol_logs") || [];

      const finalCars = mergeQueueWithState(cachedCars, queue, 'cars');
      const finalServiceLogs = mergeQueueWithState(cachedServiceLogs, queue, 'service_logs');
      const finalPetrolLogs = mergeQueueWithState(cachedPetrolLogs, queue, 'petrol_logs');

      setCars(finalCars);
      setAllServiceLogs(finalServiceLogs);
      setAllPetrolLogs(finalPetrolLogs);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteCar = async (id: string) => {
    try {
      const online = await checkOnline();
      if (online) {
        const token = await getToken({ template: "supabase" });
        if (!token) return;
        const supabase = createClerkSupabaseClient(token);
        const { error } = await supabase.from("cars").delete().eq("id", id).select();
        if (error) console.error("Error deleting car:", error);
      } else {
        await addToOfflineQueue({
          table: 'cars',
          action: 'DELETE',
          payload: {},
          recordId: id,
        });
      }
    } catch (err) {
      console.error("Exception in deleteCar:", err);
    }
  };

  const updateCar = async () => {
    if (!carToEdit) return;
    setIsSaving(true);
    try {
      const payload = {
        vehicleMake: editMake,
        modelName: editModel,
        productionYear: editYear,
        currentMileage: editMileage ? parseInt(editMileage) : 0,
        imageUrl: editImageUrl,
        vin: editVin,
        nickname: editNickname,
        fuel_range: editFuelRange ? parseInt(editFuelRange) : null,
        avg_consumption: editAvgConsumption ? parseFloat(editAvgConsumption) : null,
        tire_pressure: editTirePressure ? parseInt(editTirePressure) : null,
      };

      const online = await checkOnline();

      if (online) {
        const token = await getToken({ template: "supabase" });
        if (!token) return;
        const supabase = createClerkSupabaseClient(token);
        const { error } = await supabase
          .from("cars")
          .update(payload)
          .eq("id", carToEdit.id);
        if (error) console.error("Error updating car:", error);
      } else {
        await addToOfflineQueue({
          table: 'cars',
          action: 'UPDATE',
          payload,
          recordId: carToEdit.id,
        });
      }
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
    const loadSettings = async () => {
      const prefs = await getPreferences();
      setPrefCurrency(prefs.currency);
    };
    if (isFocused) {
      loadSettings();
      fetchCarData();
    }
  }, [isFocused]);

  return (
    <RNSafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Header />
      {(isOffline || isSyncing) && (
        <View style={{
          backgroundColor: isSyncing ? "#3B82F6" : "#F59E0B",
          paddingVertical: 6,
          paddingHorizontal: 20,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}>
          {isSyncing ? (
            <>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Syncing offline changes...</Text>
            </>
          ) : (
            <>
              <Ionicons name="cloud-offline" size={14} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Running Offline (Changes will sync when online)</Text>
            </>
          )}
        </View>
      )}

      {/* ── Delete Confirmation Modal ── */}
      <Modal
        transparent
        visible={!!carToDelete}
        animationType="fade"
        statusBarTranslucent
        hardwareAccelerated
        onRequestClose={() => setCarToDelete(null)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 24 }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 28, padding: 28, width: "100%", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 20, elevation: 10, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ alignItems: "center", marginBottom: 20 }}>
              <View style={{ backgroundColor: "#FEE2E2", borderRadius: 50, width: 64, height: 64, justifyContent: "center", alignItems: "center" }}>
                <Ionicons name="trash-bin-outline" size={30} color="#EF4444" />
              </View>
            </View>
            <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text, textAlign: "center", marginBottom: 8 }}>
              Delete Vehicle
            </Text>
            <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 22, marginBottom: 28 }}>
              Are you sure you want to remove your{" "}
              <Text style={{ fontWeight: "700", color: colors.text }}>
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
              style={{ backgroundColor: colors.accent, borderRadius: 16, paddingVertical: 16, alignItems: "center" }}
            >
              <Text style={{ color: colors.text, fontWeight: "600", fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Edit Modal ── */}
      <Modal
        transparent
        visible={!!carToEdit}
        animationType="slide"
        statusBarTranslucent
        hardwareAccelerated
        onRequestClose={() => setCarToEdit(null)}
      >
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 28, paddingBottom: 20, maxHeight: "90%", borderWidth: 1, borderColor: colors.border }}>

            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <View>
                <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text }}>Edit Vehicle</Text>
                <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>Update your car details below</Text>
              </View>
              <TouchableOpacity
                onPress={() => setCarToEdit(null)}
                style={{ backgroundColor: colors.accent, borderRadius: 50, padding: 8 }}
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Image Preview + Picker */}
              <TouchableOpacity onPress={pickEditImage} style={{ marginBottom: 20, borderRadius: 20, overflow: "hidden", height: 140, backgroundColor: "#000", position: "relative" }}>
                <Image
                  source={{ uri: editImageUrl || "https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=1000" }}
                  style={{ width: "100%", height: "100%", opacity: 0.75 }}
                  resizeMode="cover"
                />
                <View style={{ position: "absolute", bottom: 12, right: 12, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 50, padding: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.4)" }}>
                  <Ionicons name="camera-outline" size={20} color="#fff" />
                </View>
                <View style={{ position: "absolute", bottom: 12, left: 12, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600" }}>Tap to change photo</Text>
                </View>
              </TouchableOpacity>

              {/* Input Fields */}
              <View style={{ gap: 12, paddingBottom: 10 }}>
                {/* Row: Make + Model */}
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.text, marginBottom: 6 }}>Make</Text>
                    <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 }}>
                      <Ionicons name="business-outline" size={16} color={colors.textMuted} />
                      <TextInput
                        value={editMake}
                        onChangeText={setEditMake}
                        placeholder="e.g. Toyota"
                        placeholderTextColor={colors.textMuted}
                        style={{ flex: 1, marginLeft: 8, color: colors.text, fontSize: 14 }}
                      />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.text, marginBottom: 6 }}>Model</Text>
                    <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 }}>
                      <Ionicons name="git-branch-outline" size={16} color={colors.textMuted} />
                      <TextInput
                        value={editModel}
                        onChangeText={setEditModel}
                        placeholder="e.g. Supra"
                        placeholderTextColor={colors.textMuted}
                        style={{ flex: 1, marginLeft: 8, color: colors.text, fontSize: 14 }}
                      />
                    </View>
                  </View>
                </View>

                {/* Row: Year + Mileage */}
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.text, marginBottom: 6 }}>Year</Text>
                    <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 }}>
                      <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
                      <TextInput
                        value={editYear}
                        onChangeText={setEditYear}
                        placeholder="2024"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric"
                        style={{ flex: 1, marginLeft: 8, color: colors.text, fontSize: 14 }}
                      />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.text, marginBottom: 6 }}>Odometer (km)</Text>
                    <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 }}>
                      <Ionicons name="speedometer-outline" size={16} color={colors.textMuted} />
                      <TextInput
                        value={editMileage}
                        onChangeText={setEditMileage}
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric"
                        style={{ flex: 1, marginLeft: 8, color: colors.text, fontSize: 14 }}
                      />
                    </View>
                  </View>
                </View>

                {/* Row: Nickname + VIN */}
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.text, marginBottom: 6 }}>Nickname (Optional)</Text>
                    <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 }}>
                      <Ionicons name="pricetag-outline" size={16} color={colors.textMuted} />
                      <TextInput
                        value={editNickname}
                        onChangeText={setEditNickname}
                        placeholder="e.g. Silver Bullet"
                        placeholderTextColor={colors.textMuted}
                        style={{ flex: 1, marginLeft: 8, color: colors.text, fontSize: 14 }}
                      />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.text, marginBottom: 6 }}>VIN (Optional)</Text>
                    <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 }}>
                      <Ionicons name="barcode-outline" size={16} color={colors.textMuted} />
                      <TextInput
                        value={editVin}
                        onChangeText={setEditVin}
                        placeholder="e.g. 1HGCM..."
                        placeholderTextColor={colors.textMuted}
                        style={{ flex: 1, marginLeft: 8, color: colors.text, fontSize: 14 }}
                      />
                    </View>
                  </View>
                </View>

                {/* Row: Fuel Range + Avg */}
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.text, marginBottom: 6 }}>Fuel Range (km) (Opt)</Text>
                    <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 }}>
                      <Ionicons name="water-outline" size={16} color={colors.textMuted} />
                      <TextInput
                        value={editFuelRange}
                        onChangeText={setEditFuelRange}
                        placeholder="350"
                        keyboardType="numeric"
                        placeholderTextColor={colors.textMuted}
                        style={{ flex: 1, marginLeft: 8, color: colors.text, fontSize: 14 }}
                      />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.text, marginBottom: 6 }}>Avg km/l (Optional)</Text>
                    <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 }}>
                      <Ionicons name="leaf-outline" size={16} color={colors.textMuted} />
                      <TextInput
                        value={editAvgConsumption}
                        onChangeText={setEditAvgConsumption}
                        placeholder="24.5"
                        keyboardType="numeric"
                        placeholderTextColor={colors.textMuted}
                        style={{ flex: 1, marginLeft: 8, color: colors.text, fontSize: 14 }}
                      />
                    </View>
                  </View>
                </View>

                {/* Row: Tire Pressure */}
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.text, marginBottom: 6 }}>Tire Pressure (Optional)</Text>
                    <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 }}>
                      <Ionicons name="disc-outline" size={16} color={colors.textMuted} />
                      <TextInput
                        value={editTirePressure}
                        onChangeText={setEditTirePressure}
                        placeholder="32"
                        keyboardType="numeric"
                        placeholderTextColor={colors.textMuted}
                        style={{ flex: 1, marginLeft: 8, color: colors.text, fontSize: 14 }}
                      />
                    </View>
                  </View>
                  <View style={{ flex: 1 }} />
                </View>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                onPress={updateCar}
                disabled={isSaving}
                style={{ backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 12, marginBottom: insets.bottom + 20, flexDirection: "row", justifyContent: "center", gap: 8 }}
              >
                {isSaving
                  ? <ActivityIndicator color="#fff" />
                  : <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Save Changes</Text>
                  </>
                }
              </TouchableOpacity>
            </ScrollView>

          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>


      {isLoading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
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
            <View style={{ width: 120, height: 120, borderRadius: 36, backgroundColor: colors.accent, justifyContent: "center", alignItems: "center", marginBottom: 28, borderWidth: 1, borderColor: colors.border }}>
              <Ionicons name="car-sport" size={64} color={colors.primary} />
            </View>

            <Text style={{ fontSize: 28, fontWeight: "800", color: colors.text, textAlign: "center", marginBottom: 12 }}>
              Welcome to{" "}
              <Text style={{ color: colors.primary }}>AutoTrack</Text>
            </Text>
            <Text style={{ fontSize: 15, color: colors.textMuted, textAlign: "center", lineHeight: 24, marginBottom: 40 }}>
              Your personal garage, right in your pocket. Register your first vehicle to get started.
            </Text>

            {/* Feature pills */}
            {[
              { icon: "shield-checkmark-outline", label: "Secure & private data" },
              { icon: "speedometer-outline", label: "Track mileage over time" },
              { icon: "construct-outline", label: "Log maintenance records" },
            ].map((f, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 14, marginBottom: 12, width: "100%", borderWidth: 1, borderColor: colors.border, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}>
                <View style={{ backgroundColor: colors.accent, borderRadius: 10, padding: 8, marginRight: 14 }}>
                  <Ionicons name={f.icon as any} size={20} color={colors.primary} />
                </View>
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>{f.label}</Text>
              </View>
            ))}

            {/* CTA */}
            <TouchableOpacity
              onPress={() => setShowAddCar(true)}
              style={{ backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 18, paddingHorizontal: 40, flexDirection: "row", alignItems: "center", gap: 10, marginTop: 36, width: "100%", justifyContent: "center", shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 }}
            >
              <Ionicons name="add-circle-outline" size={22} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>Register Your First Vehicle</Text>
            </TouchableOpacity>

          </View>
        </ScrollView>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={{ paddingHorizontal: 20, marginTop: 20 }}>

          {/* Header row */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <View>
              <Text style={{ fontSize: 22, fontWeight: "800", color: colors.text }}>Your Garage</Text>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{cars.length} vehicle{cars.length !== 1 ? "s" : ""} registered</Text>
            </View>
            <TouchableOpacity
              style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 6 }}
              onPress={() => setShowAddCar(true)}
            >
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>ADD CAR</Text>
            </TouchableOpacity>
          </View>

          {/* Blended Search Bar */}
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 20, borderWidth: 1, borderColor: colors.border }}>
            <Ionicons name="search-outline" size={17} color={colors.textMuted} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search make or model..."
              placeholderTextColor={colors.textMuted}
              style={{ flex: 1, marginLeft: 10, color: colors.text, fontSize: 14 }}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* YEAR & MONTH FILTERS DROPDOWNS */}
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
            {/* Year Selector */}
            <TouchableOpacity
              onPress={() => setShowYearPicker(true)}
              style={{ flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 8, elevation: 1 }}
            >
              <View>
                <Text style={{ fontSize: 9, fontWeight: "800", color: colors.textMuted, letterSpacing: 0.5, marginBottom: 2 }}>YEAR</Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>
                  {selectedYear === 'all' ? 'All Years' : selectedYear}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Month Selector */}
            <TouchableOpacity
              onPress={() => setShowMonthPicker(true)}
              style={{ flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 8, elevation: 1 }}
            >
              <View>
                <Text style={{ fontSize: 9, fontWeight: "800", color: colors.textMuted, letterSpacing: 0.5, marginBottom: 2 }}>MONTH</Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>
                  {selectedMonth === 'all' ? 'All Months' : MONTHS[selectedMonth]}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Overall Stats Cards */}
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
            {/* Maintenance Card */}
            <View style={{ flex: 1, backgroundColor: colors.accent, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center" }}>
              <View style={{ backgroundColor: colors.border, padding: 8, borderRadius: 12, marginRight: 10 }}>
                <Ionicons name="construct" size={18} color={colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 9, fontWeight: "800", color: colors.textMuted, letterSpacing: 0.5 }}>TOTAL SERVICE</Text>
                <Text style={{ fontSize: 13, fontWeight: "800", color: colors.text, marginTop: 2 }} numberOfLines={1}>
                  {formatCurrency(totalMaintenanceCost, prefCurrency)}
                </Text>
              </View>
            </View>

            {/* Petrol Card */}
            <View style={{ flex: 1, backgroundColor: colors.greenBg, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center" }}>
              <View style={{ backgroundColor: colors.border, padding: 8, borderRadius: 12, marginRight: 10 }}>
                <Ionicons name="flame" size={18} color={colors.greenText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 9, fontWeight: "800", color: colors.greenText, letterSpacing: 0.5 }}>TOTAL PETROL</Text>
                <Text style={{ fontSize: 13, fontWeight: "800", color: colors.greenText, marginTop: 2 }} numberOfLines={1}>
                  {formatCurrency(totalPetrolCost, prefCurrency)}
                </Text>
              </View>
            </View>
          </View>

          {/* ── Car Action Menu Modal (Three Dots Menu) ── */}
          <Modal
            transparent
            visible={!!selectedCarForMenu}
            animationType="slide"
            statusBarTranslucent
            hardwareAccelerated
            onRequestClose={() => setSelectedCarForMenu(null)}
          >
            <TouchableOpacity 
              activeOpacity={1} 
              onPress={() => setSelectedCarForMenu(null)} 
              style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}
            >
              <TouchableOpacity 
                activeOpacity={1}
                style={{ backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 6, textAlign: "center" }}>
                  {selectedCarForMenu?.nickname || `${selectedCarForMenu?.vehicleMake} ${selectedCarForMenu?.modelName}`}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 20, textAlign: "center" }}>
                  Manage vehicle settings and details
                </Text>
                
                <View style={{ gap: 10 }}>
                  <TouchableOpacity 
                    onPress={() => {
                      const car = selectedCarForMenu;
                      setSelectedCarForMenu(null);
                      openEditModal(car);
                    }}
                    style={{ backgroundColor: colors.accent, borderRadius: 16, paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
                  >
                    <Ionicons name="create-outline" size={20} color={colors.text} />
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>Edit Details</Text>
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
                    <Text style={{ color: colors.textMuted, fontWeight: "600", fontSize: 14 }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>

          {/* SPENDING BREAKDOWN CARD */}
          <View style={{ backgroundColor: colors.card, borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: colors.textMuted, letterSpacing: 0.5 }}>SPENDING BREAKDOWN</Text>
              <View style={{ flexDirection: "row", backgroundColor: colors.accent, padding: 2, borderRadius: 8 }}>
                <TouchableOpacity
                  onPress={() => setBreakdownTab('monthly')}
                  style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: breakdownTab === 'monthly' ? colors.card : 'transparent' }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", color: colors.text }}>Monthly</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setBreakdownTab('yearly')}
                  style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: breakdownTab === 'yearly' ? colors.card : 'transparent' }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", color: colors.text }}>Yearly</Text>
                </TouchableOpacity>
              </View>
            </View>

            {breakdownTab === 'monthly' ? (
              monthlyBreakdown.length === 0 ? (
                <Text style={{ color: colors.textMuted, textAlign: "center", marginVertical: 12, fontSize: 13 }}>No spending data recorded.</Text>
              ) : (
                <View style={{ gap: 16 }}>
                  {monthlyBreakdown.map((item) => {
                    const totalVal = Number(item.total) || 0;
                    const serviceVal = Number(item.service) || 0;
                    const petrolVal = Number(item.petrol) || 0;
                    const servicePct = totalVal > 0 ? Math.round((serviceVal / totalVal) * 100) : 0;
                    const petrolPct = totalVal > 0 ? Math.round((petrolVal / totalVal) * 100) : 0;

                    return (
                      <View key={item.key} style={{ gap: 6 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>{item.label}</Text>
                          <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>{formatCurrency(item.total, prefCurrency)}</Text>
                        </View>
                        <View style={{ height: 6, backgroundColor: colors.accent, borderRadius: 3, overflow: "hidden", flexDirection: "row" }}>
                          {item.service > 0 && (
                            <View style={{ flex: item.service, backgroundColor: "#D97706" }} />
                          )}
                          {item.petrol > 0 && (
                            <View style={{ flex: item.petrol, backgroundColor: "#16A34A" }} />
                          )}
                        </View>
                        <View style={{ flexDirection: "row", gap: 12 }}>
                          {item.service > 0 && (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#D97706" }} />
                              <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: "600" }}>Service: {formatCurrency(item.service, prefCurrency)} ({servicePct}%)</Text>
                            </View>
                          )}
                          {item.petrol > 0 && (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#16A34A" }} />
                              <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: "600" }}>Petrol: {formatCurrency(item.petrol, prefCurrency)} ({petrolPct}%)</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )
            ) : (
              yearlyBreakdown.length === 0 ? (
                <Text style={{ color: colors.textMuted, textAlign: "center", marginVertical: 12, fontSize: 13 }}>No spending data recorded.</Text>
              ) : (
                <View style={{ gap: 16 }}>
                  {yearlyBreakdown.map((item) => {
                    const totalVal = Number(item.total) || 0;
                    const serviceVal = Number(item.service) || 0;
                    const petrolVal = Number(item.petrol) || 0;
                    const servicePct = totalVal > 0 ? Math.round((serviceVal / totalVal) * 100) : 0;
                    const petrolPct = totalVal > 0 ? Math.round((petrolVal / totalVal) * 100) : 0;

                    return (
                      <View key={item.year} style={{ gap: 6 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>{item.label}</Text>
                          <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>{formatCurrency(item.total, prefCurrency)}</Text>
                        </View>
                        <View style={{ height: 6, backgroundColor: colors.accent, borderRadius: 3, overflow: "hidden", flexDirection: "row" }}>
                          {item.service > 0 && (
                            <View style={{ flex: item.service, backgroundColor: "#D97706" }} />
                          )}
                          {item.petrol > 0 && (
                            <View style={{ flex: item.petrol, backgroundColor: "#16A34A" }} />
                          )}
                        </View>
                        <View style={{ flexDirection: "row", gap: 12 }}>
                          {item.service > 0 && (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#D97706" }} />
                              <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: "600" }}>Service: {formatCurrency(item.service, prefCurrency)} ({servicePct}%)</Text>
                            </View>
                          )}
                          {item.petrol > 0 && (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#16A34A" }} />
                              <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: "600" }}>Petrol: {formatCurrency(item.petrol, prefCurrency)} ({petrolPct}%)</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )
            )}
          </View>

          <View style={{ flexDirection: "column", gap: 20, paddingBottom: 100 + insets.bottom }}>
            {filteredCars.length === 0 ? (
              <View style={{ width: "100%", alignItems: "center", paddingVertical: 48 }}>
                <Ionicons name="search-outline" size={40} color={colors.border} />
                <Text style={{ color: colors.textMuted, fontWeight: "600", fontSize: 15, marginTop: 12 }}>No cars match "{searchQuery}"</Text>
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
                  style={{ width: "100%", backgroundColor: colors.card, borderRadius: 24, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 15, elevation: 3, borderWidth: 1, borderColor: colors.border }}
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
                        <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>
                          {car.nickname || `${car.vehicleMake} ${car.modelName}`}
                        </Text>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textMuted, marginTop: 4, letterSpacing: 0.5 }}>
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
                        <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>

                    {/* Separator line */}
                    <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 16 }} />

                    {/* Stats section */}
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      {/* Odometer */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                        <View style={{ backgroundColor: colors.accent, padding: 8, borderRadius: 10 }}>
                          <Ionicons name="speedometer-outline" size={16} color={colors.primary} />
                        </View>
                        <View>
                          <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: "700", letterSpacing: 0.2 }}>Mileage</Text>
                          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text, marginTop: 2 }}>
                            {Number(car.currentMileage || 0).toLocaleString()} km
                          </Text>
                        </View>
                      </View>

                      {/* Secondary Dynamic Stat */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                        <View style={{ backgroundColor: colors.accent, padding: 8, borderRadius: 10 }}>
                          <Ionicons name={stat2Icon as any} size={16} color={colors.primary} />
                        </View>
                        <View>
                          <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: "700", letterSpacing: 0.2 }}>{stat2Label}</Text>
                          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text, marginTop: 2 }}>
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

      {/* Year Picker Modal */}
      <Modal transparent visible={showYearPicker} animationType="fade" onRequestClose={() => setShowYearPicker(false)}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowYearPicker(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 20 }}
        >
          <View style={{ backgroundColor: colors.card, borderRadius: 24, width: "100%", padding: 24, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 16 }}>Select Year</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 300 }}>
              <TouchableOpacity
                onPress={() => { setSelectedYear('all'); setShowYearPicker(false); }}
                style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
              >
                <Text style={{ fontSize: 15, fontWeight: selectedYear === 'all' ? '700' : '500', color: selectedYear === 'all' ? colors.primary : colors.text }}>All Years</Text>
                {selectedYear === 'all' && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </TouchableOpacity>
              {getUniqueYears().map((y) => (
                <TouchableOpacity
                  key={y}
                  onPress={() => { setSelectedYear(y); setShowYearPicker(false); }}
                  style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
                >
                  <Text style={{ fontSize: 15, fontWeight: selectedYear === y ? '700' : '500', color: selectedYear === y ? colors.primary : colors.text }}>{y}</Text>
                  {selectedYear === y && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Month Picker Modal */}
      <Modal transparent visible={showMonthPicker} animationType="fade" onRequestClose={() => setShowMonthPicker(false)}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowMonthPicker(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 20 }}
        >
          <View style={{ backgroundColor: colors.card, borderRadius: 24, width: "100%", padding: 24, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 16 }}>Select Month</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 350 }}>
              <TouchableOpacity
                onPress={() => { setSelectedMonth('all'); setShowMonthPicker(false); }}
                style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
              >
                <Text style={{ fontSize: 15, fontWeight: selectedMonth === 'all' ? '700' : '500', color: selectedMonth === 'all' ? colors.primary : colors.text }}>All Months</Text>
                {selectedMonth === 'all' && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </TouchableOpacity>
              {MONTHS.map((m, idx) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => { setSelectedMonth(idx); setShowMonthPicker(false); }}
                  style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
                >
                  <Text style={{ fontSize: 15, fontWeight: selectedMonth === idx ? '700' : '500', color: selectedMonth === idx ? colors.primary : colors.text }}>{m}</Text>
                  {selectedMonth === idx && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

    </RNSafeAreaView>
  );
}