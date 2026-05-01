import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App.jsx';
import LandingPage from './pages/LandingPage.jsx';
import PublicMenu from './pages/PublicMenu.jsx';
import Admin from './pages/Admin.jsx';
import QRPage from './pages/QRPage.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<LandingPage />} />
          <Route path="login" element={<Navigate to="/admin" replace />} />
          <Route path="register" element={<Navigate to="/admin" replace />} />
          <Route path="menu/:slug" element={<PublicMenu />} />
          <Route path="qr/:slug" element={<QRPage />} />
          <Route path="admin" element={<Admin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
