// Eve PTT Companion — App Entry
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { SettingsProvider } from './src/context/SettingsContext';
import HomeScreen from './src/screens/HomeScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SettingsProvider>
          <NavigationContainer>
            <StatusBar style="light" />
            <Stack.Navigator
              screenOptions={{
                headerShown: false,
                cardStyle: { backgroundColor: '#08080f' },
                animationEnabled: true,
              }}
            >
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </SettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
