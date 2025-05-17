import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import App from './App';

// Giả sử bạn có một hàm kiểm tra trạng thái đăng nhập
const isUserLoggedIn = () => {
  // Kiểm tra nếu người dùng đã đăng nhập (ví dụ qua session, localStorage, hoặc cookie)
  // Ví dụ, nếu lưu token trong localStorage:
  return localStorage.getItem('authToken') !== null;
};

const AppRoutes = () => {
  return (
    <Router>
      <Routes>
        <Route 
          path="/login" 
          element={isUserLoggedIn() ? <Navigate to="/app" replace /> : <Login />} 
        />
        <Route path="/app/*" element={<App />} />
        <Route 
          path="/" 
          element={isUserLoggedIn() ? <Navigate to="/app" replace /> : <Navigate to="/login" replace />} 
        />
      </Routes>
    </Router>
  );
};

export default AppRoutes;
