import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClerkSupabaseClient } from "./supabase";

export interface OfflineAction {
  id: string;
  table: 'cars' | 'service_schedules' | 'service_logs' | 'petrol_logs';
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: any;
  recordId?: any; // Real ID if exists, or temp ID
  tempCarId?: string; // If this action references a car created offline
}

// 1. Check if the device is currently online
export const checkOnline = async (): Promise<boolean> => {
  const pingEndpoint = async (url: string, expectedStatus?: number): Promise<boolean> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (expectedStatus !== undefined) {
        return response.status === expectedStatus;
      }
      return response.ok || response.status < 400;
    } catch (e) {
      clearTimeout(timeoutId);
      return false;
    }
  };



  try {
    const [googleOk, cloudflareOk] = await Promise.all([
      pingEndpoint("https://clients3.google.com/generate_204", 204),
      pingEndpoint("https://1.1.1.1"),
    ]);
    return googleOk || cloudflareOk;
  } catch (error) {
    return false;
  }
};

// Helper: Get offline queue
export const getOfflineQueue = async (): Promise<OfflineAction[]> => {
  try {
    const queueStr = await AsyncStorage.getItem("autotrack_offline_queue");
    return queueStr ? JSON.parse(queueStr) : [];
  } catch (e) {
    console.error("Error reading offline queue:", e);
    return [];
  }
};

// Helper: Save offline queue
export const saveOfflineQueue = async (queue: OfflineAction[]): Promise<void> => {
  try {
    await AsyncStorage.setItem("autotrack_offline_queue", JSON.stringify(queue));
  } catch (e) {
    console.error("Error saving offline queue:", e);
  }
};

// 2. Add an action to the offline queue
export const addToOfflineQueue = async (action: Omit<OfflineAction, "id">): Promise<void> => {
  const queue = await getOfflineQueue();
  const newAction: OfflineAction = {
    ...action,
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  };
  queue.push(newAction);
  await saveOfflineQueue(queue);
};

// 3. Cache helpers
export const saveToCache = async (key: string, data: any): Promise<void> => {
  try {
    await AsyncStorage.setItem(`autotrack_cache_${key}`, JSON.stringify(data));
  } catch (e) {
    console.error("Error writing cache:", e);
  }
};

export const getFromCache = async (key: string): Promise<any | null> => {
  try {
    const dataStr = await AsyncStorage.getItem(`autotrack_cache_${key}`);
    return dataStr ? JSON.parse(dataStr) : null;
  } catch (e) {
    console.error("Error reading cache:", e);
    return null;
  }
};

// 4. Merge cached data with pending offline queue mutations for local UI display
export const applyOfflineActions = (
  cachedData: any[],
  table: OfflineAction['table'],
  carId?: string | number
): any[] => {
  if (!cachedData) cachedData = [];

  // Clone the cached data so we don't mutate parameters
  let result = [...cachedData];

  // We read the queue synchronously (since this function is called inside UI renders or state sets)
  // Note: Since reading AsyncStorage is async, we should resolve this in the component's load function.
  return result;
};

// 5. Apply the queue mutations to a fetched state array
export const mergeQueueWithState = (
  stateData: any[],
  queue: OfflineAction[],
  table: OfflineAction['table'],
  carId?: string | number
): any[] => {
  let result = [...stateData];

  // Filter actions relevant to this table and specific car (if applicable)
  const relevantActions = queue.filter(action => {
    if (action.table !== table) return false;

    // If filtering by carId, check if it matches
    if (carId) {
      if (table === 'cars') {
        return action.recordId === carId || action.payload?.id === carId;
      }
      const itemCarId = action.payload?.car_id || action.tempCarId;
      return String(itemCarId) === String(carId);
    }
    return true;
  });

  relevantActions.forEach(item => {
    if (item.action === 'INSERT') {
      // Avoid duplicate insertion
      const exists = result.some(r => String(r.id) === String(item.recordId || item.payload.id));
      if (!exists) {
        result.unshift({
          ...item.payload,
          id: item.recordId || `temp_${Date.now()}`,
          isOfflinePending: true,
        });
      }
    } else if (item.action === 'UPDATE') {
      result = result.map(r => {
        if (String(r.id) === String(item.recordId)) {
          return { ...r, ...item.payload, isOfflinePending: true };
        }
        return r;
      });
    } else if (item.action === 'DELETE') {
      result = result.filter(r => String(r.id) === String(item.recordId));
    }
  });

  return result;
};

// 6. Sync the offline queue with Supabase
export const syncOfflineQueue = async (clerkToken: string): Promise<boolean> => {
  const queue = await getOfflineQueue();
  if (queue.length === 0) return true;

  const isOnline = await checkOnline();
  if (!isOnline) return false;

  const supabase = createClerkSupabaseClient(clerkToken);
  const remainingQueue: OfflineAction[] = [];

  // Track temporary IDs mapped to real IDs returned by Supabase
  const idMap: { [tempId: string]: any } = {};

  for (const action of queue) {
    try {
      let payload = { ...action.payload };

      // Resolve temp car IDs if they were inserted earlier in this sync run
      if (action.tempCarId && idMap[action.tempCarId]) {
        payload.car_id = idMap[action.tempCarId];
      }
      if (action.table !== 'cars' && payload.car_id && idMap[payload.car_id]) {
        payload.car_id = idMap[payload.car_id];
      }

      if (action.action === 'INSERT') {
        // Strip temporary offline properties
        delete payload.id;
        delete payload.isOfflinePending;

        const { data, error } = await supabase
          .from(action.table)
          .insert([payload])
          .select()
          .single();

        if (error) throw error;

        // If it was a car insert, store the new real ID mapping
        if (action.table === 'cars' && action.recordId && data) {
          idMap[action.recordId] = data.id;
        }
      } else if (action.action === 'UPDATE') {
        let targetId = action.recordId;
        if (idMap[targetId]) {
          targetId = idMap[targetId];
        }

        // If it is still a temp ID, we skip it since it was never successfully inserted
        if (String(targetId).startsWith('temp_')) {
          continue;
        }

        // Strip temporary offline properties
        delete payload.id;
        delete payload.isOfflinePending;

        const { error } = await supabase
          .from(action.table)
          .update(payload)
          .eq('id', targetId);

        if (error) throw error;
      } else if (action.action === 'DELETE') {
        let targetId = action.recordId;
        if (idMap[targetId]) {
          targetId = idMap[targetId];
        }
        if (String(targetId).startsWith('temp_')) {
          continue;
        }
        const { error } = await supabase
          .from(action.table)
          .delete()
          .eq('id', targetId);

        if (error) throw error;
      }
    } catch (err) {
      console.error(`Offline sync error on action ${action.id}:`, err);
      // Keep failed items in the queue to retry later
      remainingQueue.push(action);
    }
  }
  await saveOfflineQueue(remainingQueue)
  return remainingQueue.length === 0;
};
