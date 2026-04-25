import AddCar from "@/components/AddCar";
import Header from "@/components/Header";
import "@/global.css";
import { styled } from 'nativewind';
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaView);

export default function App() {


  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFC]">
      <Header />
      <AddCar />
    </SafeAreaView>
  );
}