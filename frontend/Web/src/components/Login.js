"use client"

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Phone, Lock } from "lucide-react"
import axios from "axios"
import 'bootstrap/dist/css/bootstrap.min.css'

export default function Login({ setIsAuthenticated }) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState("phone")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      // Xử lý số điện thoại để có định dạng 84xxxxxxxxx
      let formattedPhone = phoneNumber
      if (phoneNumber.startsWith("0")) {
        formattedPhone = "84" + phoneNumber.substring(1)
      } else if (!phoneNumber.startsWith("84")) {
        formattedPhone = "84" + phoneNumber
      }

      console.log("Sending login request with:", {
        phone: formattedPhone,
        password
      })

      // 1. Login request
      const loginResponse = await axios.post("http://localhost:3000/api/auth/login", {
        phone: formattedPhone,
        password
      })

      console.log("Login response:", loginResponse.data)

      // Kiểm tra loginResponse.data có tồn tại và có chứa accessToken
      if (loginResponse.data && (loginResponse.data.accessToken || loginResponse.data.token)) {
        const accessToken = loginResponse.data.accessToken || loginResponse.data.token
        
        // Lưu token vào localStorage
        localStorage.setItem("accessToken", accessToken)
        
        // Lưu refreshToken nếu có
        if (loginResponse.data.refreshToken) {
          localStorage.setItem("refreshToken", loginResponse.data.refreshToken)
        }

        try {
          // 2. Fetch user profile
          const profileResponse = await axios.get("http://localhost:3000/api/users/profile", {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          })

          console.log("Profile response:", profileResponse.data)

          // Lưu thông tin user profile đầy đủ
          if (profileResponse.data) {
            localStorage.setItem("user", JSON.stringify(profileResponse.data))
            // Lưu số điện thoại riêng để dễ truy cập
            localStorage.setItem("phone", formattedPhone)
            // Cập nhật trạng thái xác thực
            setIsAuthenticated(true)
            // Chuyển hướng đến trang chính
            navigate("/app", { replace: true })
          }
        } catch (profileError) {
          console.error("Error fetching profile:", profileError)
          setError("Không thể lấy thông tin người dùng. Vui lòng thử lại.")
          // Xóa token nếu không lấy được profile
          localStorage.removeItem("accessToken")
          localStorage.removeItem("refreshToken")
        }
      } else {
        console.error("Response không chứa token:", loginResponse.data)
        setError("Đăng nhập không thành công. Vui lòng thử lại.")
      }
    } catch (err) {
      console.error("Lỗi đăng nhập:", err.response || err)
      setError(
        err.response?.data?.message || 
        "Đăng nhập thất bại. Vui lòng kiểm tra lại số điện thoại và mật khẩu."
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #e6f3ff 0%, #b6dcfe 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}>
      <div style={{
        width: "100%",
        maxWidth: "440px",
        background: "white",
        borderRadius: "12px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
        padding: "40px 30px"
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <h1 style={{ 
            fontSize: "48px", 
            fontWeight: "bold", 
            color: "#0068ff",
            marginBottom: "12px"
          }}>Zalo</h1>
          <div style={{ 
            color: "#081C36",
            fontSize: "16px",
            marginBottom: "4px"
          }}>Đăng nhập bằng tài khoản Zalo</div>
          <div style={{ 
            color: "#7589A3",
            fontSize: "14px"
          }}>chat.zalo.me</div>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex",
          borderBottom: "1px solid #E6E8EB",
          marginBottom: "24px"
        }}>
          <button
            style={{
              flex: 1,
              background: "none",
              border: "none",
              padding: "12px",
              color: activeTab === "phone" ? "#0068FF" : "#7589A3",
              borderBottom: activeTab === "phone" ? "2px solid #0068FF" : "none",
              fontWeight: "500",
              cursor: "pointer"
            }}
            onClick={() => setActiveTab("phone")}
          >
            VỚI SỐ ĐIỆN THOẠI
          </button>
          <button
            style={{
              flex: 1,
              background: "none",
              border: "none",
              padding: "12px",
              color: activeTab === "qr" ? "#0068FF" : "#7589A3",
              borderBottom: activeTab === "qr" ? "2px solid #0068FF" : "none",
              fontWeight: "500",
              cursor: "pointer"
            }}
            onClick={() => setActiveTab("qr")}
          >
            VỚI MÃ QR
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            padding: "12px",
            backgroundColor: "#FFF5F5",
            color: "#E53E3E",
            borderRadius: "8px",
            marginBottom: "16px",
            fontSize: "14px"
          }}>
            {error}
          </div>
        )}

        {/* QR Code Tab Content */}
        {activeTab === "qr" && (
          <div style={{ textAlign: "center" }}>
            <div style={{
              border: "1px solid #E6E8EB",
              borderRadius: "8px",
              padding: "24px",
              marginBottom: "16px"
            }}>
              <img
                src="/qr.png"
                alt="QR Code"
                style={{ width: "200px", height: "200px" }}
              />
            </div>
            <p style={{ color: "#7589A3", fontSize: "14px" }}>
              Quét mã QR bằng Zalo để đăng nhập
            </p>
          </div>
        )}

        {/* Phone Number Tab Content */}
        {activeTab === "phone" && (
          <div>
            <form onSubmit={handleSubmit}>
              {/* Phone Number Input */}
              <div style={{ marginBottom: "16px" }}>
                <div style={{
                  display: "flex",
                  border: "1px solid #E6E8EB",
                  borderRadius: "6px",
                  overflow: "hidden"
                }}>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "8px 12px",
                    borderRight: "1px solid #E6E8EB",
                    background: "#F8F9FA"
                  }}>
                    <Phone size={20} color="#7589A3" />
                    <span style={{ marginLeft: "8px", color: "#081C36" }}>+84</span>
                    <span style={{ marginLeft: "4px", color: "#7589A3" }}>▼</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Số điện thoại"
                    style={{
                      flex: 1,
                      border: "none",
                      padding: "12px",
                      outline: "none",
                      fontSize: "14px"
                    }}
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div style={{ marginBottom: "24px" }}>
                <div style={{
                  display: "flex",
                  border: "1px solid #E6E8EB",
                  borderRadius: "6px",
                  overflow: "hidden"
                }}>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "8px 12px",
                    background: "#F8F9FA"
                  }}>
                    <Lock size={20} color="#7589A3" />
                  </div>
                  <input
                    type="password"
                    placeholder="Mật khẩu"
                    style={{
                      flex: 1,
                      border: "none",
                      padding: "12px",
                      outline: "none",
                      fontSize: "14px"
                    }}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Login Button */}
              <button 
                type="submit" 
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "#0068FF",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: "500",
                  marginBottom: "16px",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1
                }}
                disabled={loading}
              >
                {loading ? "Đang đăng nhập..." : "Đăng nhập với mật khẩu"}
              </button>
            </form>

            {/* Additional Options */}
            <div style={{ textAlign: "center" }}>
              <a 
                href="#" 
                style={{
                  color: "#0068FF",
                  textDecoration: "none",
                  display: "block",
                  marginBottom: "8px",
                  fontSize: "14px"
                }}
              >
                Gửi yêu cầu đăng nhập
              </a>
              <a 
                href="#" 
                style={{
                  color: "#7589A3",
                  textDecoration: "none",
                  fontSize: "14px"
                }}
              >
                Quên mật khẩu?
              </a>
            </div>
          </div>
        )}

        {/* Register Link */}
        <div style={{ 
          textAlign: "center", 
          marginTop: "24px",
          fontSize: "14px"
        }}>
          <span style={{ color: "#7589A3" }}>Bạn chưa có tài khoản? </span>
          <a 
            href="#" 
            style={{
              color: "#0068FF",
              textDecoration: "none"
            }}
          >
            Đăng ký ngay!
          </a>
        </div>
      </div>
    </div>
  )
}
