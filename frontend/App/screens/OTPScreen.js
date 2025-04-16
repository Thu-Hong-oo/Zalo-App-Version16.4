import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { verifyRegisterOTP, sendRegisterOTP } from '../modules/auth/controller';
import { AuthContext } from '../App';

const OTPScreen = ({ route, navigation }) => {
  const { phone, type } = route.params;
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const { handleLoginSuccess } = useContext(AuthContext);

  useEffect(() => {
    let interval;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer(prev => prev - 1);
      }, 1000);
    } else {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleVerifyOTP = async () => {
    if (!otp) {
      Alert.alert('Lỗi', 'Vui lòng nhập mã OTP');
      return;
    }

    try {
      setLoading(true);
      const response = await verifyRegisterOTP(phone, otp);
      console.log('OTP verification response:', response);
      
      if (response.message === 'Xác thực mã OTP thành công') {
        console.log('OTP verification successful, navigating to EnterProfileInfor');
        navigation.navigate('UserName', {
          phone: phone
        });
      } else if (response.message === 'Số điện thoại đã được đăng ký') {
        Alert.alert(
          'Thông báo',
          'Số điện thoại này đã được đăng ký. Vui lòng đăng nhập.',
          [
            {
              text: 'Đăng nhập',
              onPress: () => navigation.navigate('Login')
            }
          ]
        );
      } else {
        Alert.alert('Lỗi', response.message || 'Xác thực mã OTP thất bại');
      }
    } catch (error) {
      console.error('Verify OTP error:', error);
      Alert.alert('Lỗi', error.message || 'Xác thực mã OTP thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      setLoading(true);
      const response = await sendRegisterOTP(phone);
      console.log('Send OTP response:', response);
      
      if (response && response.message === 'Số điện thoại đã được đăng ký') {
        Alert.alert(
          'Thông báo',
          'Số điện thoại này đã được đăng ký. Vui lòng đăng nhập.',
          [
            {
              text: 'Đăng nhập',
              onPress: () => navigation.navigate('Login')
            }
          ]
        );
        return;
      }
      
      setTimer(60);
      setCanResend(false);
      Alert.alert('Thành công', 'Mã OTP mới đã được gửi');
    } catch (error) {
      console.error('Resend OTP error:', error);
      if (error.message === 'Số điện thoại đã được đăng ký') {
        Alert.alert(
          'Thông báo',
          'Số điện thoại này đã được đăng ký. Vui lòng đăng nhập.',
          [
            {
              text: 'Đăng nhập',
              onPress: () => navigation.navigate('Login')
            }
          ]
        );
      } else {
        Alert.alert('Lỗi', error.message || 'Không thể gửi lại mã OTP');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1877f2" />
      
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Xác thực OTP</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.instructionContainer}>
          <Text style={styles.instructionText}>
            Vui lòng nhập mã OTP đã được gửi đến số điện thoại {phone}
          </Text>
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Nhập mã OTP"
            value={otp}
            onChangeText={(text) => {
              const numericValue = text.replace(/[^0-9]/g, '');
              if (numericValue.length <= 6) {
                setOtp(numericValue);
              }
            }}
            keyboardType="number-pad"
            maxLength={6}
          />
        </View>

        <View style={styles.submitButtonContainer}>
          <TouchableOpacity 
            style={styles.submitButton} 
            onPress={handleVerifyOTP}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Ionicons name="arrow-forward" size={28} color="white" />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.resendContainer}>
          <Text style={styles.timerText}>
            {timer > 0 ? `Gửi lại mã sau ${timer}s` : ''}
          </Text>
          <TouchableOpacity 
            style={[styles.resendButton, !canResend && styles.disabledButton]}
            onPress={handleResendOTP}
            disabled={!canResend || loading}
          >
            <Text style={styles.resendButtonText}>Gửi lại mã</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  header: {
    backgroundColor: '#1877f2',
    paddingVertical: 15
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15
  },
  backButton: {
    padding: 5
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 15
  },
  content: {
    flex: 1,
    padding: 20
  },
  instructionContainer: {
    marginBottom: 30
  },
  instructionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center'
  },
  inputContainer: {
    marginBottom: 20
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16
  },
  submitButtonContainer: {
    alignItems: 'center',
    marginTop: 20
  },
  submitButton: {
    backgroundColor: '#1877f2',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center'
  },
  resendContainer: {
    marginTop: 20,
    alignItems: 'center'
  },
  timerText: {
    color: '#666',
    marginBottom: 10
  },
  resendButton: {
    padding: 10
  },
  resendButtonText: {
    color: '#1877f2',
    fontSize: 16
  },
  disabledButton: {
    opacity: 0.5
  }
});

export default OTPScreen;