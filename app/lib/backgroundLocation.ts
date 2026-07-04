import AsyncStorage from "@react-native-async-storage/async-storage";
import * as TaskManager from "expo-task-manager";

export const BACKGROUND_LOCATION_TASK = "background-location-task";

// Define the background location task if not already defined
if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
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
}
