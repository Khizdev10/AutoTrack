import React from "react";
import { View, Text, TouchableOpacity, ScrollView, Alert } from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";
import { styled } from "nativewind";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/app/context/ThemeContext";

const SafeAreaView = styled(RNSafeAreaView);

export default function Subscriptions() {
  const { theme, colors } = useTheme();

  const handleShowAlert = () => {
    Alert.alert(
      "Subscriptions Coming Soon",
      "We are working hard to integrate secure App Store and Google Play subscriptions. AutoTrack Premium plans will be available in the next release!",
      [{ text: "Awesome" }]
    );
  };

  const premiumFeatures = [
    { icon: "car-sport-outline", title: "Unlimited Vehicles", desc: "Add as many cars, motorcycles, or trucks as you own." },
    { icon: "map-outline", title: "Background GPS Auto-Track", desc: "Automatically track drives and calculate mileage in the background." },
    { icon: "analytics-outline", title: "Advanced Cost & Fuel Charts", desc: "Interactive trend graphs, cost/distance projections, and metrics." },
    { icon: "cloud-upload-outline", title: "Cloud Backup & CSV Export", desc: "Export your entire maintenance history to CSV anytime." },
    { icon: "notifications-active-outline", title: "Smart Service Forecasts", desc: "AI-driven predictive scheduling based on weekly driving rates." },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* Header Section */}
        <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 }}>
          <Text style={{ fontSize: 11, fontWeight: "900", color: colors.primary, letterSpacing: 1.5, textTransform: "uppercase" }}>
            Upgrade
          </Text>
          <Text style={{ fontSize: 26, fontWeight: "800", color: colors.text, marginTop: 4 }}>
            AutoTrack Premium
          </Text>
          <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 6, lineHeight: 20 }}>
            Unlock unlimited tracking, background driving logs, and advanced analytics.
          </Text>
        </View>

        {/* Premium Plan Card */}
        <View style={{ marginHorizontal: 24, marginBottom: 28 }}>
          <LinearGradient
            colors={theme === "dark" ? ["#1E293B", "#0F172A"] : ["#1E3A8A", "#2563EB"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 28, padding: 24, shadowColor: colors.primary, shadowOpacity: 0.15, shadowRadius: 15, elevation: 8, borderWidth: theme === "dark" ? 1 : 0, borderColor: colors.border }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View>
                <Text style={{ color: "#93C5FD", fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>
                  PRO MEMBER
                </Text>
                <Text style={{ color: "#fff", fontSize: 24, fontWeight: "800", marginTop: 4 }}>
                  All-Access Pass
                </Text>
              </View>
              <View style={{ backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 11 }}>Value Pack</Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 20, marginBottom: 24 }}>
              <Text style={{ color: "#fff", fontSize: 36, fontWeight: "900" }}>$4.99</Text>
              <Text style={{ color: "#93C5FD", fontSize: 15, fontWeight: "600", marginLeft: 4 }}>/ month</Text>
            </View>

            {/* Feature Checkmarks */}
            <View style={{ gap: 12, borderTopWidth: 1, borderTopColor: "rgba(255, 255, 255, 0.15)", paddingTop: 20 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Ionicons name="checkmark-circle" size={18} color="#34D399" />
                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>Unlimited Vehicle Garage</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Ionicons name="checkmark-circle" size={18} color="#34D399" />
                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>Auto-Drive GPS Background Tracking</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Ionicons name="checkmark-circle" size={18} color="#34D399" />
                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>Full Analytics & PDF Exports</Text>
              </View>
            </View>

            {/* Subscribe Action (Coming Soon) */}
            <TouchableOpacity
              onPress={handleShowAlert}
              style={{
                backgroundColor: "#fff",
                borderRadius: 16,
                paddingVertical: 14,
                alignItems: "center",
                marginTop: 28,
                shadowColor: "#000",
                shadowOpacity: 0.05,
                shadowRadius: 5,
                elevation: 2,
              }}
            >
              <Text style={{ color: "#2563EB", fontWeight: "800", fontSize: 15 }}>Subscriptions Coming Soon</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>

        {/* Benefits Breakdown List */}
        <View style={{ paddingHorizontal: 24 }}>
          <Text style={{ fontSize: 13, fontWeight: "800", color: colors.text, letterSpacing: 0.5, marginBottom: 16, textTransform: "uppercase" }}>
            What's Included
          </Text>

          <View style={{ gap: 20 }}>
            {premiumFeatures.map((feat, idx) => (
              <View key={idx} style={{ flexDirection: "row", gap: 16, alignItems: "flex-start" }}>
                <View style={{ backgroundColor: colors.accent, padding: 10, borderRadius: 14 }}>
                  <Ionicons name={feat.icon as any} size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>{feat.title}</Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 18 }}>{feat.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
