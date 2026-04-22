import { Link, useLocalSearchParams } from "expo-router";
import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SubscriptionDetail() {

    const { id } = useLocalSearchParams<{ id: string }>();

    return (
        <SafeAreaView>
            <Text>Subscription Detail: {id}</Text>
            <Link href="/(tabs)/subscriptions">
                <Text>Back to Subscriptions</Text>
            </Link>

        </SafeAreaView>
    )



}