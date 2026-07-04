import AsyncStorage from "@react-native-async-storage/async-storage";

export interface AppPreferences {
  currency: string;
  distanceUnit: string; // 'km' | 'mi'
  volumeUnit: string; // 'L' | 'gal'
  theme: string; // 'light' | 'dark'
}

export const getPreferences = async (): Promise<AppPreferences> => {
  try {
    const currency = await AsyncStorage.getItem("autotrack_currency") || "Rs.";
    const distanceUnit = await AsyncStorage.getItem("autotrack_distance_unit") || "km";
    const volumeUnit = await AsyncStorage.getItem("autotrack_volume_unit") || "L";
    const theme = await AsyncStorage.getItem("autotrack_theme") || "light";
    return { currency, distanceUnit, volumeUnit, theme };
  } catch (e) {
    return { currency: "Rs.", distanceUnit: "km", volumeUnit: "L", theme: "light" };
  }
};

export const formatCurrency = (amount: number, currencySymbol: string) => {
  const value = typeof amount === "number" ? amount : parseFloat(amount) || 0;
  return `${currencySymbol}${value.toLocaleString()}`;
};

export const convertAndFormatDistance = (kmVal: number, unit: string) => {
  const km = typeof kmVal === "number" ? kmVal : parseFloat(kmVal) || 0;
  if (unit === "mi") {
    return `${Math.round(km * 0.621371).toLocaleString()} mi`;
  }
  return `${Math.round(km).toLocaleString()} km`;
};

export const convertAndFormatVolume = (litersVal: number, unit: string) => {
  const liters = typeof litersVal === "number" ? litersVal : parseFloat(litersVal) || 0;
  if (unit === "gal") {
    return `${(liters * 0.264172).toFixed(1)} gal`;
  }
  return `${liters.toFixed(1)} L`;
};
