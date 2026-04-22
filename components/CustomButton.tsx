import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CustomButtonProps {
    title: string;
    iconName?: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
}

export default function CustomButton({ title, iconName, onPress }: CustomButtonProps) {
    return (
        <TouchableOpacity 
            className="bg-black py-5 rounded-2xl mt-8 flex-row justify-center items-center"
            onPress={onPress}
        >
            <Text className="text-white font-bold text-lg mr-2">{title}</Text>
            {iconName && <Ionicons name={iconName} size={20} color="white" />}
        </TouchableOpacity>
    );
}
