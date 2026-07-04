import { createClerkSupabaseClient } from "@/app/lib/supabase";
import { useAuth, useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";
import { styled } from "nativewind";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Modal,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaView);

const CURRENCIES = [
  { label: "Pakistani Rupee (Rs.)", value: "Rs." },
  { label: "US Dollar ($)", value: "$" },
  { label: "Euro (€)", value: "€" },
  { label: "Pound Sterling (£)", value: "£" },
  { label: "UAE Dirham (AED)", value: "AED" },
  { label: "Indian Rupee (₹)", value: "₹" },
  { label: "Saudi Riyal (SAR)", value: "SAR" },
  { label: "Canadian Dollar (C$)", value: "C$" },
  { label: "Australian Dollar (A$)", value: "A$" },
  { label: "Japanese Yen (¥)", value: "¥" },
  { label: "Swiss Franc (CHF)", value: "CHF" },
  { label: "Chinese Yuan (CN¥)", value: "CN¥" },
  { label: "Bangladeshi Taka (৳)", value: "৳" },
  { label: "Turkish Lira (₺)", value: "₺" },
  { label: "Brazilian Real (R$)", value: "R$" },
  { label: "Mexican Peso (Mex$)", value: "Mex$" },
  { label: "South African Rand (ZAR)", value: "ZAR" },
  { label: "Nigerian Naira (₦)", value: "₦" },
];

