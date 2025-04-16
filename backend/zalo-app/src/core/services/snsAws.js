const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");
const { generateOTP } = require('../utils/otp');
const redisClient = require('../config/redis');

// Khởi tạo SNS client
const snsClient = new SNSClient({
    region: process.env.AWS_REGION || 'ap-southeast-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

// Format số điện thoại
const formatPhoneNumber = (phone) => {
    // Xóa tất cả khoảng trắng và dấu +
    phone = phone.replace(/\s+/g, '').replace('+', '');
    
    // Nếu số bắt đầu bằng 0, thay thế bằng 84
    if (phone.startsWith('0')) {
        phone = '84' + phone.substring(1);
    }
    
    // Nếu số chưa có 84 ở đầu, thêm vào
    if (!phone.startsWith('84')) {
        phone = '84' + phone;
    }
    
    // Log để debug
    console.log('Số điện thoại sau khi format:', '+' + phone);
    
    // Trả về số với dấu + ở đầu
    return '+' + phone;
};

// Gửi OTP qua SMS
const sendOTP = async (phone) => {
    try {
        // Tạo mã OTP
        const otp = generateOTP();
        console.log('\n=== DEVELOPMENT MODE ===');
        console.log('📱 Số điện thoại:', phone);
        console.log('🔑 Mã OTP:', otp);
        console.log('=====================\n');
        
        // Format số điện thoại
        const formattedPhone = formatPhoneNumber(phone);

        // Lưu OTP vào Redis
        console.log('Đang lưu OTP vào Redis...');
        await redisClient.set(`otp:${phone}`, otp, 'EX', 300); // Hết hạn sau 5 phút
        console.log('Đã lưu OTP vào Redis thành công');

        /* Comment phần gửi AWS SNS trong quá trình phát triển
        // Kiểm tra xem số điện thoại có đúng định dạng không
        if (formattedPhone !== '+84376963653') {
            console.error('Số điện thoại không khớp với số đã verified:', formattedPhone);
            throw new Error('Số điện thoại chưa được verified trong AWS SNS Sandbox');
        }

        // Chuẩn bị tin nhắn với định dạng đẹp hơn
        const message = `[ZaloLite] Mã xác thực của bạn là: ${otp}\n\nMã có hiệu lực trong 5 phút.\nVui lòng không chia sẻ mã này với bất kỳ ai.\n\nNếu bạn không yêu cầu mã này, xin hãy bỏ qua tin nhắn.`;
        
        // Gửi SMS qua AWS SNS
        console.log('Đang gửi SMS qua AWS SNS...');
        const command = new PublishCommand({
            Message: message,
            PhoneNumber: formattedPhone,
            MessageAttributes: {
                'AWS.SNS.SMS.SMSType': {
                    DataType: 'String',
                    StringValue: 'Transactional'
                },
                'AWS.SNS.SMS.SenderID': {
                    DataType: 'String',
                    StringValue: 'ZaloLite'
                }
            }
        });

        const response = await snsClient.send(command);
        console.log('Đã gửi SMS thành công. Message ID:', response.MessageId);
        */
        
        return true;
    } catch (error) {
        console.error('Lỗi khi gửi OTP:', error);
        throw new Error(error.message || 'Gửi OTP thất bại');
    }
};

// Xác thực OTP
const verifyOTP = async (phone, inputOTP) => {
    try {
        console.log('Đang xác thực OTP cho số điện thoại:', phone);
        console.log('Mã OTP nhập vào:', inputOTP);

        // Lấy OTP từ Redis
        console.log('Đang lấy OTP từ Redis...');
        const storedOTP = await redisClient.get(`otp:${phone}`);
        console.log('Mã OTP lưu trong Redis:', storedOTP);

        if (!storedOTP) {
            console.log('Không tìm thấy mã OTP cho số điện thoại này');
            return false;
        }

        // So sánh OTP
        const isValid = inputOTP === storedOTP;
        console.log('Kết quả xác thực OTP:', isValid ? 'Thành công' : 'Thất bại');

        if (isValid) {
            // Xóa OTP đã sử dụng
            console.log('Đang xóa OTP khỏi Redis...');
            await redisClient.del(`otp:${phone}`);
            console.log('Đã xóa OTP thành công');
        }

        return isValid;
    } catch (error) {
        console.error('Lỗi khi xác thực OTP:', error);
        throw new Error('Xác thực OTP thất bại');
    }
};

module.exports = {
    sendOTP,
    verifyOTP
};