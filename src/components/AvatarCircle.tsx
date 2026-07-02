import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

const AVATAR_COLORS = [
  '#007AFF', '#5856D6', '#FF2D55', '#FF9500', '#34C759',
  '#AF52DE', '#FF6482', '#00C7BE', '#30B0C7', '#AC8E68',
];

interface AvatarCircleProps {
  name: string;
  photo?: string | null;
  size?: number;
  fontSize?: number;
}

function getColorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

export const AvatarCircle: React.FC<AvatarCircleProps> = ({
  name,
  photo,
  size = 48,
  fontSize = 18,
}) => {
  const bgColor = getColorFromName(name);
  const initials = getInitials(name || '?');

  if (photo) {
    return (
      <Image
        source={{ uri: photo }}
        style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
      />
    );
  }

  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor }]}>
      <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
