import React, { useState } from 'react';
import { loginAdmin, registerPublic, verifyOTP, requestOTP, loginVerifyOTP, driverLogin } from '../api';
import '../styles.css';

function LoginModal({ onClose, onLoginSuccess }) {
  const [mode, setMode] = useState('selection'); // selection, admin-login, public-register, public-login
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // For OTP flow
  const [otpMethod, setOtpMethod] = useState('sms'); // sms or whatsapp

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await loginAdmin(username, password);
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      onLoginSuccess(response.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePublicRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await registerPublic(name, email, mobile, otpMethod);
      setUserId(response.data.userId);
      setStep(2);
      setError(''); // Show OTP received message
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await verifyOTP(userId, otp);
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      onLoginSuccess(response.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePublicLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await requestOTP(mobile, otpMethod);
      setUserId(mobile);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'User not found');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginVerifyOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await loginVerifyOTP(mobile, otp);
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      onLoginSuccess(response.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDriverLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await driverLogin(username, password);
      const driver = response.data.driver;
      const userObj = { id: driver.id, name: driver.name, role: 'driver', vehicle_no: driver.vehicle_no, image: driver.image };
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(userObj));
      onLoginSuccess(userObj);
    } catch (err) {
      setError(err.response?.data?.error || 'Driver login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000}}>
      <div style={{background: 'white', borderRadius: '8px', padding: '40px', maxWidth: '400px', width: '90%', boxShadow: '0 10px 40px rgba(0,0,0,0.3)'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px'}}>
          <h2 style={{margin: 0, color: '#2c3e50'}}>KG Flyash</h2>
          <button onClick={onClose} style={{background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer'}}>✕</button>
        </div>

        {mode === 'selection' && (
          <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
            <button onClick={() => setMode('admin-login')} style={{padding: '12px', background: '#667eea', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold'}}>
              Company Login
            </button>
            <button onClick={() => setMode('driver-login')} style={{padding: '12px', background: '#e67e22', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold'}}>
              🚛 Driver Login
            </button>
            {/*<button onClick={() => { setMode('public-login'); setStep(1); }} style={{padding: '12px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold'}}>
              Public User Login
            </button>
            <button onClick={() => { setMode('public-register'); setStep(1); }} style={{padding: '12px', background: '#f39c12', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold'}}>
              Register as Public User
            </button>  
            <button onClick={() => setMode('admin-login')} style={{padding: '12px', background: '#26b4a4', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold'}}>
              Admin Login
            </button>*/}
          </div>
        )}

        {mode === 'admin-login' && (
          <form onSubmit={handleAdminLogin} style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{padding: '10px', border: '1px solid #ddd', borderRadius: '4px'}}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{padding: '10px', border: '1px solid #ddd', borderRadius: '4px'}}
              required
            />
            {error && <div style={{color: '#e74c3c', fontSize: '14px'}}>{error}</div>}
            <button type="submit" disabled={loading} style={{padding: '10px', background: '#667eea', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', opacity: loading ? 0.6 : 1}}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
            <button type="button" onClick={() => setMode('selection')} style={{padding: '10px', background: '#bdc3c7', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'}}>
              Back
            </button>
          </form>
        )}

        {mode === 'driver-login' && (
          <form onSubmit={handleDriverLogin} style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
            <div style={{textAlign: 'center', marginBottom: '10px'}}>
              <h3 style={{margin: '0 0 5px 0', color: '#e67e22'}}>🚛 Driver Portal</h3>
              <p style={{margin: 0, fontSize: '14px', color: '#666'}}>Login with your assigned credentials</p>
            </div>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{padding: '10px', border: '1px solid #ddd', borderRadius: '4px'}}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{padding: '10px', border: '1px solid #ddd', borderRadius: '4px'}}
              required
            />
            {error && <div style={{color: '#e74c3c', fontSize: '14px'}}>{error}</div>}
            <button type="submit" disabled={loading} style={{padding: '10px', background: '#e67e22', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', opacity: loading ? 0.6 : 1}}>
              {loading ? 'Logging in...' : '🚛 Driver Login'}
            </button>
            <button type="button" onClick={() => setMode('selection')} style={{padding: '10px', background: '#bdc3c7', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'}}>
              Back
            </button>
          </form>
        )}

        {mode === 'public-register' && (
          <form onSubmit={handlePublicRegister} style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
            <input
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{padding: '10px', border: '1px solid #ddd', borderRadius: '4px'}}
              required
            />
            <input
              type="tel"
              placeholder="Mobile Number"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              style={{padding: '10px', border: '1px solid #ddd', borderRadius: '4px'}}
              required
            />
            <input
              type="email"
              placeholder="Email (optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{padding: '10px', border: '1px solid #ddd', borderRadius: '4px'}}
            />
            <div style={{fontSize: '13px', color: '#666', marginTop: '5px'}}>
              <label style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px'}}>
                <input
                  type="radio"
                  name="otpMethod"
                  value="sms"
                  checked={otpMethod === 'sms'}
                  onChange={(e) => setOtpMethod(e.target.value)}
                />
                📱 SMS OTP
              </label>
              <label style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                <input
                  type="radio"
                  name="otpMethod"
                  value="whatsapp"
                  checked={otpMethod === 'whatsapp'}
                  onChange={(e) => setOtpMethod(e.target.value)}
                />
                💬 WhatsApp OTP
              </label>
            </div>
            {error && <div style={{color: '#e74c3c', fontSize: '14px'}}>{error}</div>}
            <button type="submit" disabled={loading} style={{padding: '10px', background: '#f39c12', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', opacity: loading ? 0.6 : 1}}>
              {loading ? 'Registering...' : `Get OTP via ${otpMethod === 'whatsapp' ? 'WhatsApp' : 'SMS'}`}
            </button>
            <button type="button" onClick={() => setMode('selection')} style={{padding: '10px', background: '#bdc3c7', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'}}>
              Back
            </button>
          </form>
        )}

        {mode === 'public-login' && step === 1 && (
          <form onSubmit={handlePublicLogin} style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
            <input
              type="tel"
              placeholder="Mobile Number"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              style={{padding: '10px', border: '1px solid #ddd', borderRadius: '4px'}}
              required
            />
            <div style={{fontSize: '13px', color: '#666', marginTop: '5px'}}>
              <label style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px'}}>
                <input
                  type="radio"
                  name="otpMethod"
                  value="sms"
                  checked={otpMethod === 'sms'}
                  onChange={(e) => setOtpMethod(e.target.value)}
                />
                📱 SMS OTP
              </label>
              <label style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                <input
                  type="radio"
                  name="otpMethod"
                  value="whatsapp"
                  checked={otpMethod === 'whatsapp'}
                  onChange={(e) => setOtpMethod(e.target.value)}
                />
                💬 WhatsApp OTP
              </label>
            </div>
            {error && <div style={{color: '#e74c3c', fontSize: '14px'}}>{error}</div>}
            <button type="submit" disabled={loading} style={{padding: '10px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', opacity: loading ? 0.6 : 1}}>
              {loading ? 'Sending OTP...' : `Send OTP via ${otpMethod === 'whatsapp' ? 'WhatsApp' : 'SMS'}`}
            </button>
            <button type="button" onClick={() => setMode('selection')} style={{padding: '10px', background: '#bdc3c7', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'}}>
              Back
            </button>
          </form>
        )}

        {((mode === 'public-register' || mode === 'public-login') && step === 2) && (
          <form onSubmit={mode === 'public-register' ? handleVerifyOTP : handleLoginVerifyOTP} style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
            <div style={{background: '#f8f9fa', padding: '15px', borderRadius: '4px', textAlign: 'center', color: '#555', fontSize: '14px'}}>
              OTP has been sent to {mobile}
            </div>
            <input
              type="text"
              placeholder="Enter 6-digit OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value
              )}
              style={{padding: '10px', border: '1px solid #ddd', borderRadius: '4px'}}
              maxLength="6"
              required
            />
            {error && <div style={{color: '#e74c3c', fontSize: '14px'}}>{error}</div>}
            <button type="submit" disabled={loading} style={{padding: '10px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', opacity: loading ? 0.6 : 1}}>
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
            <button type="button" onClick={() => setStep(1)} style={{padding: '10px', background: '#bdc3c7', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'}}>
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default LoginModal;
