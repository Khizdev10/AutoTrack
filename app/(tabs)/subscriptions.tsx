import { styled } from 'nativewind';
import { Text } from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";
const SafeAreaView = styled(RNSafeAreaView);


export default function Subscriptions() {
    return (
        <SafeAreaView>
            <Text>Subscriptions</Text>
        </SafeAreaView>
    )
}



