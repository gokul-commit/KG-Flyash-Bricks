import React, { useState, useEffect } from 'react';
import Home from './pages/Home';
import LoginModal from './pages/LoginModal';
import AdminDashboard from './pages/AdminDashboard';
import PageEditor from './pages/PageEditor';
import ProductModal from './pages/ProductModal';
import LogisticsManagement from './pages/LogisticsManagement';
import DriverDashboard from './pages/DriverDashboard';
import './styles.css';

function App() {
  console.log('App component is rendering');
  const [user, setUser] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pageEditorMode, setPageEditorMode] = useState(false);
  const [logisticsMode, setLogisticsMode] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      setUser(JSON.parse(userStr));
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setShowLogin(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setPageEditorMode(false);
    setLogisticsMode(false);
  };

  if (loading) return <div style={{padding: '50px', textAlign: 'center', fontSize: '18px'}}>Loading...</div>;

  // Page Editor Mode (for admin)
  if (user && ['admin', 'manager'].includes(user.role) && pageEditorMode) {
    return <PageEditor user={user} onLogout={handleLogout} />;
  }

  // Logistics Management Mode (for admin/manager/supervisor)
  if (user && ['admin', 'manager', 'supervisor'].includes(user.role) && logisticsMode) {
    return <LogisticsManagement user={user} onLogout={handleLogout} />;
  }

  // Admin/Manager Dashboard
  if (user && ['admin', 'manager', 'supervisor'].includes(user.role)) {
    return (
      <div>
        <AdminDashboard
          user={user}
          onLogout={handleLogout}
          pageEditorMode={pageEditorMode}
          setPageEditorMode={setPageEditorMode}
          logisticsMode={logisticsMode}
          setLogisticsMode={setLogisticsMode}
        />
      </div>
    );
  }

  // Employee Dashboard (coming soon)
  if (user && user.role === 'employee') {
    return (
      <div style={{minHeight: '100vh', display: 'flex', flexDirection: 'column'}}>
        <div style={{background: '#2c3e50', color: 'white', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <h1 style={{margin: 0}}>Employee Portal</h1>
          <button onClick={handleLogout} style={{padding: '8px 15px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}>Logout</button>
        </div>
        <div style={{flex: 1, padding: '30px', textAlign: 'center', color: '#666'}}>
          <h2>Employee Dashboard - Coming Soon</h2>
          <p>View your attendance, leave, salary, and performance here.</p>
        </div>
      </div>
    );
  }

  // Driver Dashboard
  if (user && user.role === 'driver') {
    return <DriverDashboard user={user} onLogout={handleLogout} />;
  }

  // Public User Home/Dashboard
  return (
    <div>
      <Home user={user} />
      {!user && showLogin && <LoginModal onClose={() => setShowLogin(false)} onLoginSuccess={handleLoginSuccess} />}
      
      {/* Floating Login Button */}
      {!user && !showLogin && (
        <button
          onClick={() => setShowLogin(true)}
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '10px 20px',
            background: '#e74c3c',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            zIndex: 999,
            fontSize: '14px'
          }}
        >
          Login / Register
        </button>
      )}

      {/* User Info Button (when logged in) */}
      {user && user.role === 'public' && (
        <div style={{position: 'fixed', top: '20px', right: '20px', background: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', zIndex: 999}}>
          <p style={{margin: '0 0 10px 0', color: '#2c3e50', fontWeight: 'bold'}}>Hello, {user.name}!</p>
          <button onClick={handleLogout} style={{padding: '8px 15px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', width: '100%'}}>Logout</button>
        </div>
      )}
    </div>
  );
}

export default App;
