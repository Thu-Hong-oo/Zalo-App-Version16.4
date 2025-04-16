import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  LogBox,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getConversations } from "../modules/chat/controller";
import api from "../config/api";

// Enable logging in development
LogBox.ignoreLogs(["Warning: ..."]); // Ignore specific warnings if needed

export default function ChatListScreen({ navigation }) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userCache, setUserCache] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    fetchConversations();

    // Add focus listener to reload conversations when screen comes into focus
    const unsubscribe = navigation.addListener("focus", () => {
      fetchConversations();
    });

    // Cleanup subscription on unmount
    return unsubscribe;
  }, [navigation]);

  const fetchUserInfo = async (phone) => {
    try {
      // Check cache first
      if (userCache[phone]) {
        return userCache[phone];
      }

      // Log để debug
      console.log("Getting user info for phone:", phone);
      console.log("API base URL:", api.defaults.baseURL);

      const response = await api.get(`/users/${phone}`);

      // Log response để debug
      console.log("User info response:", response.data);

      if (!response.data) {
        throw new Error("Không nhận được dữ liệu từ server");
      }

      // Update cache
      setUserCache((prev) => ({
        ...prev,
        [phone]: response.data,
      }));

      return response.data;
    } catch (error) {
      console.error("Get user info error:", error);
      if (error.response) {
        // Log chi tiết lỗi từ server
        console.error("Server error details:", {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers,
          config: {
            url: error.config?.url,
            method: error.config?.method,
            baseURL: error.config?.baseURL,
            headers: error.config?.headers,
          },
        });
      }
      return null;
    }
  };

  const fetchConversations = async (isRefreshing = false) => {
    try {
      if (!isRefreshing) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      const response = await getConversations();

      if (response.status === "success" && response.data?.conversations) {
        // Transform API data to match UI requirements
        const transformedChats = await Promise.all(
          response.data.conversations.map(async (conv) => {
            // Determine which participant is the other user (not current user)
            const otherParticipant = conv.participant.isCurrentUser
              ? conv.otherParticipant
              : conv.participant;

            // Fetch user info
            const userInfo = await fetchUserInfo(otherParticipant.phone);

            return {
              id: conv.conversationId,
              title: userInfo?.name || otherParticipant.phone,
              message: conv.lastMessage.content,
              time: formatTime(conv.lastMessage.timestamp),
              avatar: userInfo?.avatar || null,
              isFromMe: conv.lastMessage.isFromMe,
              unreadCount: conv.unreadCount || 0,
              otherParticipantPhone: otherParticipant.phone,
            };
          })
        );

        setChats(transformedChats);
      } else {
        throw new Error("Invalid response format from server");
      }
    } catch (err) {
      console.error("Error in fetchConversations:", err);
      setError(err.message || "Failed to load conversations");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchConversations(true);
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    // Less than 24 hours
    if (diff < 24 * 60 * 60 * 1000) {
      return date.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    // Less than 7 days
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
      return days[date.getDay()];
    }
    // More than 7 days
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
    });
  };

  const getInitials = (phone) => {
    return phone.slice(-2);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResult(null);
      return;
    }

    setIsSearching(true);
    try {
      // Convert phone number format from 0xxxxxxxx to 84xxxxxxxx
      let searchPhone = searchQuery.trim();
      if (searchPhone.startsWith("0")) {
        searchPhone = "84" + searchPhone.slice(1);
      }

      console.log("Searching for user:", searchPhone);
      const result = await fetchUserInfo(searchPhone);
      console.log("Search result:", result);
      setSearchResult(result);
    } catch (error) {
      console.error("Search error:", error);
      console.log("Search failed for query:", searchQuery.trim());
      setSearchResult(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.nativeEvent.key === "Enter") {
      handleSearch();
    }
  };

  const renderSearchResult = () => {
    if (!searchQuery.trim()) return null;

    if (isSearching) {
      return (
        <View style={styles.searchResultContainer}>
          <ActivityIndicator size="small" color="#1877f2" />
        </View>
      );
    }

    if (!searchResult) {
      return (
        <View style={styles.searchResultContainer}>
          <Text style={styles.noResultText}>Không tìm thấy người dùng</Text>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={styles.searchResultItem}
        onPress={() => {
          navigation.navigate("ChatDirectly", {
            title: searchResult.name || searchResult.phone,
            otherParticipantPhone: searchResult.phone,
            avatar: searchResult.avatar,
          });
          setSearchQuery("");
          setSearchResult(null);
        }}
      >
        <View style={styles.avatarContainer}>
          {searchResult.avatar ? (
            <Image
              source={{ uri: searchResult.avatar }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarTextContainer}>
              <Text style={styles.avatarText}>
                {getInitials(searchResult.name || searchResult.phone)}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.searchResultContent}>
          <Text style={styles.searchResultName}>
            {searchResult.name || searchResult.phone}
          </Text>
          <Text style={styles.searchResultPhone}>{searchResult.phone}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderChatItem = ({ item }) => (
    <TouchableOpacity
      style={styles.chatItem}
      onPress={() =>
        navigation.navigate("ChatDirectly", {
          title: item.title,
          otherParticipantPhone: item.otherParticipantPhone,
          avatar: item.avatar,
        })
      }
    >
      <View style={styles.avatarContainer}>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarTextContainer}>
            <Text style={styles.avatarText}>{getInitials(item.title)}</Text>
          </View>
        )}
        {item.unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{item.unreadCount}</Text>
          </View>
        )}
      </View>
      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatTitle}>{item.title}</Text>
          <Text style={styles.chatTime}>{item.time}</Text>
        </View>
        <Text
          style={[
            styles.chatMessage,
            item.unreadCount > 0 && styles.unreadMessage,
          ]}
          numberOfLines={1}
        >
          {item.message}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1877f2" />
      </View>
    );
  }

  if (error && !refreshing) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => fetchConversations()}
        >
          <Text style={styles.retryButtonText}>Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#fff" />
          <TextInput
            placeholder="Tìm kiếm"
            placeholderTextColor="#fff"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <Ionicons name="search" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="qr-code" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerButton} onPress={handleRefresh}>
          <Ionicons name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search Results */}
      {renderSearchResult()}

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tab, styles.activeTab]}>
          <Text style={[styles.tabText, styles.activeTabText]}>Ưu tiên</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab}>
          <Text style={styles.tabText}>
            Khác
            <View style={styles.notificationDot} />
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterButton}>
          <Ionicons name="filter" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Chat List */}
      <View style={styles.chatListContainer}>
        <FlatList
          data={chats}
          renderItem={renderChatItem}
          keyExtractor={(item) => item.id}
          style={styles.chatList}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          removeClippedSubviews={false}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={10}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Không có cuộc trò chuyện nào</Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    color: "#666",
    marginBottom: 10,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#1877f2",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  header: {
    backgroundColor: "#1877f2",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 20,
    paddingHorizontal: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: "#fff",
    fontSize: 16,
    paddingVertical: 8,
  },
  searchButton: {
    padding: 5,
  },
  headerButton: {
    marginLeft: 16,
  },
  tabContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    paddingHorizontal: 16,
  },
  tab: {
    paddingVertical: 12,
    marginRight: 24,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: "#1877f2",
  },
  tabText: {
    color: "#666",
    fontSize: 16,
    position: "relative",
  },
  activeTabText: {
    color: "#1877f2",
    fontWeight: "500",
  },
  notificationDot: {
    position: "absolute",
    top: -5,
    right: -10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ff0000",
  },
  filterButton: {
    paddingVertical: 12,
  },
  chatListContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  chatList: {
    flex: 1,
  },
  chatItem: {
    flexDirection: "row",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: "hidden",
    marginRight: 12,
  },
  avatar: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  avatarTextContainer: {
    width: "100%",
    height: "100%",
    backgroundColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#666",
  },
  unreadBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#ff0000",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  unreadText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  chatContent: {
    flex: 1,
    justifyContent: "center",
  },
  chatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: "500",
    flex: 1,
  },
  chatTime: {
    fontSize: 12,
    color: "#666",
  },
  chatMessage: {
    fontSize: 14,
    color: "#666",
  },
  unreadMessage: {
    color: "#000",
    fontWeight: "500",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    color: "#666",
    fontSize: 16,
  },
  searchResultContainer: {
    padding: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  searchResultItem: {
    flexDirection: "row",
    padding: 10,
    alignItems: "center",
  },
  searchResultContent: {
    marginLeft: 10,
    flex: 1,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: "500",
  },
  searchResultPhone: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  noResultText: {
    textAlign: "center",
    color: "#666",
    padding: 10,
  },
});
