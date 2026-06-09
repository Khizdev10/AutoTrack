import { createClerkSupabaseClient } from "@/app/lib/supabase";
import Header from "@/components/Header";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as TaskManager from "expo-task-manager";
import { styled } from "nativewind";
import React, { useEffect, useRef, useState } from "react";
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

// Haversine formula
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const BACKGROUND_LOCATION_TASK = "background-location-task";

// Define the background location task
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
  if (error) {
    console.error("Background location task error:", error);
    return;
  }
  if (data) {
    const { locations } = data;
    if (locations && locations.length > 0) {
      try {
        const newLocation = locations[0];
        const storedDataStr = await AsyncStorage.getItem("temp_trip_tracking");
        let trackingData = storedDataStr
          ? JSON.parse(storedDataStr)
          : { tripDistance: 0, lastCoords: null };

        if (trackingData.lastCoords) {
          const lat1 = trackingData.lastCoords.latitude;
          const lon1 = trackingData.lastCoords.longitude;
          const lat2 = newLocation.coords.latitude;
          const lon2 = newLocation.coords.longitude;

          // Haversine formula
          const R = 6371; // km
          const dLat = (lat2 - lat1) * Math.PI / 180;
          const dLon = (lon2 - lon1) * Math.PI / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const dist = R * c; // distance in km

          // Speed filtering: walking speed is usually under 2.2 m/s (~8 km/h).
          const speed = newLocation.coords.speed;
          const isDriving = speed === null || speed === undefined || speed > 2.2;

          if (isDriving && dist > 0) {
            trackingData.tripDistance += dist;
          }
        }

        trackingData.lastCoords = {
          latitude: newLocation.coords.latitude,
          longitude: newLocation.coords.longitude
        };

        await AsyncStorage.setItem("temp_trip_tracking", JSON.stringify(trackingData));
      } catch (err) {
        console.error("Error saving background location:", err);
      }
    }
  }
});

const PRESET_SCHEDULES = [
  { label: "Oil Change", interval: "8000" },
  { label: "Tire Rotation", interval: "12000" },
  { label: "Air Filter", interval: "24000" },
  { label: "Brake Pads", interval: "40000" },
];