export default function SettingsScreen() {
  const { signOut, getToken } = useAuth();
  const { user } = useUser();
  const isFocused = useIsFocused();

  // Settings State
  const [currency, setCurrency] = useState("Rs.");
  const [distanceUnit, setDistanceUnit] = useState("km");
  const [volumeUnit, setVolumeUnit] = useState("L");
  const [remindersEnabled, setRemindersEnabled] = useState(true);

  // UI state
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportedCsv, setExportedCsv] = useState<string | null>(null);
  const [showCsvModal, setShowCsvModal] = useState(false);

  // Load preferences on mount/focus
  const loadPreferences = async () => {
    try {
      const savedCurrency = await AsyncStorage.getItem("autotrack_currency");
      const savedDistance = await AsyncStorage.getItem("autotrack_distance_unit");
      const savedVolume = await AsyncStorage.getItem("autotrack_volume_unit");
      const savedReminders = await AsyncStorage.getItem("autotrack_reminders_enabled");

      if (savedCurrency) setCurrency(savedCurrency);
      if (savedDistance) setDistanceUnit(savedDistance);
      if (savedVolume) setVolumeUnit(savedVolume);
      if (savedReminders !== null) setRemindersEnabled(savedReminders === "true");
    } catch (e) {
      console.error("Error loading preferences:", e);
    }
  };

  useEffect(() => {
    if (isFocused) {
      loadPreferences();
    }
  }, [isFocused]);

  // Preference update handlers
  const updateCurrency = async (val: string) => {
    setCurrency(val);
    await AsyncStorage.setItem("autotrack_currency", val);
    setShowCurrencyModal(false);
  };

  const toggleDistanceUnit = async () => {
    const next = distanceUnit === "km" ? "mi" : "km";
    setDistanceUnit(next);
    await AsyncStorage.setItem("autotrack_distance_unit", next);
  };

  const toggleVolumeUnit = async () => {
    const next = volumeUnit === "L" ? "gal" : "L";
    setVolumeUnit(next);
    await AsyncStorage.setItem("autotrack_volume_unit", next);
  };

  const toggleReminders = async (val: boolean) => {
    setRemindersEnabled(val);
    await AsyncStorage.setItem("autotrack_reminders_enabled", val ? "true" : "false");
  };

  // Sign out confirmation
  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out of AutoTrack?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => signOut() },
    ]);
  };

  // Clear local GPS tracking state
  const handleClearCache = async () => {
    Alert.alert(
      "Reset Local Storage",
      "This will clear local trip distance counters and cache. Your synced cloud logs will remain safe. Proceed?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.removeItem("background_trip_distance");
            await AsyncStorage.removeItem("background_tracking_active");
            Alert.alert("Success", "Local cache reset successfully.");
          },
        },
      ]
    );
  };

  // Export all data as CSV
  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const token = await getToken({ template: "supabase" });
      if (!token) {
        Alert.alert("Authentication Error", "Could not retrieve session token.");
        return;
      }
      const supabase = createClerkSupabaseClient(token);

      // Fetch all cars
      const { data: cars } = await supabase.from("cars").select("*");
      // Fetch all service logs
      const { data: serviceLogs } = await supabase.from("service_logs").select("*");
      // Fetch all petrol logs
      const { data: petrolLogs } = await supabase.from("petrol_logs").select("*");

      if (!cars || cars.length === 0) {
        Alert.alert("No Data", "You don't have any cars or logs logged yet.");
        return;
      }

      // Generate CSV string
      let csvString = "=== VEHICLES ===\nID,Make,Model,Year,Odometer,Nickname\n";
      cars.forEach((c) => {
        csvString += `"${c.id}","${c.vehicleMake}","${c.modelName}","${c.productionYear}","${c.currentMileage}","${c.nickname || ""}"\n`;
      });

      csvString += "\n=== MAINTENANCE LOGS ===\nID,Car ID,Service Type,Odometer,Cost,Date,Notes\n";
      (serviceLogs || []).forEach((l) => {
        csvString += `"${l.id}","${l.car_id}","${l.service_type}","${l.mileage}","${l.cost}","${l.date_performed}","${l.notes || ""}"\n`;
      });

      csvString += "\n=== FUEL LOGS ===\nID,Car ID,Date,Liters,Price Per Liter,Total Cost,Odometer,Notes\n";
      (petrolLogs || []).forEach((p) => {
        csvString += `"${p.id}","${p.car_id}","${p.date}","${p.liters}","${p.price_per_liter}","${p.total_cost}","${p.mileage}","${p.notes || ""}"\n`;
      });

      setExportedCsv(csvString);
      Clipboard.setString(csvString);
      setShowCsvModal(true);
      Alert.alert("Success", "Your logs have been generated and copied to your clipboard!");
    } catch (e) {
      console.error(e);
      Alert.alert("Export Failed", "An error occurred while compiling your data.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFC" }} edges={["top"]}>
      {/* ── HEADER ── */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 }}>
        <Text style={{ fontSize: 11, fontWeight: "900", color: "#2563EB", letterSpacing: 1.5, textTransform: "uppercase" }}>
          Preferences
        </Text>
        <Text style={{ fontSize: 26, fontWeight: "800", color: "#0F172A", marginTop: 4 }}>
          Settings Hub
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        
        {/* ── USER PROFILE SECTION ── */}
        <View style={{ backgroundColor: "#fff", borderRadius: 24, padding: 20, marginBottom: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "#F1F5F9" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: 999, backgroundColor: "#E5E7EB", justifyContent: "center", alignItems: "center" }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: "#4B5563" }}>
                {user?.firstName ? user.firstName[0].toUpperCase() : "U"}
              </Text>
            </View>
            <View>
              <Text style={{ fontSize: 16, fontWeight: "800", color: "#1E293B" }}>
                {user?.fullName || "AutoTrack User"}
              </Text>
              <Text style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                {user?.primaryEmailAddress?.emailAddress || "Logged In"}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleSignOut} style={{ backgroundColor: "#FEF2F2", padding: 10, borderRadius: 14 }}>
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* ── PREFERENCES GROUP ── */}
        <Text style={{ fontSize: 11, fontWeight: "800", color: "#64748B", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10, marginLeft: 6 }}>
          Measurement Units
        </Text>

        <View style={{ backgroundColor: "#fff", borderRadius: 24, paddingVertical: 8, paddingHorizontal: 16, marginBottom: 20, borderWidth: 1, borderColor: "#F1F5F9" }}>
          {/* Currency Preference */}
          <TouchableOpacity
            onPress={() => setShowCurrencyModal(true)}
            style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ backgroundColor: "#ECFDF5", padding: 8, borderRadius: 10 }}>
                <Ionicons name="cash-outline" size={18} color="#10B981" />
              </View>
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#334155" }}>Currency</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#64748B" }}>
                {CURRENCIES.find((c) => c.value === currency)?.label.split(" ")[0] || currency}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
            </View>
          </TouchableOpacity>

          {/* Distance Unit Preference */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ backgroundColor: "#EFF6FF", padding: 8, borderRadius: 10 }}>
                <Ionicons name="speedometer-outline" size={18} color="#2563EB" />
              </View>
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#334155" }}>Distance Unit</Text>
            </View>
            <View style={{ flexDirection: "row", backgroundColor: "#F1F5F9", borderRadius: 10, padding: 3, gap: 4 }}>
              <TouchableOpacity
                onPress={toggleDistanceUnit}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 8,
                  backgroundColor: distanceUnit === "km" ? "#fff" : "transparent",
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "800", color: distanceUnit === "km" ? "#1E293B" : "#64748B" }}>KM</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={toggleDistanceUnit}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 8,
                  backgroundColor: distanceUnit === "mi" ? "#fff" : "transparent",
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "800", color: distanceUnit === "mi" ? "#1E293B" : "#64748B" }}>MI</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Volume Unit Preference */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ backgroundColor: "#FFFBEB", padding: 8, borderRadius: 10 }}>
                <Ionicons name="water-outline" size={18} color="#D97706" />
              </View>
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#334155" }}>Fuel Volume</Text>
            </View>
            <View style={{ flexDirection: "row", backgroundColor: "#F1F5F9", borderRadius: 10, padding: 3, gap: 4 }}>
              <TouchableOpacity
                onPress={toggleVolumeUnit}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 8,
                  backgroundColor: volumeUnit === "L" ? "#fff" : "transparent",
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "800", color: volumeUnit === "L" ? "#1E293B" : "#64748B" }}>LITERS</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={toggleVolumeUnit}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 8,
                  backgroundColor: volumeUnit === "gal" ? "#fff" : "transparent",
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "800", color: volumeUnit === "gal" ? "#1E293B" : "#64748B" }}>GALS</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── APP OPTIONS GROUP ── */}
        <Text style={{ fontSize: 11, fontWeight: "800", color: "#64748B", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10, marginLeft: 6 }}>
          Notifications
        </Text>

        <View style={{ backgroundColor: "#fff", borderRadius: 24, paddingVertical: 8, paddingHorizontal: 16, marginBottom: 20, borderWidth: 1, borderColor: "#F1F5F9" }}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10 }}>
            <View style={{ backgroundColor: "#F5F3FF", padding: 8, borderRadius: 10, marginRight: 12 }}>
              <Ionicons name="notifications-outline" size={18} color="#7C3AED" />
            </View>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#334155" }}>Service Reminders</Text>
              <Text style={{ fontSize: 10, color: "#64748B", marginTop: 2 }}>Notify when service limit approaches</Text>
            </View>
            <Switch
              value={remindersEnabled}
              onValueChange={toggleReminders}
              trackColor={{ false: "#E2E8F0", true: "#86EFAC" }}
              thumbColor={remindersEnabled ? "#10B981" : "#94A3B8"}
            />
          </View>
        </View>

        {/* ── DATA MANAGEMENT GROUP ── */}
        <Text style={{ fontSize: 11, fontWeight: "800", color: "#64748B", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10, marginLeft: 6 }}>
          Data & Support
        </Text>

        <View style={{ backgroundColor: "#fff", borderRadius: 24, paddingVertical: 8, paddingHorizontal: 16, marginBottom: 20, borderWidth: 1, borderColor: "#F1F5F9" }}>
          {/* Export Logs */}
          <TouchableOpacity
            onPress={handleExportData}
            disabled={isExporting}
            style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ backgroundColor: "#EFF6FF", padding: 8, borderRadius: 10 }}>
                {isExporting ? (
                  <ActivityIndicator size="small" color="#2563EB" />
                ) : (
                  <Ionicons name="download-outline" size={18} color="#2563EB" />
                )}
              </View>
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#334155" }}>Export Backup (CSV)</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
          </TouchableOpacity>

          {/* Reset Cache */}
          <TouchableOpacity
            onPress={handleClearCache}
            style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ backgroundColor: "#FEF2F2", padding: 8, borderRadius: 10 }}>
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </View>
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#334155" }}>Reset Local Cache</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Footer info */}
        <Text style={{ textAlign: "center", fontSize: 11, color: "#94A3B8", marginTop: 10 }}>
          AutoTrack Mobile v1.0.0
        </Text>

      </ScrollView>

      {/* ── CURRENCY SELECTION MODAL ── */}
      <Modal transparent visible={showCurrencyModal} animationType="fade" onRequestClose={() => setShowCurrencyModal(false)}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowCurrencyModal(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", padding: 20 }}
        >
          <View style={{ backgroundColor: "#fff", borderRadius: 24, width: "100%", padding: 24, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: "#1E293B", marginBottom: 16 }}>Select Currency</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 300 }}>
              {CURRENCIES.map((curr) => (
                <TouchableOpacity
                  key={curr.value}
                  onPress={() => updateCurrency(curr.value)}
                  style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
                >
                  <Text style={{ fontSize: 15, fontWeight: currency === curr.value ? "700" : "500", color: currency === curr.value ? "#2563EB" : "#334155" }}>
                    {curr.label}
                  </Text>
                  {currency === curr.value && <Ionicons name="checkmark" size={18} color="#2563EB" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── CSV PREVIEW MODAL ── */}
      <Modal transparent visible={showCsvModal} animationType="slide" onRequestClose={() => setShowCsvModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, height: "80%" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: "#1E293B" }}>CSV Backup Data</Text>
              <TouchableOpacity onPress={() => setShowCsvModal(false)} style={{ backgroundColor: "#F1F5F9", borderRadius: 50, padding: 8 }}>
                <Ionicons name="close" size={20} color="#374151" />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, color: "#64748B", marginBottom: 12 }}>
              The following backup data has been copied to your clipboard.
            </Text>
            <ScrollView style={{ flex: 1, backgroundColor: "#F8FAFC", borderRadius: 16, padding: 12, borderWidth: 1, borderColor: "#E2E8F0" }}>
              <Text style={{ fontSize: 10, fontFamily: "monospace", color: "#334155" }}>{exportedCsv}</Text>
            </ScrollView>
            <TouchableOpacity
              onPress={() => {
                Clipboard.setString(exportedCsv || "");
                Alert.alert("Copied", "Copied to clipboard!");
              }}
              style={{ backgroundColor: "#2563EB", borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 16 }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>Recopy Data</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}