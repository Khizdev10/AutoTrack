import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/app/context/ThemeContext';

interface CustomButtonProps {
    title: string;
    iconName?: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
}

export default function CustomButton({ title, iconName, onPress }: CustomButtonProps) {
    const { colors, theme } = useTheme();
    const isDark = theme === 'dark';
    const textColor = isDark ? '#090D16' : '#FFFFFF';

    return (
        <TouchableOpacity 
            style={{
                backgroundColor: colors.text,
                paddingVertical: 18,
                borderRadius: 16,
                marginTop: 24,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 8
            }}
            onPress={onPress}
        >
            <Text style={{ color: textColor, fontWeight: '700', fontSize: 16 }}>{title}</Text>
            {iconName && <Ionicons name={iconName} size={20} color={textColor} />}
        </TouchableOpacity>
    );
}