export default function CarDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { getToken } = useAuth();

  const [car, setCar] = useState<any>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [showUpdateMileageModal, setShowUpdateMileageModal] = useState(false);

  // Form states - Schedule
  const [newScheduleType, setNewScheduleType] = useState("");
  const [newScheduleIntervalMiles, setNewScheduleIntervalMiles] = useState("");
  const [newScheduleIntervalMonths, setNewScheduleIntervalMonths] = useState("");

  // Form states - Log
  const [newLogType, setNewLogType] = useState("");
  const [newLogMileage, setNewLogMileage] = useState("");
  const [newLogCost, setNewLogCost] = useState("");
  const [newLogNotes, setNewLogNotes] = useState("");

  const [manualMileage, setManualMileage] = useState("");

  // GPS State
  const [isTracking, setIsTracking] = useState(false);
  const [tripDistance, setTripDistance] = useState(0);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const lastLocationRef = useRef<Location.LocationObject | null>(null);

  const [isSaving, setIsSaving] = useState(false);

  const currentDisplayMileage = parseInt(car?.currentMileage || 0) + Math.round(tripDistance);
  const totalSpent = logs.reduce((sum, log) => sum + (log.cost || 0), 0);

  useEffect(() => {
    fetchCarDetails();
  }, [id]);

  useEffect(() => {
    let interval: any = null;
    if (isTracking) {
      interval = setInterval(async () => {
        const storedDataStr = await AsyncStorage.getItem("temp_trip_tracking");
        if (storedDataStr) {
          const trackingData = JSON.parse(storedDataStr);
          setTripDistance(trackingData.tripDistance);
        }
      }, 2000);
    } else {
      if (interval) clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTracking]);

  useEffect(() => {
    // Configure notifications
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      } as any),
    });
  }, []);

  const checkServiceReminders = async (carData: any, schedulesList: any[]) => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }

      const currentMileage = parseInt(carData.currentMileage || 0);
      for (const schedule of schedulesList) {
        const nextMiles = (schedule.last_service_mileage || 0) + schedule.interval_miles;
        const remaining = nextMiles - currentMileage;

        if (remaining <= 0) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "⚠️ Maintenance Overdue",
              subtitle: `${carData.vehicleMake} ${carData.modelName}`,
              body: `Your ${schedule.service_type} has exceeded its interval by ${Math.abs(remaining).toLocaleString()} km.\nTap here to log this service now.`,
              color: "#EF4444", // Red tint on Android
              sound: true,
              badge: 1,
            },
            trigger: null,
          });
        } else if (remaining <= 500) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "🔧 Service Reminder",
              subtitle: `${carData.vehicleMake} ${carData.modelName}`,
              body: `Your ${schedule.service_type} is due in ${Math.round(remaining).toLocaleString()} km.\nKeep your vehicle running smoothly!`,
              color: "#3B82F6", // Blue tint on Android
              sound: true,
            },
            trigger: null,
          });
        }
      }
    } catch (err) {
      console.error("Notifications check error:", err);
    }
  };

  const fetchCarDetails = async () => {
    setIsLoading(true);
    try {
      const token = await getToken({ template: "supabase" });
      if (!token) return;
      const supabase = createClerkSupabaseClient(token);

      const { data: carData } = await supabase.from("cars").select("*").eq("id", id).single();
      if (carData) {
        setCar(carData);
        setManualMileage(carData.currentMileage?.toString() || "");
      }

      const { data: scheduleData } = await supabase.from("service_schedules").select("*").eq("car_id", id);
      if (scheduleData) setSchedules(scheduleData);

      const { data: logData } = await supabase.from("service_logs").select("*").eq("car_id", id).order("date_performed", { ascending: false });
      if (logData) setLogs(logData);

      if (carData && scheduleData) {
        await checkServiceReminders(carData, scheduleData);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const updateCarMileage = async (newMileage: number) => {
    try {
      const token = await getToken({ template: "supabase" });
      if (!token) return;
      const supabase = createClerkSupabaseClient(token);

      const { error } = await supabase.from("cars").update({ currentMileage: newMileage }).eq("id", id);
      if (!error) {
        setCar((prev: any) => ({ ...prev, currentMileage: newMileage }));
        if (car && schedules) {
          await checkServiceReminders({ ...car, currentMileage: newMileage }, schedules);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleManualMileageUpdate = async () => {
    const miles = parseInt(manualMileage);
    if (isNaN(miles)) {
      setShowUpdateMileageModal(false);
      return;
    }
    setIsSaving(true);
    await updateCarMileage(miles);
    setIsSaving(false);
    setShowUpdateMileageModal(false);
  };

  const openLogModal = (type = "") => {
    setNewLogType(type);
    setNewLogMileage(currentDisplayMileage.toString());
    setShowLogModal(true);
  };

  const toggleDriveMode = async () => {
    if (isTracking) {
      try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
        if (isRegistered) {
          await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        }
      } catch (err) {
        console.error("Error stopping location updates:", err);
      }

      setIsTracking(false);

      const storedDataStr = await AsyncStorage.getItem("temp_trip_tracking");
      let finalDistance = 0;
      if (storedDataStr) {
        const trackingData = JSON.parse(storedDataStr);
        finalDistance = trackingData.tripDistance;
      }

      if (finalDistance > 0 && car) {
        const newTotal = (car.currentMileage || 0) + Math.round(finalDistance);
        await updateCarMileage(newTotal);
      }
      setTripDistance(0);
      await AsyncStorage.removeItem("temp_trip_tracking");
    } else {
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        alert('Foreground location permission is required for Drive Mode');
        return;
      }

      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus !== 'granted') {
        alert('Background location permission (Allow all the time) is required to track in background.');
        return;
      }

      await Notifications.requestPermissionsAsync();
      await AsyncStorage.setItem("temp_trip_tracking", JSON.stringify({ tripDistance: 0, lastCoords: null }));

      setIsTracking(true);
      setTripDistance(0);

      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 10,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "AutoTrack GPS Active",
          notificationBody: "Tracking your drive mileage in the background...",
          notificationColor: "#2563EB",
        },
      });
    }
  };

  const addSchedule = async () => {
    if (!newScheduleType || !newScheduleIntervalMiles) return;
    setIsSaving(true);
    try {
      const token = await getToken({ template: "supabase" });
      if (!token) return;
      const supabase = createClerkSupabaseClient(token);

      await supabase.from("service_schedules").insert([
        {
          car_id: id,
          service_type: newScheduleType,
          interval_miles: parseInt(newScheduleIntervalMiles),
          interval_months: newScheduleIntervalMonths ? parseInt(newScheduleIntervalMonths) : null,
          last_service_mileage: car?.currentMileage || 0,
          last_service_date: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsSaving(false);
      setShowScheduleModal(false);
      fetchCarDetails();
      setNewScheduleType("");
      setNewScheduleIntervalMiles("");
      setNewScheduleIntervalMonths("");
    }
  };

  const addLog = async () => {
    if (!newLogType || !newLogMileage) return;
    setIsSaving(true);
    try {
      const token = await getToken({ template: "supabase" });
      if (!token) return;
      const supabase = createClerkSupabaseClient(token);

      const { error } = await supabase.from("service_logs").insert([
        {
          car_id: id,
          service_type: newLogType,
          mileage_at_service: parseInt(newLogMileage),
          cost: newLogCost ? parseFloat(newLogCost) : null,
          notes: newLogNotes,
          date_performed: new Date().toISOString(),
        },
      ]);

      if (!error) {
        if (parseInt(newLogMileage) > (car?.currentMileage || 0)) {
          await updateCarMileage(parseInt(newLogMileage));
        }

        const scheduleToUpdate = schedules.find(s => s.service_type.toLowerCase() === newLogType.toLowerCase());
        if (scheduleToUpdate) {
          await supabase.from("service_schedules").update({
            last_service_mileage: parseInt(newLogMileage),
            last_service_date: new Date().toISOString()
          }).eq("id", scheduleToUpdate.id);
        }
      }
    } finally {
      setIsSaving(false);
      setShowLogModal(false);
      fetchCarDetails();
      setNewLogType("");
      setNewLogMileage("");
      setNewLogCost("");
      setNewLogNotes("");
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#F1F5F9] justify-center items-center">
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }

  if (!car) {
    return (
      <SafeAreaView className="flex-1 bg-[#F1F5F9] justify-center items-center">
        <Text>Car not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: "#2563EB", fontWeight: "600" }}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Find the most urgent schedule
  let mostUrgentSchedule: any = null;
  let lowestMilesRemaining = Infinity;
  let urgentPercentage = 100;

  schedules.forEach(schedule => {
    const nextMiles = (schedule.last_service_mileage || 0) + schedule.interval_miles;
    const remaining = nextMiles - currentDisplayMileage;
    if (remaining < lowestMilesRemaining) {
      lowestMilesRemaining = remaining;
      mostUrgentSchedule = schedule;
      const used = currentDisplayMileage - (schedule.last_service_mileage || 0);
      urgentPercentage = Math.max(0, 100 - (used / schedule.interval_miles * 100));
    }
  });

  return (
    <SafeAreaView className="flex-1 bg-[#F1F5F9]" edges={["top"]}>
      <Header
        showBack
        hideProfile
        title={`${car.vehicleMake} ${car.modelName}`}
        subtitle={car.vin ? `VIN: ${car.vin}` : undefined}
        rightElement={
          <TouchableOpacity onPress={(

          ) => setShowUpdateMileageModal(true)} style={{ backgroundColor: "#E0E7FF", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}>
            <Text style={{ color: "#4338CA", fontSize: 11, fontWeight: "800" }}>UPDATE ODOMETER</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>

        {/* HERO CARD */}
        <View style={{ backgroundColor: "#111827", borderRadius: 24, overflow: "hidden", height: 260, marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 15, elevation: 8 }}>
          <Image
            source={{ uri: car.imageUrl || "https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=1000" }}
            style={{ width: "100%", height: "100%", opacity: 0.9 }}
            resizeMode="cover"
          />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.95)"]}
            style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "60%" }}
          />
          <View style={{ position: "absolute", bottom: 20, left: 20, right: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
            <View>
              <View style={{ backgroundColor: "#3B82F6", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginBottom: 8 }}>
                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 }}>ACTIVE</Text>
              </View>
              <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}>{car.nickname || car.modelName}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ color: "#9CA3AF", fontSize: 10, fontWeight: "800", letterSpacing: 0.5, marginBottom: 4 }}>FUEL RANGE</Text>
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>{car.fuel_range || "--"} km</Text>
            </View>
          </View>
        </View>

        {/* DRIVE MODE TOGGLE */}
        <TouchableOpacity
          onPress={toggleDriveMode}
          style={{ marginBottom: 20, backgroundColor: isTracking ? "#EF4444" : "#2563EB", borderRadius: 16, paddingVertical: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 }}
        >
          <Ionicons name={isTracking ? "stop-circle" : "navigate"} size={20} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
            {isTracking ? `Stop Drive (${tripDistance.toFixed(1)} km)` : "Start Drive Mode (GPS)"}
          </Text>
        </TouchableOpacity>

        {/* QUICK STATS GRID */}
        <View style={{ backgroundColor: "#fff", borderRadius: 24, padding: 20, flexDirection: "row", flexWrap: "wrap", rowGap: 24, marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 }}>
          <View style={{ width: "50%" }}>
            <Text style={{ fontSize: 10, fontWeight: "800", color: "#64748B", letterSpacing: 0.5, marginBottom: 6 }}>ODOMETER</Text>
            <Text style={{ fontSize: 16, color: "#1E293B" }}><Text style={{ fontWeight: "700" }}>{currentDisplayMileage.toLocaleString()}</Text> km</Text>
          </View>
          <View style={{ width: "50%" }}>
            <Text style={{ fontSize: 10, fontWeight: "800", color: "#64748B", letterSpacing: 0.5, marginBottom: 6 }}>AVG CONSUMPTION</Text>
            <Text style={{ fontSize: 16, color: "#1E293B" }}><Text style={{ fontWeight: "700" }}>{car.avg_consumption || "--"}</Text> km/l</Text>
          </View>
          <View style={{ width: "50%" }}>
            <Text style={{ fontSize: 10, fontWeight: "800", color: "#64748B", letterSpacing: 0.5, marginBottom: 6 }}>LAST SERVICE</Text>
            <Text style={{ fontSize: 16, color: "#1E293B", fontWeight: "700" }}>
              {logs.length > 0 ? new Date(logs[0].date_performed).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : "--"}
            </Text>
          </View>
          <View style={{ width: "50%" }}>
            <Text style={{ fontSize: 10, fontWeight: "800", color: "#64748B", letterSpacing: 0.5, marginBottom: 6 }}>TIRE PRESSURE</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={{ fontSize: 16, color: "#1E293B" }}><Text style={{ fontWeight: "700" }}>{car.tire_pressure || "--"}</Text> psi</Text>
            </View>
          </View>
        </View>

        {/* TOTAL SPEND CARD */}
        <View style={{ backgroundColor: "#fff", borderRadius: 24, padding: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ backgroundColor: "#FEF3C7", padding: 12, borderRadius: 16 }}>
              <Ionicons name="wallet-outline" size={24} color="#D97706" />
            </View>
            <View>
              <Text style={{ fontSize: 10, fontWeight: "800", color: "#64748B", letterSpacing: 0.5, marginBottom: 4 }}>TOTAL MAINTENANCE SPEND</Text>
              <Text style={{ fontSize: 20, fontWeight: "800", color: "#1E293B" }}>Rs. {totalSpent.toLocaleString()}</Text>
            </View>
          </View>
          <View style={{ backgroundColor: "#F5F5F5", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}>
            <Text style={{ color: "#737373", fontSize: 11, fontWeight: "700" }}>{logs.filter(l => l.cost).length} Logs</Text>
          </View>
        </View>

        {/* MAINTENANCE CARD */}
        <View style={{ backgroundColor: "#fff", borderRadius: 24, padding: 24, marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <Text style={{ fontSize: 14, fontWeight: "800", color: "#334155", letterSpacing: 1 }}>MAINTENANCE</Text>
            <TouchableOpacity onPress={() => setShowScheduleModal(true)} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="add-circle-outline" size={16} color="#3B82F6" />
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#3B82F6" }}>Add Reminder</Text>
            </TouchableOpacity>
          </View>

          {mostUrgentSchedule ? (
            <View>
              <View style={{ alignItems: "center", marginBottom: 24 }}>
                <View style={{ width: 140, height: 140, borderRadius: 70, borderWidth: 12, borderColor: "#EFF6FF", justifyContent: "center", alignItems: "center", position: "relative" }}>
                  <View style={{ position: "absolute", top: -12, left: -12, right: -12, bottom: -12, borderRadius: 82, borderWidth: 12, borderColor: lowestMilesRemaining < 0 ? "#EF4444" : "#3B82F6", borderTopColor: "transparent", borderRightColor: urgentPercentage < 50 ? "transparent" : (lowestMilesRemaining < 0 ? "#EF4444" : "#3B82F6"), transform: [{ rotate: "-45deg" }] }} />

                  <Text style={{ fontSize: 28, fontWeight: "800", color: "#1E293B" }}>{Math.max(0, Math.round(urgentPercentage))}%</Text>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: "#64748B", letterSpacing: 0.5, marginTop: 4 }}>LIFE LEFT</Text>
                </View>
              </View>

              <View style={{ backgroundColor: "#F8FAFC", borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <Ionicons name="calendar-outline" size={24} color="#64748B" />
                <View>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: "#1E293B" }}>
                    {mostUrgentSchedule.service_type} in {Math.max(0, lowestMilesRemaining).toLocaleString()} km
                  </Text>
                  {lowestMilesRemaining < 0 && (
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#EF4444", marginTop: 2 }}>Currently OVERDUE!</Text>
                  )}
                </View>
              </View>

              <TouchableOpacity
                onPress={() => openLogModal(mostUrgentSchedule.service_type)}
                style={{ backgroundColor: "#000", borderRadius: 16, paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Log Service</Text>
                <Ionicons name="open-outline" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ alignItems: "center", paddingVertical: 20 }}>
              <Text style={{ color: "#94A3B8", fontWeight: "600", marginBottom: 16 }}>No maintenance schedules set.</Text>
              <TouchableOpacity onPress={() => setShowScheduleModal(true)} style={{ backgroundColor: "#F1F5F9", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 }}>
                <Text style={{ color: "#3B82F6", fontWeight: "700" }}>+ Add Schedule</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        {schedules.length > 1 && (
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 12, fontWeight: "800", color: "#64748B", letterSpacing: 1, marginBottom: 12, marginLeft: 4 }}>OTHER SCHEDULES</Text>
            {schedules.filter(s => s.id !== mostUrgentSchedule?.id).map(schedule => {
              const remaining = (schedule.last_service_mileage || 0) + schedule.interval_miles - currentDisplayMileage;
              return (
                <View key={schedule.id} style={{ backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View>
                    <Text style={{ fontWeight: "700", color: "#1E293B", fontSize: 15 }}>{schedule.service_type}</Text>
                    <Text style={{ color: "#64748B", fontSize: 12, marginTop: 2 }}>{remaining > 0 ? `in ${remaining.toLocaleString()} km` : 'Overdue'}</Text>
                  </View>
                  <TouchableOpacity onPress={() => openLogModal(schedule.service_type)} style={{ backgroundColor: "#F1F5F9", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}>
                    <Text style={{ color: "#3B82F6", fontSize: 11, fontWeight: "800" }}>LOG</Text>
                  </TouchableOpacity>
                </View>
              )
            })}
          </View>
        )}
        <View style={{ backgroundColor: "#fff", borderRadius: 24, padding: 24, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <Text style={{ fontSize: 14, fontWeight: "800", color: "#334155", letterSpacing: 1 }}>RECENT ACTIVITY</Text>
            <TouchableOpacity onPress={() => openLogModal()}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#3B82F6" }}>Add Log</Text>
            </TouchableOpacity>
          </View>
          {logs.length === 0 ? (
            <Text style={{ color: "#94A3B8", textAlign: "center", marginVertical: 20, fontWeight: "600" }}>No recent activity.</Text>
          ) : (
            <View style={{ gap: 20 }}>
              {logs.map((log, i) => (
                <View key={log.id} style={{ flexDirection: "row", alignItems: "center", borderTopWidth: i === 0 ? 0 : 1, borderTopColor: "#F1F5F9", paddingTop: i === 0 ? 0 : 20 }}>
                  <View style={{ backgroundColor: "#ECFDF5", padding: 12, borderRadius: 12, marginRight: 16 }}>
                    <Ionicons name="document-text" size={20} color="#10B981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: "#1E293B" }}>{log.service_type}</Text>
                    <Text style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>{log.mileage_at_service?.toLocaleString()} km {log.notes ? `• ${log.notes}` : ''}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#1E293B" }}>{log.cost ? `-Rs. ${log.cost.toLocaleString()}` : '--'}</Text>
                    <Text style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>{new Date(log.date_performed).toLocaleDateString()}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

      </ScrollView>

      {/* ── Manual Mileage Update Modal ── */}
      <Modal visible={showUpdateMileageModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 24, padding: 28, width: "100%", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 }}>
            <Text style={{ fontSize: 20, fontWeight: "800", color: "#111827", textAlign: "center", marginBottom: 8 }}>Update Odometer</Text>
            <Text style={{ fontSize: 14, color: "#6B7280", textAlign: "center", marginBottom: 24 }}>Enter your current odometer reading (km).</Text>

            <TextInput
              value={manualMileage}
              onChangeText={setManualMileage}
              keyboardType="numeric"
              style={{ backgroundColor: "#F1F5F9", borderRadius: 16, padding: 16, fontSize: 24, fontWeight: "700", textAlign: "center", color: "#1E293B", marginBottom: 24 }}
            />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity onPress={() => setShowUpdateMileageModal(false)} style={{ flex: 1, backgroundColor: "#F1F5F9", paddingVertical: 16, borderRadius: 16, alignItems: "center" }}>
                <Text style={{ color: "#475569", fontWeight: "700", fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleManualMileageUpdate} disabled={isSaving} style={{ flex: 1, backgroundColor: "#2563EB", paddingVertical: 16, borderRadius: 16, alignItems: "center" }}>
                {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* ── Schedule Modal ── */}
      <Modal visible={showScheduleModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#F8FAFC", borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 28, paddingBottom: 40 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <Text style={{ fontSize: 20, fontWeight: "800", color: "#111827" }}>Add Reminder</Text>
              <TouchableOpacity onPress={() => setShowScheduleModal(false)} style={{ backgroundColor: "#F1F5F9", borderRadius: 50, padding: 8 }}>
                <Ionicons name="close" size={20} color="#374151" />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 10 }}>Quick Presets</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
              {PRESET_SCHEDULES.map((preset) => (
                <TouchableOpacity
                  key={preset.label}
                  onPress={() => {
                    setNewScheduleType(preset.label);
                    setNewScheduleIntervalMiles(preset.interval);
                  }}
                  style={{ backgroundColor: "#EFF6FF", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: "#BFDBFE" }}
                >
                  <Text style={{ color: "#2563EB", fontWeight: "600", fontSize: 13 }}>{preset.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ gap: 16 }}>
              <View>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 8 }}>Service Type</Text>
                <TextInput
                  value={newScheduleType}
                  onChangeText={setNewScheduleType}
                  placeholder="e.g. Tire Rotation, Oil Change"
                  style={{ backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", paddingHorizontal: 16, paddingVertical: 14, fontSize: 15 }}
                />
              </View>
              <View>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 8 }}>Interval (km)</Text>
                <TextInput
                  value={newScheduleIntervalMiles}
                  onChangeText={setNewScheduleIntervalMiles}
                  placeholder="e.g. 5000"
                  keyboardType="numeric"
                  style={{ backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", paddingHorizontal: 16, paddingVertical: 14, fontSize: 15 }}
                />
              </View>
            </View>

            <TouchableOpacity
              onPress={addSchedule}
              disabled={isSaving}
              style={{ backgroundColor: "#2563EB", borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 28 }}
            >
              {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Save Reminder</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Log Service Modal ── */}
      <Modal visible={showLogModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#F8FAFC", borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 28, paddingBottom: 40 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <Text style={{ fontSize: 20, fontWeight: "800", color: "#111827" }}>Log Service</Text>
              <TouchableOpacity onPress={() => setShowLogModal(false)} style={{ backgroundColor: "#F1F5F9", borderRadius: 50, padding: 8 }}>
                <Ionicons name="close" size={20} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ gap: 16 }}>
                <View>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 8 }}>Service Type</Text>
                  <TextInput
                    value={newLogType}
                    onChangeText={setNewLogType}
                    placeholder="e.g. Oil Change"
                    style={{ backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", paddingHorizontal: 16, paddingVertical: 14, fontSize: 15 }}
                  />
                </View>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 8 }}>Odometer (km)</Text>
                    <TextInput
                      value={newLogMileage}
                      onChangeText={setNewLogMileage}
                      placeholder={currentDisplayMileage?.toString() || "0"}
                      keyboardType="numeric"
                      style={{ backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", paddingHorizontal: 16, paddingVertical: 14, fontSize: 15 }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 8 }}>Cost (Rs.) - Optional</Text>
                    <TextInput
                      value={newLogCost}
                      onChangeText={setNewLogCost}
                      placeholder="0.00"
                      keyboardType="numeric"
                      style={{ backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", paddingHorizontal: 16, paddingVertical: 14, fontSize: 15 }}
                    />
                  </View>
                </View>
                <View>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 8 }}>Notes (Optional)</Text>
                  <TextInput
                    value={newLogNotes}
                    onChangeText={setNewLogNotes}
                    placeholder="e.g. Used synthetic oil"
                    multiline
                    style={{ backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, minHeight: 80, textAlignVertical: "top" }}
                  />
                </View>
              </View>

              <TouchableOpacity
                onPress={addLog}
                disabled={isSaving}
                style={{ backgroundColor: "#2563EB", borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 28 }}
              >
                {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Save Log</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}
