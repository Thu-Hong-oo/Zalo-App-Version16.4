"use client"

import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Modal,
  ScrollView,
  FlatList,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '../App';
import { updateUserProfile } from '../modules/user/controller';
import COLORS from '../components/colors';

const PersonalInfoScreen = ({ route }) => {
  const navigation = useNavigation();
  const { setIsLoggedIn } = useContext(AuthContext);
  const { phone } = route.params;
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // State for date picker
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedMonth, setSelectedMonth] = useState(1);
  const [selectedYear, setSelectedYear] = useState(1990);
  
  // Generate arrays for days, months, and years
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = Array.from({ length: 100 }, (_, i) => 2023 - i);

  const handleSelectDate = () => {
    const formattedDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    setBirthDate(formattedDate);
    setShowDatePicker(false);
  };

  const handleSelectGender = (selectedGender) => {
    setGender(selectedGender);
    setShowGenderPicker(false);
  };

  const handleContinue = async () => {
    if (!birthDate) {
      Alert.alert('Lỗi', 'Vui lòng chọn ngày sinh');
      return;
    }

    if (!gender) {
      Alert.alert('Lỗi', 'Vui lòng chọn giới tính');
      return;
    }

    try {
      setIsLoading(true);
      
      // Prepare data for API
      const userData = {
        phoneNumber: phone,
        gender: gender,
        dateOfBirth: birthDate
      };

      console.log('Updating profile with data:', userData);
      
      // Call API to update profile
      await updateUserProfile(userData);
      
      // Save to AsyncStorage
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      
      console.log('Profile updated successfully');
      
      // Navigate to next screen
      navigation.reset({
        index: 0,
        routes: [{ name: 'UpdateAvatar' }]
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert(
        'Lỗi',
        error.response?.data?.message || 'Có lỗi xảy ra khi cập nhật thông tin'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const renderDateColumn = (data, selectedValue, setSelectedValue) => {
    return (
      <View style={styles.dateColumnContainer}>
        <FlatList
          data={data}
          keyExtractor={(item) => item.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.dateOptionContainer}
              onPress={() => setSelectedValue(item)}
            >
              <Text
                style={[
                  styles.dateOption,
                  item === selectedValue && styles.selectedDate,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
          showsVerticalScrollIndicator={false}
          initialScrollIndex={data.indexOf(selectedValue)}
          getItemLayout={(data, index) => ({
            length: 50,
            offset: 50 * index,
            index,
          })}
          snapToInterval={50}
          decelerationRate="fast"
          contentContainerStyle={styles.dateColumnContent}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thêm thông tin cá nhân</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.formContainer}>
          <TouchableOpacity 
            style={styles.inputContainer}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.label}>Ngày sinh</Text>
            <View style={styles.dateInputContainer}>
              <Text style={styles.dateText}>
                {birthDate || 'Chọn ngày sinh'}
              </Text>
              <Ionicons name="calendar-outline" size={24} color="#999" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.inputContainer}
            onPress={() => setShowGenderPicker(true)}
          >
            <Text style={styles.label}>Giới tính</Text>
            <View style={styles.genderInputContainer}>
              <Text style={styles.genderText}>
                {gender || 'Chọn giới tính'}
              </Text>
              <Ionicons name="chevron-down" size={24} color="#999" />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.continueButton, isLoading && styles.disabledButton]}
          onPress={handleContinue}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.continueButtonText}>Tiếp tục</Text>
          )}
        </TouchableOpacity>
      </View>

      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn ngày sinh</Text>
            </View>
            
            <View style={styles.datePickerContainer}>
              {renderDateColumn(days, selectedDay, setSelectedDay)}
              {renderDateColumn(months, selectedMonth, setSelectedMonth)}
              {renderDateColumn(years, selectedYear, setSelectedYear)}
            </View>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.selectButton}
                onPress={handleSelectDate}
              >
                <Text style={styles.selectButtonText}>Chọn</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showGenderPicker}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn giới tính</Text>
            </View>
            
            <View style={styles.genderPickerContainer}>
              <TouchableOpacity 
                style={styles.genderOption}
                onPress={() => handleSelectGender('Nam')}
              >
                <Text style={styles.genderOptionText}>Nam</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.genderOption}
                onPress={() => handleSelectGender('Nữ')}
              >
                <Text style={styles.genderOptionText}>Nữ</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.genderOption}
                onPress={() => handleSelectGender('Không chia sẻ')}
              >
                <Text style={styles.genderOptionText}>Không chia sẻ</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 15,
  },
  content: {
    flex: 1,
  },
  formContainer: {
    padding: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: '#333',
  },
  dateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
  },
  dateText: {
    fontSize: 16,
    color: '#333',
  },
  genderInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
  },
  genderText: {
    fontSize: 16,
    color: '#333',
  },
  buttonContainer: {
    padding: 20,
  },
  continueButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    paddingBottom: 20,
  },
  modalHeader: {
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  datePickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    height: 150,
    paddingVertical: 20,
  },
  dateColumnContainer: {
    flex: 1,
    height: 150,
  },
  dateColumnContent: {
    paddingVertical: 50,
  },
  dateOptionContainer: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateOption: {
    fontSize: 18,
    color: '#999999',
  },
  selectedDate: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000000',
  },
  modalFooter: {
    paddingHorizontal: 15,
    marginTop: 10,
  },
  selectButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  selectButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  genderPickerContainer: {
    paddingVertical: 10,
  },
  genderOption: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  genderOptionText: {
    fontSize: 16,
    color: '#000000',
  },
  disabledButton: {
    backgroundColor: '#999999',
  },
});

export default PersonalInfoScreen;
