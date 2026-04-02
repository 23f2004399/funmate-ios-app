import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

type Props = { eventId: string };

const ChatTab = ({ eventId }: Props) => {
  return (
    <View style={styles.container}>
      <Ionicons name="chatbubbles-outline" size={48} color="#2E4A63" />
      <Text style={styles.label}>Chat</Text>
      <Text style={styles.sub}>Coming soon</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#0E1621',
  },
  label: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  sub:   { fontSize: 13, fontFamily: 'Inter-Regular', color: '#506A85' },
});

export default ChatTab;
