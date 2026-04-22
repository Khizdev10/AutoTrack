import "@/global.css";
import { ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { useFonts } from "expo-font";
import { Slot, SplashScreen } from "expo-router";
import { useEffect } from "react";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

if (!publishableKey) {
  throw new Error("Add your Clerk Publishable Key to the .env file");
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'sans-serif': require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
    'sans-serif-bold': require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
    'sans-serif-extrabold': require("../assets/fonts/PlusJakartaSans-ExtraBold.ttf"),
    'sans-serif-light': require("../assets/fonts/PlusJakartaSans-Light.ttf"),
    'sans-serif-medium': require("../assets/fonts/PlusJakartaSans-Medium.ttf"),
    'sans-serif-semibold': require("../assets/fonts/PlusJakartaSans-SemiBold.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <Slot />
    </ClerkProvider>
  );
}

