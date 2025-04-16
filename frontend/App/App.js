import React, { createContext, useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { View, Text } from 'react-native';
import COLORS from "./components/colors";
import "@expo/metro-runtime";
import { initApi } from "./modules/auth/controller";
import { initUserApi } from "./modules/user/controller";
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Import screens
import WelcomeScreen from "./screens/WelcomeScreen";
import LoginScreen  from "./screens/LoginScreen";
import SignUpScreen from "./screens/SignUpScreen";
import ChatScreen from "./screens/ChatScreen";
import Contacts from "./screens/ContactsScreen";
import Explore from "./screens/ExploreScreen";
import Journal from "./screens/JournalScreen";
import Personal from "./screens/PersonalScreen";
import OTPScreen from "./screens/OTPScreen";
import UserNameScreen from "./screens/UserNameScreen";
import PersonalInfoScreen from "./screens/PersonalInfoScreen";
import UpdateAvatarScreen from "./screens/UpdateAvatarScreen";
import PersonalDetailScreen from "./screens/PersonalDetailScreen";
import ChatDirectlyScreen from "./screens/ChatDirectlyScreen";


// Create Auth Context
export const AuthContext = createContext(null);

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Auth stack
function AuthStack() {
  return (
    <Stack.Navigator 
      screenOptions={{ 
        headerShown: false,
        presentation: 'card'
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="OTP" component={OTPScreen} />
      <Stack.Screen name="UserName" component={UserNameScreen} />

      <Stack.Screen 
        name="PersonalInfo" 
        component={PersonalInfoScreen}
        options={{
          gestureEnabled: false,
   
        }}
      />
      <Stack.Screen 
        name="UpdateAvatar" 
        component={UpdateAvatarScreen}
        options={{
          gestureEnabled: false
        }}
      />
    </Stack.Navigator>
  );
}

// Chat stack
function ChatStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
   
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="ChatDirectly" component={ChatDirectlyScreen} /> 
    </Stack.Navigator>
  );
}

// Contacts stack
function ContactsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Contacts" component={Contacts} />
    </Stack.Navigator>
  );
}

// Explore stack
function ExploreStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Explore" component={Explore} />
    </Stack.Navigator>
  );
}

// Journal stack
function JournalStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Journal" component={Journal} />
    </Stack.Navigator>
  );
}

// Personal stack
function PersonalStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Personal" component={Personal} />
      <Stack.Screen name="PersonalDetail" component={PersonalDetailScreen} />
    </Stack.Navigator>
  );
}

function BottomTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          const iconSize = focused ? 28 : 24;

          if (route.name === "ChatTab") {
            iconName = focused ? "chatbubbles" : "chatbubbles-outline";
          } else if (route.name === "ContactsTab") {
            iconName = focused ? "people" : "people-outline";
          } else if (route.name === "ExploreTab") {
            iconName = focused ? "grid" : "grid-outline";
          } else if (route.name === "JournalTab") {
            iconName = focused ? "time" : "time-outline";
          } else if (route.name === "PersonalTab") {
            iconName = focused ? "person" : "person-outline";
          }

          return <Ionicons name={iconName} size={iconSize} color={color} />;
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: "gray",
      })}
    >
      <Tab.Screen
        name="ChatTab"
        component={ChatStack}
        options={{ title: "Tin nhắn", headerShown: false }}
      />
      <Tab.Screen
        name="ContactsTab"
        component={ContactsStack}
        options={{ title: "Danh bạ", headerShown: false }}
      />
      <Tab.Screen
        name="ExploreTab"
        component={ExploreStack}
        options={{ title: "Khám phá", headerShown: false }}
      />
      <Tab.Screen
        name="JournalTab"
        component={JournalStack}
        options={{ title: "Nhật ký", headerShown: false }}
      />
      <Tab.Screen
        name="PersonalTab"
        component={PersonalStack}
        options={{ title: "Cá nhân", headerShown: false }}
      />
    </Tab.Navigator>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error);
    console.error('Error info:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text>Something went wrong!</Text>
          <Text>{this.state.error?.toString()}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log('App mounting...');

    const init = async () => {
      try {
        await initApi();
        await initUserApi();
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to initialize APIs:', error);
        setIsLoading(false);
      }
    };

    init();
  }, []);

  const authContext = {
    isLoggedIn,
    setIsLoggedIn,
    user,
    setUser,
    token,
    setToken,
    refreshToken,
    setRefreshToken,
    handleLoginSuccess: (userData, authToken, refreshToken) => {
      console.log('Login successful!');
      console.log('User data:', userData);
      console.log('Auth token:', authToken);
      console.log('Refresh token:', refreshToken);
      
      setUser(userData);
      setToken(authToken);
      setRefreshToken(refreshToken);
      setIsLoggedIn(true);
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <AuthContext.Provider value={authContext}>
        <SafeAreaProvider>
          <NavigationContainer>
            {!isLoggedIn ? (
              <AuthStack />
            ) : (
              <BottomTabs />
            )}
          </NavigationContainer>
        </SafeAreaProvider>
      </AuthContext.Provider>
    </ErrorBoundary>
  );
}
