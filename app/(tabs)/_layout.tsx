import { useAuth } from '@clerk/expo';
import { Image } from 'expo-image';
import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tabs } from './constants/data';

const TabLayout = () => {
    const { isSignedIn, isLoaded } = useAuth();
    const insets = useSafeAreaInsets();

    if (!isLoaded) return null;
    if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;
    const TabIcon = ({ focused, icon }: TabIconProps) => {
        return (
            <Image
                source={icon}
                style={{
                    width: 24,
                    height: 24,
                    tintColor: focused ? '#4976fbff' : '#999',
                }}
            />
        )
    }
    return (
        <Tabs screenOptions={{
            headerShown: false,
            tabBarStyle: {
                position: 'absolute',
                display: 'flex',
                justifyContent: 'space-evenly',
                alignItems: 'center',
                left: 0,
                width: '100%',
                right: 0,
                height: 60,
                backgroundColor: '#ffffffff',
                borderRadius: 0,
                bottom: Math.max(insets.bottom, 0),
                marginHorizontal: 0,
                borderWidth: 1,
                borderColor: '#e5e7eb',
            }
        }}

        >
            {tabs.map((tab) => (
                <Tabs.Screen key={tab.id} name={tab.name} options={{
                    title: tab.title,
                    tabBarIcon: ({ focused }) => (
                        <TabIcon focused={focused} icon={tab.icon} />
                    ),

                }} />
            ))}
        </Tabs>
    )
}

export default TabLayout