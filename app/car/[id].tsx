import { useTheme } from "@/app/context/ThemeContext";
import { BACKGROUND_LOCATION_TASK } from "@/app/lib/backgroundLocation";
import { convertAndFormatDistance, convertAndFormatVolume, formatCurrency, getPreferences } from "@/app/lib/settings";
import { createClerkSupabaseClient } from "@/app/lib/supabase";
import Header from "@/components/Header";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";
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
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView as RNSafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  checkOnline,
  getFromCache,
  saveToCache,
  mergeQueueWithState,
  addToOfflineQueue,
  syncOfflineQueue,
  getOfflineQueue
} from "@/app/lib/offlineSync";

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

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const PRESET_SCHEDULES = [
  { label: "Oil Change", interval: "8000" },
  { label: "Tire Rotation", interval: "12000" },
  { label: "Air Filter", interval: "24000" },
  { label: "Brake Pads", interval: "40000" },
  { label: "Coolant Flush", interval: "50000" },
  { label: "Spark Plugs", interval: "30000" },
  { label: "AC Service", interval: "20000" },
  { label: "Transmission Oil", interval: "60000" },
];

export default function CarDetailScreen() {
  const { id } = useLocalSearchParams();
  const carIdString = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const { getToken } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors, theme } = useTheme();

  const [car, setCar] = useState<any>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Preference states
  const [prefCurrency, setPrefCurrency] = useState("Rs.");
  const [prefDistanceUnit, setPrefDistanceUnit] = useState("km");
  const [prefVolumeUnit, setPrefVolumeUnit] = useState("L");
  const isFocused = useIsFocused();

  // Modals
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [showUpdateMileageModal, setShowUpdateMileageModal] = useState(false);
  const [showPetrolModal, setShowPetrolModal] = useState(false);
  const [showLogActionMenu, setShowLogActionMenu] = useState(false);
  const [showPetrolActionMenu, setShowPetrolActionMenu] = useState(false);

  // AI Chat States
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiMessages, setAiMessages] = useState<any[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (car && showAiModal) {
      setAiMessages([
        {
          id: "welcome",
          sender: "ai",
          text: `Hi! I am your AI Virtual Mechanic. I know your vehicle is a **${car.productionYear} ${car.vehicleMake} ${car.modelName}** with **${currentDisplayMileage.toLocaleString()} ${prefDistanceUnit}**.\n\nTell me about any warning lights, strange noises, or performance changes, and I'll help you diagnose the issue!`,
        }
      ]);
    }
  }, [car, showAiModal]);

  const triggerAiQuery = async (queryText: string) => {
    if (!queryText.trim()) return;

    const userMsg = { id: Math.random().toString(), sender: "user", text: queryText };
    setAiMessages(prev => [...prev, userMsg]);
    setAiLoading(true);

    try {
      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Gemini API key is not configured in .env file.");
      }

      const history = aiMessages
        .filter(msg => msg.id !== "welcome")
        .map(msg => ({
          role: msg.sender === "user" ? "user" : "model",
          parts: [{ text: msg.text }]
        }));

      const systemInstruction =
        `You are a professional, friendly, and expert virtual auto mechanic. ` +
        `The user's active vehicle is a ${car.productionYear} ${car.vehicleMake} ${car.modelName} with ${currentDisplayMileage.toLocaleString()} ${prefDistanceUnit}. ` +
        `Provide helpful, concise auto troubleshooting advice, possible causes, estimated repair costs in the user's currency (${prefCurrency}), severity level (whether it's safe to drive), and next steps to inspect or repair. ` +
        `Always format your response using clean Markdown bullet points. Keep it clear and easy to read on a mobile screen.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            ...history,
            { role: "user", parts: [{ text: queryText }] }
          ],
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const resData = await response.json();
      const replyText = resData.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't parse a response. Please try again.";

      setAiMessages(prev => [...prev, { id: Math.random().toString(), sender: "ai", text: replyText }]);
    } catch (error: any) {
      console.error("AI Error:", error);
      setAiMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: "ai",
          text: `⚠️ **Connection Issue**\n\nFailed to reach the AI model: ${error.message || "Unknown error"}.\n\nPlease ensure your \`EXPO_PUBLIC_GEMINI_API_KEY\` is added to your \`.env\` file.`
        }
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSendAiMessage = () => {
    if (!aiQuery.trim()) return;
    const queryCopy = aiQuery;
    setAiQuery("");
    triggerAiQuery(queryCopy);
  };

  // Edit mode tracking
  const [editingLogId, setEditingLogId] = useState<number | null>(null);
  const [editingPetrolLogId, setEditingPetrolLogId] = useState<number | null>(null);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [selectedPetrolLog, setSelectedPetrolLog] = useState<any>(null);

  // Form states - Schedule
  const [newScheduleType, setNewScheduleType] = useState("");
  const [newScheduleIntervalMiles, setNewScheduleIntervalMiles] = useState("");
  const [newScheduleIntervalMonths, setNewScheduleIntervalMonths] = useState("");
  const scheduleTypeInputRef = useRef<any>(null);

  // Form states - Log
  const [newLogType, setNewLogType] = useState("");
  const [newLogMileage, setNewLogMileage] = useState("");
  const [newLogCost, setNewLogCost] = useState("");
  const [newLogNotes, setNewLogNotes] = useState("");

  // Form states - Petrol
  const [petrolLogs, setPetrolLogs] = useState<any[]>([]);
  const [newPetrolLiters, setNewPetrolLiters] = useState("");
  const [newPetrolPricePerLiter, setNewPetrolPricePerLiter] = useState("");
  const [newPetrolMileage, setNewPetrolMileage] = useState("");
  const [newPetrolNotes, setNewPetrolNotes] = useState("");

  const [manualMileage, setManualMileage] = useState("");

  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all');
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const getUniqueYears = () => {
    const yearsSet = new Set<number>();
    yearsSet.add(new Date().getFullYear());

    logs.forEach(log => {
      if (log.date_performed) {
        const y = new Date(log.date_performed).getFullYear();
        if (!isNaN(y)) yearsSet.add(y);
      }
    });
    petrolLogs.forEach(log => {
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

  const filteredLogs = filterLogsByYearAndMonth(logs, 'date_performed');
  const filteredPetrolLogs = filterLogsByYearAndMonth(petrolLogs, 'date');

  const totalPetrolSpent = filteredPetrolLogs.reduce((sum, log) => sum + (log.total_cost || 0), 0);

  // GPS State
  const [isTracking, setIsTracking] = useState(false);
  const [tripDistance, setTripDistance] = useState(0);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const lastLocationRef = useRef<Location.LocationObject | null>(null);

  const [isSaving, setIsSaving] = useState(false);

  const currentDisplayMileage = parseInt(car?.currentMileage || 0) + Math.round(tripDistance);
  const totalSpent = filteredLogs.reduce((sum, log) => sum + (log.cost || 0), 0);

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

  const monthlyBreakdown = getMonthlyBreakdown(logs, petrolLogs);
  const yearlyBreakdown = getYearlyBreakdown(logs, petrolLogs);

  // Sync background location status on mount
  useEffect(() => {
    const syncTrackingState = async () => {
      try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
        setIsTracking(isRegistered);
        if (isRegistered) {
          const storedDataStr = await AsyncStorage.getItem("temp_trip_tracking");
          if (storedDataStr) {
            const trackingData = JSON.parse(storedDataStr);
            setTripDistance(trackingData.tripDistance || 0);
          }
        }
      } catch (err) {
        console.error("Error syncing tracking state:", err);
      }
    };
    syncTrackingState();
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      const prefs = await getPreferences();
      setPrefCurrency(prefs.currency);
      setPrefDistanceUnit(prefs.distanceUnit);
      setPrefVolumeUnit(prefs.volumeUnit);
    };
    if (isFocused) {
      loadSettings();
      fetchCarDetails();
    }
  }, [id, isFocused]);

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
              color: "#EF4444",
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
              color: "#3B82F6",
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
      const online = await checkOnline();
      setIsOffline(!online);

      const queue = await getOfflineQueue();
      const carIdString = Array.isArray(id) ? id[0] : id;

      if (online) {
        const token = await getToken({ template: "supabase" });
        if (token) {
          setIsSyncing(true);
          await syncOfflineQueue(token);
          setIsSyncing(false);

          const supabase = createClerkSupabaseClient(token);

          const { data: carData } = await supabase.from("cars").select("*").eq("id", id).single();
          if (carData) {
            setCar(carData);
            setManualMileage(carData.currentMileage?.toString() || "");
            await saveToCache(`car_${carIdString}`, carData);
          }

          const { data: scheduleData } = await supabase.from("service_schedules").select("*").eq("car_id", id);
          if (scheduleData) {
            setSchedules(scheduleData);
            await saveToCache(`schedules_${carIdString}`, scheduleData);
          }

          const { data: logData } = await supabase.from("service_logs").select("*").eq("car_id", id).order("date_performed", { ascending: false });
          if (logData) {
            setLogs(logData);
            await saveToCache(`logs_${carIdString}`, logData);
          }

          const { data: petrolData } = await supabase.from("petrol_logs").select("*").eq("car_id", id).order("date", { ascending: false });
          if (petrolData) {
            setPetrolLogs(petrolData);
            await saveToCache(`petrol_${carIdString}`, petrolData);
          }

          if (carData && scheduleData) {
            await checkServiceReminders(carData, scheduleData);
          }
          return;
        }
      }

      // Fallback to cache if offline or token fetching failed
      let cachedCar = await getFromCache(`car_${carIdString}`);
      if (!cachedCar) {
        const garageCars = await getFromCache("garage_cars") || [];
        cachedCar = garageCars.find((c: any) => String(c.id) === String(carIdString)) || null;
      }

      let cachedSchedules = await getFromCache(`schedules_${carIdString}`);
      if (!cachedSchedules && cachedCar) {
        cachedSchedules = cachedCar.service_schedules || [];
      }
      if (!cachedSchedules) cachedSchedules = [];

      const cachedLogs = await getFromCache(`logs_${carIdString}`) || [];
      const cachedPetrol = await getFromCache(`petrol_${carIdString}`) || [];

      const finalCar = cachedCar ? mergeQueueWithState([cachedCar], queue, 'cars', carIdString)[0] : null;
      const finalSchedules = mergeQueueWithState(cachedSchedules, queue, 'service_schedules', carIdString);
      const finalLogs = mergeQueueWithState(cachedLogs, queue, 'service_logs', carIdString);
      const finalPetrol = mergeQueueWithState(cachedPetrol, queue, 'petrol_logs', carIdString);

      if (finalCar) {
        setCar(finalCar);
        setManualMileage(finalCar.currentMileage?.toString() || "");
      }
      setSchedules(finalSchedules);
      setLogs(finalLogs);
      setPetrolLogs(finalPetrol);
    } catch (err) {
      console.error(err);
      const queue = await getOfflineQueue();
      let cachedCar = await getFromCache(`car_${carIdString}`);
      if (!cachedCar) {
        const garageCars = await getFromCache("garage_cars") || [];
        cachedCar = garageCars.find((c: any) => String(c.id) === String(carIdString)) || null;
      }

      let cachedSchedules = await getFromCache(`schedules_${carIdString}`);
      if (!cachedSchedules && cachedCar) {
        cachedSchedules = cachedCar.service_schedules || [];
      }
      if (!cachedSchedules) cachedSchedules = [];

      const cachedLogs = await getFromCache(`logs_${carIdString}`) || [];
      const cachedPetrol = await getFromCache(`petrol_${carIdString}`) || [];

      const finalCar = cachedCar ? mergeQueueWithState([cachedCar], queue, 'cars', carIdString)[0] : null;
      const finalSchedules = mergeQueueWithState(cachedSchedules, queue, 'service_schedules', carIdString);
      const finalLogs = mergeQueueWithState(cachedLogs, queue, 'service_logs', carIdString);
      const finalPetrol = mergeQueueWithState(cachedPetrol, queue, 'petrol_logs', carIdString);

      if (finalCar) {
        setCar(finalCar);
        setManualMileage(finalCar.currentMileage?.toString() || "");
      }
      setSchedules(finalSchedules);
      setLogs(finalLogs);
      setPetrolLogs(finalPetrol);
    } finally {
      setIsLoading(false);
    }
  };

  const updateCarMileage = async (newMileage: number) => {
    try {
      const online = await checkOnline();
      setCar((prev: any) => {
        const nextCar = prev ? { ...prev, currentMileage: newMileage } : null;
        if (nextCar) saveToCache(`car_${carIdString}`, nextCar);
        return nextCar;
      });

      if (online) {
        const token = await getToken({ template: "supabase" });
        if (!token) return;
        const supabase = createClerkSupabaseClient(token);
        await supabase.from("cars").update({ currentMileage: newMileage }).eq("id", carIdString);
      } else {
        await addToOfflineQueue({
          table: 'cars',
          action: 'UPDATE',
          payload: { currentMileage: newMileage },
          recordId: carIdString,
        });
      }

      if (car && schedules) {
        await checkServiceReminders({ ...car, currentMileage: newMileage }, schedules);
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
      try {
        const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
        if (fgStatus !== 'granted') {
          alert('Foreground location permission is required for Drive Mode');
          return;
        }

        let bgStatus = 'denied';
        try {
          const bgPerm = await Location.requestBackgroundPermissionsAsync();
          bgStatus = bgPerm.status;
        } catch (bgErr) {
          console.error("Error requesting background location permissions:", bgErr);
          alert("Background location permission request failed. AutoTrack will attempt to track with foreground location.");
          bgStatus = 'granted';
        }

        if (bgStatus !== 'granted') {
          alert('Background location permission (Allow all the time) is required to track in background.');
          return;
        }

        try {
          await Notifications.requestPermissionsAsync();
        } catch (notifErr) {
          console.warn("Notifications permission request failed:", notifErr);
        }

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
      } catch (err: any) {
        console.error("Error starting location updates:", err);
        setIsTracking(false);
        await AsyncStorage.removeItem("temp_trip_tracking").catch(() => {});
        alert(`Failed to start drive mode: ${err?.message || err}`);
      }
    }
  };

  const addSchedule = async () => {
    if (!newScheduleType || !newScheduleIntervalMiles) return;
    setIsSaving(true);
    try {
      const payload = {
        car_id: id,
        service_type: newScheduleType,
        interval_miles: parseInt(newScheduleIntervalMiles),
        interval_months: newScheduleIntervalMonths ? parseInt(newScheduleIntervalMonths) : null,
        last_service_mileage: car?.currentMileage || 0,
        last_service_date: new Date().toISOString(),
      };

      const online = await checkOnline();
      if (online) {
        const token = await getToken({ template: "supabase" });
        if (!token) return;
        const supabase = createClerkSupabaseClient(token);
        await supabase.from("service_schedules").insert([payload]);
      } else {
        await addToOfflineQueue({
          table: 'service_schedules',
          action: 'INSERT',
          payload,
          recordId: `temp_${Date.now()}`,
        });
      }
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
      const payload: any = {
        service_type: newLogType,
        mileage_at_service: parseInt(newLogMileage),
        cost: newLogCost ? parseFloat(newLogCost) : null,
        notes: newLogNotes,
      };

      const online = await checkOnline();

      if (editingLogId) {
        if (online) {
          const token = await getToken({ template: "supabase" });
          if (!token) return;
          const supabase = createClerkSupabaseClient(token);
          await supabase.from("service_logs").update(payload).eq("id", editingLogId);
        } else {
          await addToOfflineQueue({
            table: 'service_logs',
            action: 'UPDATE',
            payload,
            recordId: editingLogId,
          });
        }
      } else {
        payload.car_id = id;
        payload.date_performed = new Date().toISOString();

        if (online) {
          const token = await getToken({ template: "supabase" });
          if (!token) return;
          const supabase = createClerkSupabaseClient(token);
          const { error } = await supabase.from("service_logs").insert([payload]);

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
        } else {
          await addToOfflineQueue({
            table: 'service_logs',
            action: 'INSERT',
            payload,
            recordId: `temp_${Date.now()}`,
          });

          if (parseInt(newLogMileage) > (car?.currentMileage || 0)) {
            await updateCarMileage(parseInt(newLogMileage));
          }

          const scheduleToUpdate = schedules.find(s => s.service_type.toLowerCase() === newLogType.toLowerCase());
          if (scheduleToUpdate) {
            await addToOfflineQueue({
              table: 'service_schedules',
              action: 'UPDATE',
              payload: {
                last_service_mileage: parseInt(newLogMileage),
                last_service_date: new Date().toISOString(),
              },
              recordId: scheduleToUpdate.id,
            });
          }
        }
      }
    } finally {
      setIsSaving(false);
      setShowLogModal(false);
      setEditingLogId(null);
      fetchCarDetails();
      setNewLogType("");
      setNewLogMileage("");
      setNewLogCost("");
      setNewLogNotes("");
    }
  };

  const addPetrolLog = async () => {
    if (!newPetrolLiters || !newPetrolPricePerLiter) return;
    setIsSaving(true);
    try {
      const liters = parseFloat(newPetrolLiters);
      const pricePerLiter = parseFloat(newPetrolPricePerLiter);
      const totalCost = Math.round(liters * pricePerLiter);

      const payload: any = {
        liters,
        price_per_liter: pricePerLiter,
        total_cost: totalCost,
        mileage_at_fillup: newPetrolMileage ? parseInt(newPetrolMileage) : null,
        notes: newPetrolNotes || null,
      };

      const online = await checkOnline();

      if (editingPetrolLogId) {
        if (online) {
          const token = await getToken({ template: "supabase" });
          if (!token) return;
          const supabase = createClerkSupabaseClient(token);
          await supabase.from("petrol_logs").update(payload).eq("id", editingPetrolLogId);
        } else {
          await addToOfflineQueue({
            table: 'petrol_logs',
            action: 'UPDATE',
            payload,
            recordId: editingPetrolLogId,
          });
        }
      } else {
        payload.car_id = id;
        payload.date = new Date().toISOString();

        if (online) {
          const token = await getToken({ template: "supabase" });
          if (!token) return;
          const supabase = createClerkSupabaseClient(token);
          const { error } = await supabase.from("petrol_logs").insert([payload]);

          if (!error && newPetrolMileage) {
            const mileage = parseInt(newPetrolMileage);
            if (mileage > (car?.currentMileage || 0)) {
              await updateCarMileage(mileage);
            }
          }
        } else {
          await addToOfflineQueue({
            table: 'petrol_logs',
            action: 'INSERT',
            payload,
            recordId: `temp_${Date.now()}`,
          });

          if (newPetrolMileage) {
            const mileage = parseInt(newPetrolMileage);
            if (mileage > (car?.currentMileage || 0)) {
              await updateCarMileage(mileage);
            }
          }
        }
      }
    } finally {
      setIsSaving(false);
      setShowPetrolModal(false);
      setEditingPetrolLogId(null);
      fetchCarDetails();
      setNewPetrolLiters("");
      setNewPetrolPricePerLiter("");
      setNewPetrolMileage("");
      setNewPetrolNotes("");
    }
  };

  const deleteServiceLog = async (logId: number) => {
    try {
      const online = await checkOnline();
      if (online) {
        const token = await getToken({ template: "supabase" });
        if (!token) return;
        const supabase = createClerkSupabaseClient(token);
        await supabase.from("service_logs").delete().eq("id", logId);
      } else {
        await addToOfflineQueue({
          table: 'service_logs',
          action: 'DELETE',
          payload: {},
          recordId: logId,
        });
      }
      fetchCarDetails();
    } catch (err) {
      console.error(err);
    }
  };

  const deletePetrolLog = async (logId: number) => {
    try {
      const online = await checkOnline();
      if (online) {
        const token = await getToken({ template: "supabase" });
        if (!token) return;
        const supabase = createClerkSupabaseClient(token);
        await supabase.from("petrol_logs").delete().eq("id", logId);
      } else {
        await addToOfflineQueue({
          table: 'petrol_logs',
          action: 'DELETE',
          payload: {},
          recordId: logId,
        });
      }
      fetchCarDetails();
    } catch (err) {
      console.error(err);
    }
  };

  const openEditServiceLog = (log: any) => {
    setEditingLogId(log.id);
    setNewLogType(log.service_type);
    setNewLogMileage(log.mileage_at_service?.toString() || "");
    setNewLogCost(log.cost?.toString() || "");
    setNewLogNotes(log.notes || "");
    setShowLogActionMenu(false);
    setShowLogModal(true);
  };

  const openEditPetrolLog = (log: any) => {
    setEditingPetrolLogId(log.id);
    setNewPetrolLiters(log.liters?.toString() || "");
    setNewPetrolPricePerLiter(log.price_per_liter?.toString() || "");
    setNewPetrolMileage(log.mileage_at_fillup?.toString() || "");
    setNewPetrolNotes(log.notes || "");
    setShowPetrolActionMenu(false);
    setShowPetrolModal(true);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!car) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: colors.text }}>Car not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: colors.primary, fontWeight: "600" }}>Go Back</Text>
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <Header
        showBack
        hideProfile
        title={`${car.vehicleMake} ${car.modelName}`}
        subtitle={car.vin ? `VIN: ${car.vin}` : undefined}
        rightElement={
          <TouchableOpacity onPress={() => setShowUpdateMileageModal(true)} style={{ backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}>
            <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "800" }}>UPDATE ODOMETER</Text>
          </TouchableOpacity>
        }
      />
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 60 + insets.bottom }}>

        {/* HERO CARD */}
        <View style={{ backgroundColor: "#111827", borderRadius: 24, overflow: "hidden", height: 210, marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 15, elevation: 8 }}>
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
              <View style={{ backgroundColor: colors.primary, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginBottom: 8 }}>
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
          style={{ marginBottom: 20, backgroundColor: isTracking ? "#EF4444" : colors.primary, borderRadius: 16, paddingVertical: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 }}
        >
          <Ionicons name={isTracking ? "stop-circle" : "navigate"} size={20} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
            {isTracking ? `Stop Drive (${tripDistance.toFixed(1)} km)` : "Start Drive Mode (GPS)"}
          </Text>
        </TouchableOpacity>

        {/* AI MECHANIC ASSISTANT CARD */}
        <TouchableOpacity
          onPress={() => setShowAiModal(true)}
          style={{
            marginBottom: 20,
            borderRadius: 16,
            overflow: "hidden",
            elevation: 4,
            shadowColor: "#059669",
            shadowOpacity: 0.15,
            shadowRadius: 10,
          }}
        >
          <LinearGradient
            colors={["#10B981", "#059669"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ backgroundColor: "rgba(255,255,255,0.2)", padding: 8, borderRadius: 12 }}>
                <Ionicons name="sparkles" size={20} color="#fff" />
              </View>
              <View>
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Ask AI Mechanic</Text>
                <Text style={{ color: "#A7F3D0", fontSize: 11, marginTop: 2 }}>Diagnose noises, warning lights & issues</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        {/* QUICK STATS GRID */}
        <View style={{ backgroundColor: colors.card, borderRadius: 24, padding: 20, flexDirection: "row", flexWrap: "wrap", rowGap: 24, marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ width: "50%" }}>
            <Text style={{ fontSize: 10, fontWeight: "800", color: colors.textMuted, letterSpacing: 0.5, marginBottom: 6 }}>ODOMETER</Text>
            <Text style={{ fontSize: 16, color: colors.text }}><Text style={{ fontWeight: "700" }}>{currentDisplayMileage.toLocaleString()}</Text> km</Text>
          </View>
          <View style={{ width: "50%" }}>
            <Text style={{ fontSize: 10, fontWeight: "800", color: colors.textMuted, letterSpacing: 0.5, marginBottom: 6 }}>AVG CONSUMPTION</Text>
            <Text style={{ fontSize: 16, color: colors.text }}><Text style={{ fontWeight: "700" }}>{car.avg_consumption || "--"}</Text> km/l</Text>
          </View>
          <View style={{ width: "50%" }}>
            <Text style={{ fontSize: 10, fontWeight: "800", color: colors.textMuted, letterSpacing: 0.5, marginBottom: 6 }}>LAST SERVICE</Text>
            <Text style={{ fontSize: 16, color: colors.text, fontWeight: "700" }}>
              {filteredLogs.length > 0 ? new Date(filteredLogs[0].date_performed).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : "--"}
            </Text>
          </View>
          <View style={{ width: "50%" }}>
            <Text style={{ fontSize: 10, fontWeight: "800", color: colors.textMuted, letterSpacing: 0.5, marginBottom: 6 }}>TIRE PRESSURE</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={{ fontSize: 16, color: colors.text }}><Text style={{ fontWeight: "700" }}>{car.tire_pressure || "--"}</Text> psi</Text>
            </View>
          </View>
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

        {/* TOTAL SPEND CARD */}
        <View style={{ backgroundColor: colors.card, borderRadius: 24, padding: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ backgroundColor: "#FEF3C7", padding: 12, borderRadius: 16 }}>
              <Ionicons name="wallet-outline" size={24} color="#D97706" />
            </View>
            <View>
              <Text style={{ fontSize: 10, fontWeight: "800", color: colors.textMuted, letterSpacing: 0.5, marginBottom: 4 }}>TOTAL MAINTENANCE SPEND</Text>
              <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text }}>{formatCurrency(totalSpent, prefCurrency)}</Text>
            </View>
          </View>
          <View style={{ backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}>
            <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>{filteredLogs.filter(l => l.cost).length} Logs</Text>
          </View>
        </View>

        {/* PETROL SPEND CARD */}
        <View style={{ backgroundColor: colors.card, borderRadius: 24, padding: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ backgroundColor: colors.greenBg, padding: 12, borderRadius: 16 }}>
              <Ionicons name="flame-outline" size={24} color={colors.greenText} />
            </View>
            <View>
              <Text style={{ fontSize: 10, fontWeight: "800", color: colors.greenText, letterSpacing: 0.5, marginBottom: 4 }}>TOTAL PETROL SPEND</Text>
              <Text style={{ fontSize: 20, fontWeight: "800", color: colors.greenText }}>{formatCurrency(totalPetrolSpent, prefCurrency)}</Text>
            </View>
          </View>
          <View style={{ backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}>
            <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>{filteredPetrolLogs.length} Fill-ups</Text>
          </View>
        </View>

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
                            <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: "600" }}>Service: {formatCurrency(item.service, prefCurrency)}</Text>
                          </View>
                        )}
                        {item.petrol > 0 && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#16A34A" }} />
                            <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: "600" }}>Petrol: {formatCurrency(item.petrol, prefCurrency)}</Text>
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
                            <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: "600" }}>Service: {formatCurrency(item.service, prefCurrency)}</Text>
                          </View>
                        )}
                        {item.petrol > 0 && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#16A34A" }} />
                            <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: "600" }}>Petrol: {formatCurrency(item.petrol, prefCurrency)}</Text>
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

        {/* MAINTENANCE CARD */}
        <View style={{ backgroundColor: colors.card, borderRadius: 24, padding: 24, marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <Text style={{ fontSize: 14, fontWeight: "800", color: colors.textMuted, letterSpacing: 1 }}>MAINTENANCE</Text>
            <TouchableOpacity onPress={() => setShowScheduleModal(true)} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>Add Reminder</Text>
            </TouchableOpacity>
          </View>

          {mostUrgentSchedule ? (
            <View>
              <View style={{ alignItems: "center", marginBottom: 24 }}>
                <View style={{ width: 140, height: 140, borderRadius: 70, borderWidth: 12, borderColor: colors.accent, justifyContent: "center", alignItems: "center", position: "relative" }}>
                  <View style={{ position: "absolute", top: -12, left: -12, right: -12, bottom: -12, borderRadius: 82, borderWidth: 12, borderColor: lowestMilesRemaining < 0 ? "#EF4444" : colors.primary, borderTopColor: "transparent", borderRightColor: urgentPercentage < 50 ? "transparent" : (lowestMilesRemaining < 0 ? "#EF4444" : colors.primary), transform: [{ rotate: "-45deg" }] }} />

                  <Text style={{ fontSize: 28, fontWeight: "800", color: colors.text }}>{Math.max(0, Math.round(urgentPercentage))}%</Text>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.5, marginTop: 4 }}>LIFE LEFT</Text>
                </View>
              </View>

              <View style={{ backgroundColor: colors.accent, borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <Ionicons name="calendar-outline" size={24} color={colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>
                    {mostUrgentSchedule.service_type} in {convertAndFormatDistance(Math.max(0, lowestMilesRemaining), prefDistanceUnit)}
                  </Text>
                  {lowestMilesRemaining < 0 && (
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#EF4444", marginTop: 2 }}>Currently OVERDUE!</Text>
                  )}
                </View>
              </View>

              <TouchableOpacity
                onPress={() => openLogModal(mostUrgentSchedule.service_type)}
                style={{ backgroundColor: colors.text, borderRadius: 16, paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
              >
                <Text style={{ color: theme === 'dark' ? 'black' : '#fff', fontWeight: "700", fontSize: 15 }}>Log Service</Text>
                <Ionicons name="open-outline" size={16} color={theme === 'dark' ? 'black' : '#fff'} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ alignItems: "center", paddingVertical: 20 }}>
              <Text style={{ color: colors.textMuted, fontWeight: "600", marginBottom: 16 }}>No maintenance schedules set.</Text>
              <TouchableOpacity onPress={() => setShowScheduleModal(true)} style={{ backgroundColor: colors.accent, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 }}>
                <Text style={{ color: colors.primary, fontWeight: "700" }}>+ Add Schedule</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {schedules.length > 1 && (
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 12, fontWeight: "800", color: colors.textMuted, letterSpacing: 1, marginBottom: 12, marginLeft: 4 }}>OTHER SCHEDULES</Text>
            {schedules.filter(s => s.id !== mostUrgentSchedule?.id).map(schedule => {
              const remaining = (schedule.last_service_mileage || 0) + schedule.interval_miles - currentDisplayMileage;
              return (
                <View key={schedule.id} style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
                  <View>
                    <Text style={{ fontWeight: "700", color: colors.text, fontSize: 15 }}>{schedule.service_type}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{remaining > 0 ? `in ${convertAndFormatDistance(remaining, prefDistanceUnit)}` : 'Overdue'}</Text>
                  </View>
                  <TouchableOpacity onPress={() => openLogModal(schedule.service_type)} style={{ backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}>
                    <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "800" }}>LOG</Text>
                  </TouchableOpacity>
                </View>
              )
            })}
          </View>
        )}

        <View style={{ backgroundColor: colors.card, borderRadius: 24, padding: 24, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <Text style={{ fontSize: 14, fontWeight: "800", color: colors.textMuted, letterSpacing: 1 }}>RECENT ACTIVITY</Text>
            <TouchableOpacity onPress={() => openLogModal()}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>Add Log</Text>
            </TouchableOpacity>
          </View>
          {filteredLogs.length === 0 ? (
            <Text style={{ color: colors.textMuted, textAlign: "center", marginVertical: 20, fontWeight: "600" }}>No recent activity.</Text>
          ) : (
            <View style={{ gap: 20 }}>
              {filteredLogs.map((log, i) => (
                <View key={log.id} style={{ flexDirection: "row", alignItems: "center", borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border, paddingTop: i === 0 ? 0 : 20 }}>
                  <View style={{ backgroundColor: colors.accent, padding: 12, borderRadius: 12, marginRight: 16 }}>
                    <Ionicons name="document-text" size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>{log.service_type}</Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>{convertAndFormatDistance(log.mileage_at_service, prefDistanceUnit)} {log.notes ? `• ${log.notes}` : ''}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>{log.cost ? `-${formatCurrency(log.cost, prefCurrency)}` : '--'}</Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>{new Date(log.date_performed).toLocaleDateString()}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => { setSelectedLog(log); setShowLogActionMenu(true); }}
                    style={{ padding: 8, marginLeft: 8 }}
                  >
                    <Ionicons name="ellipsis-vertical" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* PETROL LOGS CARD */}
        <View style={{ backgroundColor: colors.card, borderRadius: 24, padding: 24, marginTop: 20, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="flame" size={16} color={colors.greenText} />
              <Text style={{ fontSize: 14, fontWeight: "800", color: colors.textMuted, letterSpacing: 1 }}>PETROL LOGS</Text>
            </View>
            <TouchableOpacity onPress={() => setShowPetrolModal(true)}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.greenText }}>+ Add Fill-up</Text>
            </TouchableOpacity>
          </View>
          {filteredPetrolLogs.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 20 }}>
              <View style={{ backgroundColor: colors.greenBg, padding: 16, borderRadius: 50, marginBottom: 12 }}>
                <Ionicons name="flame-outline" size={28} color={colors.greenText} />
              </View>
              <Text style={{ color: colors.textMuted, fontWeight: "600", marginBottom: 12 }}>No petrol logs yet.</Text>
              <TouchableOpacity onPress={() => setShowPetrolModal(true)} style={{ backgroundColor: colors.greenBg, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 }}>
                <Text style={{ color: colors.greenText, fontWeight: "700" }}>Log your first fill-up</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 20 }}>
              {filteredPetrolLogs.map((log, i) => (
                <View key={log.id} style={{ flexDirection: "row", alignItems: "center", borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border, paddingTop: i === 0 ? 0 : 20 }}>
                  <View style={{ backgroundColor: colors.greenBg, padding: 12, borderRadius: 12, marginRight: 16 }}>
                    <Ionicons name="flame" size={20} color={colors.greenText} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>{convertAndFormatVolume(log.liters, prefVolumeUnit)} @ {formatCurrency(log.price_per_liter, prefCurrency)}/{prefVolumeUnit}</Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
                      {convertAndFormatDistance(log.mileage_at_fillup, prefDistanceUnit)}{log.notes ? ` • ${log.notes}` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>-{formatCurrency(log.total_cost, prefCurrency)}</Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>{new Date(log.date).toLocaleDateString()}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => { setSelectedPetrolLog(log); setShowPetrolActionMenu(true); }}
                    style={{ padding: 8, marginLeft: 8 }}
                  >
                    <Ionicons name="ellipsis-vertical" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

      </ScrollView>

      {/* ── Service Log Action Menu ── */}
      <Modal
        visible={showLogActionMenu}
        transparent
        animationType="fade"
        statusBarTranslucent
        hardwareAccelerated
        onRequestClose={() => setShowLogActionMenu(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowLogActionMenu(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}
        >
          <TouchableOpacity activeOpacity={1} style={{ backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, textAlign: "center", marginBottom: 20 }}>
              {selectedLog?.service_type}
            </Text>
            <TouchableOpacity
              onPress={() => openEditServiceLog(selectedLog)}
              style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}
            >
              <View style={{ backgroundColor: colors.accent, padding: 10, borderRadius: 12 }}>
                <Ionicons name="pencil-outline" size={20} color={colors.primary} />
              </View>
              <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>Edit Log</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setShowLogActionMenu(false); deleteServiceLog(selectedLog?.id); }}
              style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 16 }}
            >
              <View style={{ backgroundColor: "#FEE2E2", padding: 10, borderRadius: 12 }}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </View>
              <Text style={{ fontSize: 16, fontWeight: "600", color: "#EF4444" }}>Delete Log</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Petrol Log Action Menu ── */}
      <Modal
        visible={showPetrolActionMenu}
        transparent
        animationType="fade"
        statusBarTranslucent
        hardwareAccelerated
        onRequestClose={() => setShowPetrolActionMenu(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowPetrolActionMenu(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}
        >
          <TouchableOpacity activeOpacity={1} style={{ backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, textAlign: "center", marginBottom: 20 }}>
              {selectedPetrolLog ? `${convertAndFormatVolume(selectedPetrolLog.liters, prefVolumeUnit)} fill-up` : ""}
            </Text>
            <TouchableOpacity
              onPress={() => openEditPetrolLog(selectedPetrolLog)}
              style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}
            >
              <View style={{ backgroundColor: colors.greenBg, padding: 10, borderRadius: 12 }}>
                <Ionicons name="pencil-outline" size={20} color={colors.greenText} />
              </View>
              <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>Edit Fill-up</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setShowPetrolActionMenu(false); deletePetrolLog(selectedPetrolLog?.id); }}
              style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 16 }}
            >
              <View style={{ backgroundColor: "#FEE2E2", padding: 10, borderRadius: 12 }}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </View>
              <Text style={{ fontSize: 16, fontWeight: "600", color: "#EF4444" }}>Delete Fill-up</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Petrol Log Modal ── */}
      <Modal
        visible={showPetrolModal}
        transparent
        animationType="slide"
        statusBarTranslucent
        hardwareAccelerated
        onRequestClose={() => setShowPetrolModal(false)}
      >
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 28, paddingBottom: 20, maxHeight: "90%", borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="flame" size={22} color={colors.greenText} />
                  <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text }}>
                    {editingPetrolLogId ? "Edit Fill-up" : "Log Fill-up"}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setShowPetrolModal(false)} style={{ backgroundColor: colors.accent, borderRadius: 50, padding: 8 }}>
                  <Ionicons name="close" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={{ gap: 16 }}>
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: 8 }}>Volume ({prefVolumeUnit})</Text>
                      <TextInput
                        value={newPetrolLiters}
                        onChangeText={setNewPetrolLiters}
                        placeholder="e.g. 35"
                        keyboardType="numeric"
                        placeholderTextColor={colors.textMuted}
                        style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: colors.text }}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: 8 }}>Price per unit ({prefCurrency})</Text>
                      <TextInput
                        value={newPetrolPricePerLiter}
                        onChangeText={setNewPetrolPricePerLiter}
                        placeholder="e.g. 282"
                        keyboardType="numeric"
                        placeholderTextColor={colors.textMuted}
                        style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: colors.text }}
                      />
                    </View>
                  </View>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: 8 }}>Odometer at Fill-up ({prefDistanceUnit})</Text>
                    <TextInput
                      value={newPetrolMileage}
                      onChangeText={setNewPetrolMileage}
                      placeholder={currentDisplayMileage?.toString() || "0"}
                      keyboardType="numeric"
                      placeholderTextColor={colors.textMuted}
                      style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: colors.text }}
                    />
                  </View>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: 8 }}>Notes (Optional)</Text>
                    <TextInput
                      value={newPetrolNotes}
                      onChangeText={setNewPetrolNotes}
                      placeholder="e.g. Full tank, highway trip"
                      multiline
                      placeholderTextColor={colors.textMuted}
                      style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, minHeight: 70, textAlignVertical: "top", color: colors.text }}
                    />
                  </View>
                </View>
                <TouchableOpacity
                  onPress={addPetrolLog}
                  disabled={isSaving}
                  style={{ backgroundColor: "#16A34A", borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 24, marginBottom: 8 }}
                >
                  {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>{editingPetrolLogId ? "Save Changes" : "Save Fill-up"}</Text>}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Manual Mileage Update Modal ── */}
      <Modal
        visible={showUpdateMileageModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        hardwareAccelerated
        onRequestClose={() => setShowUpdateMileageModal(false)}
      >
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 24 }}>
            <View style={{ backgroundColor: colors.card, borderRadius: 24, padding: 28, width: "100%", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 20, elevation: 10, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text, textAlign: "center", marginBottom: 8 }}>Update Odometer</Text>
              <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: "center", marginBottom: 24 }}>Enter your current odometer reading ({prefDistanceUnit}).</Text>
              <TextInput
                value={manualMileage}
                onChangeText={setManualMileage}
                keyboardType="numeric"
                style={{ backgroundColor: colors.accent, borderRadius: 16, padding: 16, fontSize: 24, fontWeight: "700", textAlign: "center", color: colors.text, marginBottom: 24 }}
              />
              <View style={{ flexDirection: "row", gap: 12 }}>
                <TouchableOpacity onPress={() => setShowUpdateMileageModal(false)} style={{ flex: 1, backgroundColor: colors.accent, paddingVertical: 16, borderRadius: 16, alignItems: "center" }}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleManualMileageUpdate} disabled={isSaving} style={{ flex: 1, backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 16, alignItems: "center" }}>
                  {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Schedule Modal ── */}
      <Modal
        visible={showScheduleModal}
        transparent
        animationType="slide"
        statusBarTranslucent
        hardwareAccelerated
        onRequestClose={() => setShowScheduleModal(false)}
      >
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 28, paddingBottom: 20, maxHeight: "90%", borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text }}>Add Reminder</Text>
                <TouchableOpacity onPress={() => setShowScheduleModal(false)} style={{ backgroundColor: colors.accent, borderRadius: 50, padding: 8 }}>
                  <Ionicons name="close" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: 10 }}>Quick Presets</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  {PRESET_SCHEDULES.map((preset) => (
                    <TouchableOpacity
                      key={preset.label}
                      onPress={() => { setNewScheduleType(preset.label); setNewScheduleIntervalMiles(preset.interval.toString()); }}
                      style={{
                        backgroundColor: newScheduleType === preset.label ? colors.primary : colors.accent,
                        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
                        borderWidth: 1, borderColor: newScheduleType === preset.label ? colors.primary : colors.border
                      }}
                    >
                      <Text style={{ color: newScheduleType === preset.label ? "#fff" : colors.primary, fontWeight: "600", fontSize: 13 }}>{preset.label}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    onPress={() => { setNewScheduleType(""); setNewScheduleIntervalMiles(""); setTimeout(() => scheduleTypeInputRef.current?.focus(), 100); }}
                    style={{ backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 4 }}
                  >
                    <Ionicons name="pencil" size={13} color={colors.textMuted} />
                    <Text style={{ color: colors.textMuted, fontWeight: "600", fontSize: 13 }}>Custom...</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ gap: 14 }}>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: 8 }}>Service Type</Text>
                    <TextInput
                      ref={scheduleTypeInputRef}
                      value={newScheduleType}
                      onChangeText={setNewScheduleType}
                      placeholder="Select a preset or type your own..."
                      placeholderTextColor={colors.textMuted}
                      style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: colors.text }}
                    />
                  </View>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: 8 }}>Interval ({prefDistanceUnit})</Text>
                    <TextInput
                      value={newScheduleIntervalMiles}
                      onChangeText={setNewScheduleIntervalMiles}
                      placeholder="e.g. 5000"
                      keyboardType="numeric"
                      placeholderTextColor={colors.textMuted}
                      style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: colors.text }}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  onPress={addSchedule}
                  disabled={isSaving}
                  style={{ backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 24, marginBottom: 20 }}
                >
                  {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Save Reminder</Text>}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Log Service Modal ── */}
      <Modal
        visible={showLogModal}
        transparent
        animationType="slide"
        statusBarTranslucent
        hardwareAccelerated
        onRequestClose={() => setShowLogModal(false)}
      >
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 28, paddingBottom: 20, maxHeight: "90%", borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text }}>{editingLogId ? "Edit Log" : "Log Service"}</Text>
                <TouchableOpacity onPress={() => setShowLogModal(false)} style={{ backgroundColor: colors.accent, borderRadius: 50, padding: 8 }}>
                  <Ionicons name="close" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={{ gap: 16 }}>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: 8 }}>Service Type</Text>
                    <TextInput
                      value={newLogType}
                      onChangeText={setNewLogType}
                      placeholder="e.g. Oil Change"
                      placeholderTextColor={colors.textMuted}
                      style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: colors.text }}
                    />
                  </View>
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: 8 }}>Odometer ({prefDistanceUnit})</Text>
                      <TextInput
                        value={newLogMileage}
                        onChangeText={setNewLogMileage}
                        placeholder={currentDisplayMileage?.toString() || "0"}
                        keyboardType="numeric"
                        placeholderTextColor={colors.textMuted}
                        style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: colors.text }}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: 8 }}>Cost ({prefCurrency}) - Optional</Text>
                      <TextInput
                        value={newLogCost}
                        onChangeText={setNewLogCost}
                        placeholder="0.00"
                        keyboardType="numeric"
                        placeholderTextColor={colors.textMuted}
                        style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: colors.text }}
                      />
                    </View>
                  </View>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: 8 }}>Notes (Optional)</Text>
                    <TextInput
                      value={newLogNotes}
                      onChangeText={setNewLogNotes}
                      placeholder="e.g. Used synthetic oil"
                      multiline
                      placeholderTextColor={colors.textMuted}
                      style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, minHeight: 80, textAlignVertical: "top", color: colors.text }}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  onPress={addLog}
                  disabled={isSaving}
                  style={{ backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 28, marginBottom: 8 }}
                >
                  {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>{editingLogId ? "Save Changes" : "Save Log"}</Text>}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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

      {/* AI Chat Modal */}
      <Modal transparent visible={showAiModal} animationType="slide" onRequestClose={() => setShowAiModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, height: "85%", padding: 24, paddingBottom: 16, borderWidth: 1, borderColor: colors.border }}>
              {/* Header */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <LinearGradient
                    colors={["#10B981", "#059669"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ padding: 8, borderRadius: 12 }}
                  >
                    <Ionicons name="sparkles" size={18} color="#fff" />
                  </LinearGradient>
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>AI Mechanic</Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>Diagnostics Assistant</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setShowAiModal(false)} style={{ backgroundColor: colors.accent, borderRadius: 50, padding: 8 }}>
                  <Ionicons name="close" size={18} color={colors.text} />
                </TouchableOpacity>
              </View>

              {/* Chat Window */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ gap: 16, paddingBottom: 20 }}
                ref={(ref) => ref?.scrollToEnd({ animated: true })}
              >
                {aiMessages.map((msg) => (
                  <View
                    key={msg.id}
                    style={{
                      alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
                      maxWidth: "85%",
                      backgroundColor: msg.sender === "user" ? "#059669" : colors.card,
                      borderRadius: 20,
                      borderTopRightRadius: msg.sender === "user" ? 4 : 20,
                      borderTopLeftRadius: msg.sender === "user" ? 20 : 4,
                      padding: 14,
                      borderWidth: msg.sender === "user" ? 0 : 1,
                      borderColor: colors.border,
                      shadowColor: "#000",
                      shadowOpacity: 0.02,
                      shadowRadius: 5,
                      elevation: 1,
                    }}
                  >
                    <Text style={{ fontSize: 14, lineHeight: 20, color: msg.sender === "user" ? "#fff" : colors.text }}>
                      {msg.text}
                    </Text>
                  </View>
                ))}

                {aiLoading && (
                  <View style={{ alignSelf: "flex-start", backgroundColor: colors.card, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ActivityIndicator size="small" color="#059669" />
                    <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: "600" }}>Analysing diagnostics...</Text>
                  </View>
                )}
              </ScrollView>

              {/* Suggestion Starter Tags */}
              {aiMessages.length === 1 && !aiLoading && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.5, marginBottom: 8, textTransform: "uppercase" }}>Common Questions</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {[
                      { tag: "🔊 Brakes squeaking", query: "My brakes are squeaking when I press them." },
                      { tag: "⚠️ Check engine light", query: "My dashboard has a solid check engine light." },
                      { tag: "💨 Exhaust smoke", query: "I notice white smoke coming from my exhaust." },
                      { tag: "🔧 Checklist", query: "What checklist should I perform at this mileage?" },
                    ].map((item) => (
                      <TouchableOpacity
                        key={item.tag}
                        onPress={() => {
                          triggerAiQuery(item.query);
                        }}
                        style={{ backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}
                      >
                        <Text style={{ fontSize: 12, color: colors.text, fontWeight: "600" }}>{item.tag}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Input Area */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 }}>
                <TextInput
                  value={aiQuery}
                  onChangeText={setAiQuery}
                  placeholder="Describe your car's issue..."
                  placeholderTextColor={colors.textMuted}
                  style={{ flex: 1, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: colors.text }}
                  onSubmitEditing={handleSendAiMessage}
                />
                <TouchableOpacity
                  onPress={handleSendAiMessage}
                  disabled={!aiQuery.trim() || aiLoading}
                  style={{
                    backgroundColor: aiQuery.trim() && !aiLoading ? "#059669" : colors.border,
                    padding: 12,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="send" size={18} color={aiQuery.trim() && !aiLoading ? "#fff" : colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}
