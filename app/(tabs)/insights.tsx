import { createClerkSupabaseClient } from "@/app/lib/supabase";
import { getPreferences, formatCurrency, convertAndFormatDistance, convertAndFormatVolume } from "@/app/lib/settings";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { styled } from "nativewind";
import React, { useEffect, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView as RNSafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/app/context/ThemeContext";

const SafeAreaView = styled(RNSafeAreaView);
const { width: screenWidth } = Dimensions.get("window");

interface Car {
  id: string;
  nickname: string;
  vehicleMake: string;
  modelName: string;
  currentMileage: number;
  imageUrl?: string;
}

interface ServiceLog {
  id: string;
  car_id: string;
  cost: number;
  date_performed: string;
  service_type: string;
  mileage: number;
}

interface PetrolLog {
  id: string;
  car_id: string;
  total_cost: number;
  date: string;
  liters: number;
  price_per_liter: number;
  mileage: number;
}

interface ServiceSchedule {
  id: string;
  car_id: string;
  service_type: string;
  interval_miles: number;
  interval_months?: number;
  last_service_mileage: number;
  last_service_date: string;
}

export default function InsightsScreen() {
  const { getToken } = useAuth();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { theme, colors } = useTheme();

  const [cars, setCars] = useState<Car[]>([]);
  const [serviceLogs, setServiceLogs] = useState<ServiceLog[]>([]);
  const [petrolLogs, setPetrolLogs] = useState<PetrolLog[]>([]);
  const [schedules, setSchedules] = useState<ServiceSchedule[]>([]);

  const [selectedCarId, setSelectedCarId] = useState<string | "all">("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeBarIndex, setActiveBarIndex] = useState<number | null>(null);

  // Unit preferences state
  const [prefCurrency, setPrefCurrency] = useState("Rs.");
  const [prefDistanceUnit, setPrefDistanceUnit] = useState("km");
  const [prefVolumeUnit, setPrefVolumeUnit] = useState("L");

  const formatFuelEconomy = (kmL: number) => {
    if (prefDistanceUnit === "mi") {
      const mpg = kmL * 2.35215;
      return `${mpg.toFixed(1)} mpg`;
    }
    return `${kmL.toFixed(1)} km/l`;
  };

  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const prefs = await getPreferences();
      setPrefCurrency(prefs.currency);
      setPrefDistanceUnit(prefs.distanceUnit);
      setPrefVolumeUnit(prefs.volumeUnit);

      const token = await getToken({ template: "supabase" });
      if (!token) return;
      const supabase = createClerkSupabaseClient(token);

      // Fetch cars
      const { data: carsData } = await supabase
        .from("cars")
        .select("*")
        .order("created_at", { ascending: false });
      if (carsData) setCars(carsData);

      // Fetch service logs
      const { data: sLogs } = await supabase
        .from("service_logs")
        .select("*")
        .order("date_performed", { ascending: false });
      if (sLogs) setServiceLogs(sLogs || []);

      // Fetch petrol logs
      const { data: pLogs } = await supabase
        .from("petrol_logs")
        .select("*")
        .order("date", { ascending: false });
      if (pLogs) setPetrolLogs(pLogs || []);

      // Fetch schedules
      const { data: schedData } = await supabase
        .from("service_schedules")
        .select("*");
      if (schedData) setSchedules(schedData || []);

    } catch (error) {
      console.error("Error loading insights:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      loadData();
    }
  }, [isFocused]);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadData(true);
  };

  // Helper: Get distance driven by a single car
  const getCarDistance = (car: Car, carSLogs: ServiceLog[], carPLogs: PetrolLog[]) => {
    const mileages = [
      ...carSLogs.map((l) => l.mileage).filter(Boolean),
      ...carPLogs.map((l) => l.mileage).filter(Boolean),
    ];
    if (mileages.length === 0) return 0;
    const minM = Math.min(...mileages);
    const maxM = Math.max(car.currentMileage || 0, ...mileages);
    return Math.max(0, maxM - minM);
  };

  // Memoized stats based on selected car
  const stats = useMemo(() => {
    const filteredCars = selectedCarId === "all" ? cars : cars.filter((c) => c.id === selectedCarId);
    const carIds = new Set(filteredCars.map((c) => c.id));

    const sLogs = serviceLogs.filter((l) => carIds.has(l.car_id));
    const pLogs = petrolLogs.filter((l) => carIds.has(l.car_id));
    const activeScheds = schedules.filter((s) => carIds.has(s.car_id));

    const totalMaintenance = sLogs.reduce((sum, l) => sum + (Number(l.cost) || 0), 0);
    const totalPetrol = pLogs.reduce((sum, l) => sum + (Number(l.total_cost) || 0), 0);
    const grandTotal = totalMaintenance + totalPetrol;

    // Calculate total distance driven
    const distanceDriven = filteredCars.reduce((sum, car) => {
      const carS = sLogs.filter((l) => l.car_id === car.id);
      const carP = pLogs.filter((l) => l.car_id === car.id);
      return sum + getCarDistance(car, carS, carP);
    }, 0);

    const costPerKm = distanceDriven > 0 ? grandTotal / distanceDriven : 0;

    // Service category breakdown
    const categoryMap: { [key: string]: number } = {};
    sLogs.forEach((log) => {
      const category = (log.service_type || "Other").trim();
      categoryMap[category] = (categoryMap[category] || 0) + (Number(log.cost) || 0);
    });

    const categoryList = Object.entries(categoryMap)
      .map(([name, cost]) => ({
        name,
        cost,
        percentage: totalMaintenance > 0 ? (cost / totalMaintenance) * 100 : 0,
      }))
      .sort((a, b) => b.cost - a.cost);

    // Fuel economy trends
    const fuelLogsByCar: { [carId: string]: PetrolLog[] } = {};
    pLogs.forEach((log) => {
      if (!fuelLogsByCar[log.car_id]) fuelLogsByCar[log.car_id] = [];
      fuelLogsByCar[log.car_id].push(log);
    });

    let overallDistance = 0;
    let overallLiters = 0;
    const individualPoints: { carName: string; kmL: number; date: string; liters: number; cost: number }[] = [];

    Object.entries(fuelLogsByCar).forEach(([carId, logs]) => {
      const carObj = cars.find((c) => c.id === carId);
      const carName = carObj ? `${carObj.vehicleMake} ${carObj.modelName}` : "Car";
      const sorted = [...logs].sort((a, b) => (a.mileage || 0) - (b.mileage || 0));

      for (let i = 1; i < sorted.length; i++) {
        const dist = (sorted[i].mileage || 0) - (sorted[i - 1].mileage || 0);
        const liters = sorted[i].liters || 0;
        if (dist > 0 && liters > 0) {
          overallDistance += dist;
          overallLiters += liters;
          individualPoints.push({
            carName,
            kmL: dist / liters,
            date: sorted[i].date,
            liters,
            cost: sorted[i].total_cost,
          });
        }
      }
    });

    const averageKmL = overallLiters > 0 ? overallDistance / overallLiters : 0;

    // Predict upcoming services based on average distance driven per week
    const forecasts = activeScheds.map((sched) => {
      const carObj = cars.find((c) => c.id === sched.car_id);
      const carName = carObj ? `${carObj.vehicleMake} ${carObj.modelName}` : "Car";
      const carCurrentMileage = carObj ? carObj.currentMileage : 0;

      // Estimate weekly average (default to 250km if not enough logs)
      const carS = sLogs.filter((l) => l.car_id === sched.car_id);
      const carP = pLogs.filter((l) => l.car_id === sched.car_id);
      const totalCarDist = getCarDistance(carObj!, carS, carP);

      let weeklyAvg = 250; // standard fallback
      if (carP.length > 1) {
        const dates = carP.map((l) => new Date(l.date).getTime()).filter(Boolean);
        const minTime = Math.min(...dates);
        const maxTime = Math.max(...dates);
        const diffWeeks = (maxTime - minTime) / (1000 * 60 * 60 * 24 * 7);
        if (diffWeeks > 1) {
          weeklyAvg = Math.max(50, totalCarDist / diffWeeks);
        }
      }

      const dueMileage = (sched.last_service_mileage || 0) + (sched.interval_miles || 0);
      const distRemaining = dueMileage - carCurrentMileage;
      const weeksRemaining = distRemaining / weeklyAvg;

      let forecastedDate = "N/A";
      let status: "good" | "due_soon" | "overdue" = "good";

      if (distRemaining <= 0) {
        status = "overdue";
        forecastedDate = "Overdue now!";
      } else {
        if (distRemaining < 500) {
          status = "due_soon";
        }
        const forecastMs = Date.now() + weeksRemaining * 7 * 24 * 60 * 60 * 1000;
        forecastedDate = new Date(forecastMs).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      }

      return {
        id: sched.id,
        service_type: sched.service_type,
        carName,
        distRemaining,
        forecastedDate,
        status,
      };
    });

    return {
      totalMaintenance,
      totalPetrol,
      grandTotal,
      distanceDriven,
      costPerKm,
      categoryList,
      averageKmL,
      individualPoints: individualPoints.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      forecasts,
    };
  }, [selectedCarId, cars, serviceLogs, petrolLogs, schedules]);

  // Render comparative car fuel economy for overall view
  const carFuelComparison = useMemo(() => {
    if (selectedCarId !== "all") return [];
    return cars.map((car) => {
      const carPLogs = petrolLogs.filter((l) => l.car_id === car.id);
      const sorted = [...carPLogs].sort((a, b) => (a.mileage || 0) - (b.mileage || 0));
      let dist = 0;
      let lit = 0;
      for (let i = 1; i < sorted.length; i++) {
        const d = (sorted[i].mileage || 0) - (sorted[i - 1].mileage || 0);
        const l = sorted[i].liters || 0;
        if (d > 0 && l > 0) {
          dist += d;
          lit += l;
        }
      }
      return {
        name: `${car.vehicleMake} ${car.modelName}`,
        kmL: lit > 0 ? dist / lit : 0,
      };
    }).filter(c => c.kmL > 0);
  }, [selectedCarId, cars, petrolLogs]);

  // Selected bar details for interactive fuel trend chart
  const selectedBarDetail = useMemo(() => {
    if (activeBarIndex === null || activeBarIndex >= stats.individualPoints.length) return null;
    return stats.individualPoints[activeBarIndex];
  }, [activeBarIndex, stats.individualPoints]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      {/* ── HEADER ── */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 }}>
        <Text style={{ fontSize: 11, fontWeight: "900", color: colors.primary, letterSpacing: 1.5, textTransform: "uppercase" }}>
          Metrics & Trends
        </Text>
        <Text style={{ fontSize: 26, fontWeight: "800", color: colors.text, marginTop: 4 }}>
          Insights & Analytics
        </Text>
      </View>

      {/* ── CAR SELECTION CAROUSEL ── */}
      <View style={{ marginBottom: 16 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
        >
          {/* All Vehicles Selector */}
          <TouchableOpacity
            onPress={() => { setSelectedCarId("all"); setActiveBarIndex(null); }}
            style={{
              paddingHorizontal: 18,
              paddingVertical: 12,
              borderRadius: 18,
              backgroundColor: selectedCarId === "all" ? (theme === "dark" ? "#3B82F6" : "#1E293B") : colors.card,
              borderWidth: 1,
              borderColor: selectedCarId === "all" ? (theme === "dark" ? "#3B82F6" : "#1E293B") : colors.border,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              shadowColor: "#000",
              shadowOpacity: selectedCarId === "all" ? 0.08 : 0,
              shadowRadius: 5,
              elevation: selectedCarId === "all" ? 2 : 0,
            }}
          >
            <Ionicons name="grid-outline" size={16} color={selectedCarId === "all" ? "#fff" : colors.textMuted} />
            <Text style={{ fontSize: 13, fontWeight: "700", color: selectedCarId === "all" ? "#fff" : colors.text }}>
              All Vehicles
            </Text>
          </TouchableOpacity>

          {/* Individual Car Selectors */}
          {cars.map((car) => {
            const isSelected = selectedCarId === car.id;
            return (
              <TouchableOpacity
                key={car.id}
                onPress={() => { setSelectedCarId(car.id); setActiveBarIndex(null); }}
                style={{
                  paddingHorizontal: 18,
                  paddingVertical: 12,
                  borderRadius: 18,
                  backgroundColor: isSelected ? (theme === "dark" ? "#3B82F6" : "#1E293B") : colors.card,
                  borderWidth: 1,
                  borderColor: isSelected ? (theme === "dark" ? "#3B82F6" : "#1E293B") : colors.border,
                  shadowColor: "#000",
                  shadowOpacity: isSelected ? 0.08 : 0,
                  shadowRadius: 5,
                  elevation: isSelected ? 2 : 0,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: isSelected ? "#fff" : colors.text }}>
                  {car.nickname || `${car.vehicleMake} ${car.modelName}`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── MAIN CONTENT ── */}
      {isLoading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        >
          {/* ── CARD 1: COST PER KILOMETER ── */}
          <LinearGradient
            colors={theme === "dark" ? ["#1E293B", "#0F172A"] : ["#1E3A8A", "#0D9488"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 28, padding: 24, marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 15, elevation: 5, borderWidth: theme === "dark" ? 1 : 0, borderColor: colors.border }}
          >
            <Text style={{ color: "#E0F2FE", fontSize: 10, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" }}>
              Operational Efficiency
            </Text>
            <Text style={{ color: "#fff", fontSize: 32, fontWeight: "900", marginTop: 8 }}>
              {formatCurrency(stats.costPerKm, prefCurrency)} <Text style={{ fontSize: 14, fontWeight: "600", color: "#93C5FD" }}>/ {prefDistanceUnit}</Text>
            </Text>
            <Text style={{ color: "#E0F2FE", fontSize: 12, fontWeight: "500", marginTop: 12, lineHeight: 18 }}>
              Based on a grand total of <Text style={{ fontWeight: "700", color: "#fff" }}>{formatCurrency(stats.grandTotal, prefCurrency)}</Text> spent over an odometer span of <Text style={{ fontWeight: "700", color: "#fff" }}>{convertAndFormatDistance(stats.distanceDriven, prefDistanceUnit)}</Text> of recorded travel.
            </Text>
          </LinearGradient>

          {/* ── CARD 2: FINANCIAL SPENDING RATIO ── */}
          <View style={{ backgroundColor: colors.card, borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 8, elevation: 1, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 15, fontWeight: "800", color: colors.text, marginBottom: 16 }}>
              Spending Distribution
            </Text>

            {/* Split Bar */}
            <View style={{ height: 16, backgroundColor: colors.accent, borderRadius: 999, overflow: "hidden", flexDirection: "row", marginBottom: 20 }}>
              {stats.grandTotal > 0 ? (
                <>
                  <View style={{ width: `${(stats.totalMaintenance / stats.grandTotal) * 100}%`, backgroundColor: "#D97706" }} />
                  <View style={{ width: `${(stats.totalPetrol / stats.grandTotal) * 100}%`, backgroundColor: "#10B981" }} />
                </>
              ) : (
                <View style={{ flex: 1, backgroundColor: colors.border }} />
              )}
            </View>

            {/* Labels */}
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: "#D97706" }} />
                  <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textMuted }}>MAINTENANCE</Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: "800", color: colors.text, marginTop: 4 }}>
                  {formatCurrency(stats.totalMaintenance, prefCurrency)}
                </Text>
                <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: "600", marginTop: 2 }}>
                  {stats.grandTotal > 0 ? ((stats.totalMaintenance / stats.grandTotal) * 100).toFixed(0) : 0}% of total
                </Text>
              </View>

              <View style={{ alignItems: "flex-end" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textMuted }}>PETROL</Text>
                  <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: "#10B981" }} />
                </View>
                <Text style={{ fontSize: 15, fontWeight: "800", color: colors.text, marginTop: 4 }}>
                  {formatCurrency(stats.totalPetrol, prefCurrency)}
                </Text>
                <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: "600", marginTop: 2 }}>
                  {stats.grandTotal > 0 ? ((stats.totalPetrol / stats.grandTotal) * 100).toFixed(0) : 0}% of total
                </Text>
              </View>
            </View>
          </View>

          {/* ── CARD 3: FUEL ECONOMY ANALYTICS ── */}
          <View style={{ backgroundColor: colors.card, borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 8, elevation: 1, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <View>
                <Text style={{ fontSize: 15, fontWeight: "800", color: colors.text }}>Fuel Efficiency Trends</Text>
                <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: "500", marginTop: 2 }}>
                  {selectedCarId === "all" ? "Average across all logs" : "Fill-up history"}
                </Text>
              </View>
              <View style={{ backgroundColor: colors.greenBg, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: colors.greenText }}>
                  {stats.averageKmL > 0 ? formatFuelEconomy(stats.averageKmL) : "--"}
                </Text>
              </View>
            </View>

            {/* Interactive Fuel Chart (Custom Native Bar Chart) */}
            {selectedCarId === "all" ? (
              // Display Comparative Chart for Vehicles
              carFuelComparison.length > 0 ? (
                <View style={{ gap: 14, marginTop: 10 }}>
                  {carFuelComparison.map((item) => (
                    <View key={item.name}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }} numberOfLines={1}>{item.name}</Text>
                        <Text style={{ fontSize: 12, fontWeight: "800", color: "#10B981" }}>{formatFuelEconomy(item.kmL)}</Text>
                      </View>
                      <View style={{ height: 8, backgroundColor: colors.accent, borderRadius: 999, overflow: "hidden" }}>
                        <View style={{ width: `${Math.min(100, (item.kmL / 25) * 100)}%`, backgroundColor: "#10B981", height: "100%", borderRadius: 999 }} />
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={{ textAlign: "center", color: colors.textMuted, fontSize: 13, paddingVertical: 20 }}>
                  Log petrol with odometer readings on multiple fill-ups to see fuel comparisons.
                </Text>
              )
            ) : (
              // Display Trend for Specific Car
              stats.individualPoints.length > 0 ? (
                <View>
                  {/* Tooltip Overlay */}
                  {selectedBarDetail && (
                    <View style={{ backgroundColor: colors.accent, borderRadius: 14, padding: 12, borderLeftWidth: 4, borderLeftColor: "#10B981", marginBottom: 16 }}>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textMuted }}>
                        {new Date(selectedBarDetail.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </Text>
                      <View style={{ flexDirection: "row", gap: 12, marginTop: 6 }}>
                        <Text style={{ fontSize: 12, color: colors.text }}>
                          <Text style={{ fontWeight: "700" }}>{formatFuelEconomy(selectedBarDetail.kmL)}</Text>
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.text }}>
                          <Text style={{ fontWeight: "700" }}>{convertAndFormatVolume(selectedBarDetail.liters, prefVolumeUnit)}</Text>
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.text }}>
                          <Text style={{ fontWeight: "700" }}>{formatCurrency(selectedBarDetail.cost, prefCurrency)}</Text>
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Horizontal Bar Chart */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: "flex-end", height: 160, gap: 10, paddingVertical: 10 }}>
                    {stats.individualPoints.map((pt, idx) => {
                      const maxKmL = 25; // max scale
                      const heightPercent = Math.min(100, (pt.kmL / maxKmL) * 100);
                      const isSelected = activeBarIndex === idx;

                      return (
                        <TouchableOpacity
                           key={idx}
                           onPress={() => setActiveBarIndex(isSelected ? null : idx)}
                           activeOpacity={0.8}
                           style={{ alignItems: "center" }}
                        >
                          <View
                            style={{
                              height: 110,
                              justifyContent: "flex-end",
                              width: 32,
                            }}
                          >
                            <View
                              style={{
                                height: `${heightPercent}%`,
                                width: "100%",
                                backgroundColor: isSelected ? (theme === "dark" ? "#3B82F6" : "#059669") : "#10B981",
                                borderTopLeftRadius: 6,
                                borderTopRightRadius: 6,
                                opacity: isSelected ? 1 : 0.85,
                              }}
                            />
                          </View>
                          <Text style={{ fontSize: 8, fontWeight: "700", color: colors.textMuted, marginTop: 6 }}>
                            {new Date(pt.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  <Text style={{ fontSize: 10, color: colors.textMuted, textAlign: "center", fontStyle: "italic", marginTop: 8 }}>
                    *Tap on any bar to see specific liters & total cost details.
                  </Text>
                </View>
              ) : (
                <Text style={{ textAlign: "center", color: colors.textMuted, fontSize: 13, paddingVertical: 20 }}>
                  Requires at least two fill-ups to calculate km/l fuel economy logs.
                </Text>
              )
            )}
          </View>

          {/* ── CARD 4: SERVICE CATEGORY COST BREAKDOWN ── */}
          <View style={{ backgroundColor: colors.card, borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 8, elevation: 1, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 15, fontWeight: "800", color: colors.text, marginBottom: 16 }}>
              Maintenance Categories
            </Text>

            {stats.categoryList.length > 0 ? (
              <View style={{ gap: 16 }}>
                {stats.categoryList.map((cat) => (
                  <View key={cat.name}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>{cat.name}</Text>
                      <Text style={{ fontSize: 13, fontWeight: "800", color: colors.text }}>
                        {formatCurrency(cat.cost, prefCurrency)}
                      </Text>
                    </View>
                    <View style={{ height: 6, backgroundColor: colors.accent, borderRadius: 999, overflow: "hidden" }}>
                      <View style={{ width: `${cat.percentage}%`, backgroundColor: "#D97706", height: "100%", borderRadius: 999 }} />
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ textAlign: "center", color: colors.textMuted, fontSize: 13, paddingVertical: 12 }}>
                No maintenance logs categorized yet.
              </Text>
            )}
          </View>

          {/* ── CARD 5: PREDICTIVE SERVICE FORECASTER ── */}
          <View style={{ backgroundColor: colors.card, borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 8, elevation: 1, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 15, fontWeight: "800", color: colors.text, marginBottom: 4 }}>
              Predictive Service Forecast
            </Text>
            <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: "500", marginBottom: 16 }}>
              Estimated calendar milestones based on weekly driving averages
            </Text>

            {stats.forecasts.length > 0 ? (
              <View style={{ gap: 12 }}>
                {stats.forecasts.map((forecast) => {
                  const isOverdue = forecast.status === "overdue";
                  const isSoon = forecast.status === "due_soon";

                  return (
                    <View
                      key={forecast.id}
                      style={{
                        padding: 14,
                        borderRadius: 16,
                        backgroundColor: isOverdue ? (theme === "dark" ? "#441D1D" : "#FEF2F2") : isSoon ? (theme === "dark" ? "#452E1D" : "#FFFBEB") : colors.accent,
                        borderWidth: 1,
                        borderColor: isOverdue ? "#EF4444" : isSoon ? "#D97706" : colors.border,
                      }}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>
                            {forecast.service_type}
                          </Text>
                          {selectedCarId === "all" && (
                            <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: "600", marginTop: 2 }}>
                              {forecast.carName}
                            </Text>
                          )}
                        </View>
                        <View
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 8,
                            backgroundColor: isOverdue ? "#EF4444" : isSoon ? "#D97706" : colors.primary,
                          }}
                        >
                          <Text style={{ fontSize: 9, fontWeight: "800", color: "#fff", textTransform: "uppercase" }}>
                            {forecast.status === "overdue" ? "Overdue" : forecast.status === "due_soon" ? "Soon" : "Good"}
                          </Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 12, borderTopWidth: 1, borderTopColor: isOverdue ? "#EF4444" : isSoon ? "#D97706" : colors.border, paddingTop: 10 }}>
                        <View>
                          <Text style={{ fontSize: 9, color: colors.textMuted, fontWeight: "700" }}>REMAINING</Text>
                          <Text style={{ fontSize: 12, fontWeight: "800", color: isOverdue ? "#EF4444" : colors.text, marginTop: 2 }}>
                            {isOverdue ? "None" : convertAndFormatDistance(forecast.distRemaining, prefDistanceUnit)}
                          </Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={{ fontSize: 9, color: colors.textMuted, fontWeight: "700" }}>EST. DUE DATE</Text>
                          <Text style={{ fontSize: 12, fontWeight: "800", color: colors.text, marginTop: 2 }}>
                            {forecast.forecastedDate}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={{ textAlign: "center", color: colors.textMuted, fontSize: 13, paddingVertical: 12 }}>
                No active service schedules set for forecasting.
              </Text>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}