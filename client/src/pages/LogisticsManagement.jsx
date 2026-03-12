import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  getDrivers,
  getDriverLocations,
  getCompany,
  createDriver,
  updateDriver,
  deleteDriver,
  getLogisticsOrders,
  createLogisticsOrder,
  updateLogisticsOrder,
  getOrderUpdates,
  getDriverActivity,
  uploadImage,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  deleteNotification
} from '../api';

// free map helpers using Leaflet + Nominatim for reverse geocoding
const defaultCenter = { lat: 9.9252, lng: 78.1198 };

const reverseGeocode = async (lat, lng) => {
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
    );
    const data = await resp.json();
    return data.display_name || '';
  } catch (e) {
    console.warn('Reverse geocode failed', e);
    return '';
  }
};

// forward geocode address -> {lat,lng}
const geocodeAddress = async (address) => {
  if (!address) return { lat: null, lng: null };
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
        address
      )}`
    );
    const data = await resp.json();
    if (data && data[0]) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (e) {
    console.warn('Geocode address failed', e);
  }
  return { lat: null, lng: null };
};

function LocationPicker({ label, value, onChange }) {
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    const map = L.map(mapRef.current).setView(
      [defaultCenter.lat, defaultCenter.lng],
      12
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    mapInstanceRef.current = map;

    const placeMarker = async (lat, lng) => {
      if (markerRef.current) map.removeLayer(markerRef.current);
      markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(map);
      markerRef.current.on('dragend', async (e) => {
        const p = e.target.getLatLng();
        const addr = await reverseGeocode(p.lat, p.lng);
        onChange({ address: addr, lat: p.lat, lng: p.lng });
      });
      const addr = await reverseGeocode(lat, lng);
      onChange({ address: addr, lat, lng });
    };

    map.on('click', (ev) => {
      const { lat, lng } = ev.latlng;
      placeMarker(lat, lng);
    });

    if (value && value.lat && value.lng) {
      map.setView([value.lat, value.lng], 12);
      placeMarker(value.lat, value.lng);
    }
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (value && value.lat && value.lng) {
      map.setView([value.lat, value.lng], 12);
      if (markerRef.current) map.removeLayer(markerRef.current);
      markerRef.current = L.marker([value.lat, value.lng], { draggable: true }).addTo(map);
      markerRef.current.on('dragend', async (e) => {
        const p = e.target.getLatLng();
        const addr = await reverseGeocode(p.lat, p.lng);
        onChange({ address: addr, lat: p.lat, lng: p.lng });
      });
    }
  }, [value]);

  return (
    <div style={{ marginBottom: '15px' }}>
      <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
        {label}
      </label>
      <div style={{ display: 'flex', gap: '10px' }}>
        <input
          type="text"
          value={value.address}
          onChange={(e) => onChange({ ...value, address: e.target.value })}
          placeholder="Click map to pick or type address"
          style={{ flex: 1, padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
        />
      </div>
      <div
        ref={mapRef}
        style={{ width: '100%', height: '200px', marginTop: '10px', border: '1px solid #ccc' }}
      />
    </div>
  );
}

function LogisticsManagement({ user, onLogout }) {
  console.log('LogisticsManagement component rendered for user:', user);
  const [activeTab, setActiveTab] = useState('drivers');
  const [drivers, setDrivers] = useState([]);
  const [driverLocations, setDriverLocations] = useState([]);
  const [orders, setOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [companyLocation, setCompanyLocation] = useState({ address: '', lat: null, lng: null });
  // map state for admin view
  const mapRef = React.useRef(null);
  const [loading, setLoading] = useState(true);
  const [showDriverForm, setShowDriverForm] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderUpdates, setOrderUpdates] = useState([]);
  const [orderTotalMileage, setOrderTotalMileage] = useState(0); // sum of mileage for selected order
  const [driverActivity, setDriverActivity] = useState(null);

  // Reports data
  const [reports, setReports] = useState({
    totalOrders: 0,
    completedOrders: 0,
    activeDrivers: 0,
    totalMileage: 0,
    averageOrderValue: 0
  });

  const [driverForm, setDriverForm] = useState({
    name: '',
    phone: '',
    vehicle_no: '',
    username: '',
    password: '',
    image: ''
  });

  const [uploadingImage, setUploadingImage] = useState(false);

  const [orderForm, setOrderForm] = useState({
    driver_id: '',
    vehicle_no: '',
    load_qty: '',
    schedule_date: '',
    pickup: { address: '', lat: null, lng: null },
    drop: { address: '', lat: null, lng: null }
  });

  // map markers for drivers
  const markersRef = React.useRef([]);

  // update map when driverLocations change using Leaflet
  React.useEffect(() => {
    if (!driverLocations.length) return;
    if (!mapRef.current) return;

    // initialize map or reuse existing
    let map = mapRef.current._leaflet_map;
    if (!map) {
      map = L.map(mapRef.current).setView(
        [driverLocations[0].lat, driverLocations[0].lng],
        8
      );
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);
      mapRef.current._leaflet_map = map;
    } else {
      map.setView([driverLocations[0].lat, driverLocations[0].lng], 8);
    }

    // clear existing markers
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];
    driverLocations.forEach(loc => {
      const marker = L.marker([loc.lat, loc.lng]).addTo(map).bindPopup(loc.driver_id);
      markersRef.current.push(marker);
    });
  }, [driverLocations]);

  useEffect(() => {
    loadData();
    // poll driver locations every 15 seconds
    const interval = setInterval(async () => {
      try {
        const locResp = await getDriverLocations();
        if (Array.isArray(locResp.data)) setDriverLocations(locResp.data);
      } catch (e) {
        console.error('Polling driver locations failed', e);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    console.log('LogisticsManagement: Starting loadData');
    try {
      setLoading(true);
      
      // Load real data from APIs
      console.log('LogisticsManagement: Loading real data from APIs');
      const [driversData, ordersData] = await Promise.all([
        getDrivers(),
        getLogisticsOrders()
      ]);
      
      setDrivers(driversData.data || []);
      const rawOrders = ordersData.data || [];
      const normalized = await Promise.all(rawOrders.map(async o => {
        const base = {
          ...o,
          pickup: o.pickup || { address: o.pickup_location || '' },
          drop: o.drop || { address: o.drop_location || '' }
        };
        // if coordinates missing, attempt geocode and persist server-side
        if ((base.pickup && (!base.pickup.lat || !base.pickup.lng)) || (base.drop && (!base.drop.lat || !base.drop.lng))) {
          try {
            const updates = {};
            if (base.pickup && (!base.pickup.lat || !base.pickup.lng)) {
              const coords = await geocodeAddress(base.pickup.address);
              base.pickup = { ...base.pickup, ...coords };
              updates.pickup = base.pickup;
            }
            if (base.drop && (!base.drop.lat || !base.drop.lng)) {
              const coords = await geocodeAddress(base.drop.address);
              base.drop = { ...base.drop, ...coords };
              updates.drop = base.drop;
            }
            if (Object.keys(updates).length) {
              // fire-and-forget update to server so future loads have coords
              updateLogisticsOrder(base.id, updates).catch(() => {});
            }
          } catch (e) {
            console.warn('auto-geocode failed for order', o.id, e);
          }
        }
        return base;
      }));
      setOrders(normalized);
      // fetch driver positions from backend
      try {
        const locResp = await getDriverLocations();
        if (Array.isArray(locResp.data)) {
          setDriverLocations(locResp.data);
        }
      } catch (err) {
        console.error('Failed to load driver locations', err);
      }
      
      // also load company info so we can prefill "use company location"
      try {
        const compResp = await getCompany();
        const comp = compResp.data || {};
        setCompanyLocation({
          address: comp.address || comp.location?.address || '',
          lat: comp.lat || comp.location?.lat || null,
          lng: comp.lng || comp.location?.lng || null
        });
      } catch (err) {
        console.error('Failed to load company data', err);
      }
      
      // Calculate basic reports
      const completedOrders = normalized.length;
      const deliveredOrders = normalized.filter(o => o.status === 'delivered').length;
      const activeDrivers = drivers.filter(d => d.status === 'active').length;
      const totalMileage = normalized.reduce((sum, order) => {
        // Mock mileage calculation - in real app this would come from order updates
        return sum + (Math.random() * 50 + 10);
      }, 0);

      setReports({
        totalOrders: normalized.length,
        completedOrders: deliveredOrders,
        activeDrivers,
        totalMileage: Math.round(totalMileage),
        averageOrderValue: normalized.length > 0 ? Math.round(totalMileage / normalized.length) : 0
      });

      // Load notifications
      try {
        const [notificationsResp, unreadResp] = await Promise.all([
          getNotifications(),
          getUnreadNotificationCount()
        ]);
        setNotifications(notificationsResp.data || []);
        setUnreadCount(unreadResp.data?.unreadCount || 0);
      } catch (err) {
        console.error('Failed to load notifications', err);
      }
      
      console.log('LogisticsManagement: Real data loaded', { drivers: driversData.data, orders: ordersData.data });
    } catch (e) {
      console.error('Error in loadData:', e);
      alert('Failed to load some data. Please check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDriver = async (e) => {
    e.preventDefault();
    try {
      console.log('Creating driver with payload:', driverForm);
      const payload = { ...driverForm };
      const response = await createDriver(payload);
      console.log('Driver created successfully:', response);
      alert('Driver created successfully');
      setShowDriverForm(false);
      setDriverForm({ name: '', phone: '', vehicle_no: '', username: '', password: '', image: '' });
      loadData();
    } catch (e) {
      console.error('Error creating driver:', e);
      console.error('Error response:', e.response);
      alert(`Failed to create driver: ${e.response?.data?.error || e.message}`);
    }
  };

  const handleUpdateDriver = async (e) => {
    e.preventDefault();
    if (!selectedDriver) return;

    try {
      const payload = { ...driverForm };
      // If password is empty, don't send it to avoid overwriting
      if (!payload.password) delete payload.password;
      await updateDriver(selectedDriver.id, payload);
      alert('Driver updated successfully');
      setShowDriverForm(false);
      setSelectedDriver(null);
      setDriverForm({ name: '', phone: '', vehicle_no: '', username: '', password: '', image: '' });
      loadData();
    } catch (e) {
      console.error('Error updating driver:', e);
      alert('Failed to update driver');
    }
  };

  const handleDriverImageChange = async (file) => {
    if (!file) return;
    try {
      setUploadingImage(true);
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result;
        const res = await uploadImage(base64, file.name);
        const url = res.data?.url || '';
        setDriverForm(prev => ({ ...prev, image: url }));
      };
      reader.readAsDataURL(file);
    } catch (e) {
      console.error('Image upload failed', e);
      alert('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteDriver = async (driverId) => {
    if (!confirm('Are you sure you want to delete this driver?')) return;

    try {
      await deleteDriver(driverId);
      alert('Driver deleted successfully');
      loadData();
    } catch (e) {
      console.error('Error deleting driver:', e);
      alert('Failed to delete driver');
    }
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    try {
      if (!orderForm.pickup.address.trim() || !orderForm.drop.address.trim()) {
        alert('Please select both pickup and drop locations using the map');
        return;
      }

      // ensure coordinates exist; geocode if necessary
      let pickup = { ...orderForm.pickup };
      let drop = { ...orderForm.drop };

      if (!pickup.lat || !pickup.lng) {
        const coords = await geocodeAddress(pickup.address);
        pickup = { ...pickup, ...coords };
      }
      if (!drop.lat || !drop.lng) {
        const coords = await geocodeAddress(drop.address);
        drop = { ...drop, ...coords };
      }

      const payload = {
        driver_id: orderForm.driver_id,
        vehicle_no: orderForm.vehicle_no,
        load_qty: orderForm.load_qty,
        schedule_date: orderForm.schedule_date,
        pickup,
        drop
      };
      console.log('Creating order with payload:', payload);
      const response = await createLogisticsOrder(payload);
      console.log('Order created successfully:', response);
      alert('Order created successfully');
      setShowOrderForm(false);
      setOrderForm({ driver_id: '', vehicle_no: '', load_qty: '', schedule_date: '', pickup: { address: '', lat: null, lng: null }, drop: { address: '', lat: null, lng: null } });
      loadData();
    } catch (e) {
      console.error('Error creating order:', e);
      console.error('Error response:', e.response);
      alert(`Failed to create order: ${e.response?.data?.error || e.message}`);
    }
  };

  const handleUpdateOrder = async (orderId, updates) => {
    try {
      await updateLogisticsOrder(orderId, updates);
      loadData();
    } catch (e) {
      console.error('Error updating order:', e);
      alert('Failed to update order');
    }
  };

  const viewOrderUpdates = async (order) => {
    try {
      const updatesData = await getOrderUpdates(order.id);
      const updates = updatesData.data || [];
      setOrderUpdates(updates);
      // compute total mileage for this order
      const total = updates.reduce((sum, u) => sum + (u.mileage || 0), 0);
      setOrderTotalMileage(total);

      // ensure selected order has object structure
      setSelectedOrder({
        ...order,
        pickup: order.pickup || { address: order.pickup_location || '' },
        drop: order.drop || { address: order.drop_location || '' }
      });
    } catch (e) {
      console.error('Error loading order updates:', e);
      alert('Failed to load order updates');
    }
  };

  const viewDriverActivity = async (driver) => {
    try {
      const activityData = await getDriverActivity(driver.id);
      setDriverActivity(activityData.data);
      setSelectedDriver(driver);
    } catch (e) {
      console.error('Error loading driver activity:', e);
      alert('Failed to load driver activity');
    }
  };

  const editDriver = (driver) => {
    setSelectedDriver(driver);
    setDriverForm({
      name: driver.name,
      phone: driver.phone,
      vehicle_no: driver.vehicle_no,
      username: driver.username,
      password: '', // Don't show existing password
      image: driver.image || ''
    });
    setShowDriverForm(true);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'assigned': return '#f39c12';
      case 'accepted': return '#3498db';
      case 'rejected': return '#e74c3c';
      case 'load_started': return '#3498db';
      case 'load_out': return '#9b59b6';
      case 'in_transit': return '#e67e22';
      case 'delivered': return '#27ae60';
      default: return '#95a5a6';
    }
  };

  if (loading) {
    return <div style={{ padding: '50px', textAlign: 'center' }}>Loading...</div>;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa' }}>
      {/* Header */}
      <div style={{
        background: 'white',
        padding: '20px',
        boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{ margin: '0 0 5px 0', color: '#2c3e50' }}>🚛 Logistics Management</h1>
          <p style={{ margin: 0, color: '#666' }}>
            Welcome, {user.name} ({user.role})
          </p>
        </div>
        <button
          onClick={onLogout}
          style={{
            padding: '8px 16px',
            background: '#e74c3c',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Logout
        </button>
      </div>

      <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Tab Navigation */}
        <div style={{ marginBottom: '30px' }}>
          <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid #ddd' }}>
            {[
              { id: 'drivers', label: '👥 Drivers', count: drivers.length },
              { id: 'locations', label: '📍 Live Locations', count: driverLocations.length },
              { id: 'orders', label: '📦 Orders', count: orders.length },
              { id: 'notifications', label: '🔔 Notifications', count: unreadCount },
              { id: 'reports', label: '📊 Reports' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '12px 20px',
                  background: activeTab === tab.id ? '#3498db' : 'white',
                  color: activeTab === tab.id ? 'white' : '#333',
                  border: activeTab === tab.id ? 'none' : '1px solid #ddd',
                  borderBottom: activeTab === tab.id ? 'none' : '1px solid #ddd',
                  borderRadius: activeTab === tab.id ? '4px 4px 0 0' : '4px 4px 0 0',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>

        {/* Drivers Tab */}
        {activeTab === 'drivers' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#2c3e50' }}>👥 Driver Management</h2>
              <button
                onClick={() => {
                  setSelectedDriver(null);
                  setDriverForm({ name: '', phone: '', vehicle_no: '', username: '', password: '' });
                  setShowDriverForm(true);
                }}
                style={{
                  padding: '10px 20px',
                  background: '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                ➕ Add Driver
              </button>
            </div>

            <div style={{ display: 'grid', gap: '15px' }}>
              {drivers.map(driver => (
                <div
                  key={driver.id}
                  style={{
                    background: 'white',
                    padding: '20px',
                    borderRadius: '8px',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>{driver.name}</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', fontSize: '14px' }}>
                      <div><strong>Phone:</strong> {driver.phone}</div>
                      <div><strong>Vehicle:</strong> {driver.vehicle_no}</div>
                      <div><strong>Username:</strong> {driver.username}</div>
                      <div><strong>Status:</strong>
                        <span style={{
                          background: driver.status === 'active' ? '#27ae60' : '#e74c3c',
                          color: 'white',
                          padding: '2px 8px',
                          borderRadius: '3px',
                          fontSize: '12px',
                          marginLeft: '5px'
                        }}>
                          {driver.status}
                        </span>
                      </div>
                      <div><strong>Created:</strong> {new Date(driver.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => viewDriverActivity(driver)}
                      style={{
                        padding: '8px 12px',
                        background: '#3498db',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      📊 Activity
                    </button>
                    <button
                      onClick={() => editDriver(driver)}
                      style={{
                        padding: '8px 12px',
                        background: '#f39c12',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleDeleteDriver(driver.id)}
                      style={{
                        padding: '8px 12px',
                        background: '#e74c3c',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Locations Tab */}
        {activeTab === 'locations' && (
          <div>
            <h2 style={{ marginBottom: '20px', color: '#2c3e50' }}>📍 Live Driver Locations (On Duty)</h2>
            {/* map display */}
            <div ref={mapRef} style={{ width: '100%', height: '300px', marginBottom: '20px', border: '1px solid #ccc' }} />
            <div style={{ display: 'grid', gap: '15px' }}>
              {driverLocations.length === 0 ? (
                <div style={{
                  padding: '40px',
                  textAlign: 'center',
                  background: 'white',
                  borderRadius: '8px',
                  color: '#666'
                }}>
                  No drivers currently on duty
                </div>
              ) : (
                driverLocations.map(location => {
                  const driver = drivers.find(d => d.id === location.driver_id);
                  return (
                    <div
                      key={location.driver_id}
                      style={{
                        background: 'white',
                        padding: '20px',
                        borderRadius: '8px',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>
                            {driver?.name || 'Unknown Driver'}
                          </h3>
                          <div style={{ fontSize: '14px', color: '#666' }}>
                            <div><strong>Vehicle:</strong> {driver?.vehicle_no}</div>
                            <div><strong>Phone:</strong> {driver?.phone}</div>
                            <div><strong>Last Update:</strong> {new Date(location.last_update).toLocaleString()}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{
                            background: '#27ae60',
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '3px',
                            fontSize: '12px',
                            display: 'inline-block',
                            marginBottom: '10px'
                          }}>
                            🟢 On Duty
                          </div>
                          <div style={{ fontSize: '12px', color: '#666' }}>
                            Lat: {location.lat.toFixed(6)}<br />
                            Lng: {location.lng.toFixed(6)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#2c3e50' }}>📦 Order Management</h2>
              <button
                onClick={() => setShowOrderForm(true)}
                style={{
                  padding: '10px 20px',
                  background: '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                ➕ Create Order
              </button>
            </div>

            <div style={{ display: 'grid', gap: '15px' }}>
              {orders.map(order => {
                const driver = drivers.find(d => d.id === order.driver_id);
                return (
                  <div
                    key={order.id}
                    style={{
                      background: 'white',
                      padding: '20px',
                      borderRadius: '8px',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                      borderLeft: `4px solid ${getStatusColor(order.status)}`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>
                          Order #{order.id}
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', fontSize: '14px' }}>
                          <div><strong>Driver:</strong> {driver?.name || 'Unknown'}</div>
                          <div><strong>Vehicle:</strong> {order.vehicle_no}</div>
                          <div><strong>Load:</strong> {order.load_qty}</div>
                          <div><strong>Pickup:</strong> {order.pickup?.address || order.pickup_location}</div>
                          <div><strong>Drop:</strong> {order.drop?.address || order.drop_location}</div>
                          <div><strong>Date:</strong> {order.schedule_date}</div>
                          <div><strong>Status:</strong>
                            <span style={{
                              background: getStatusColor(order.status),
                              color: 'white',
                              padding: '2px 8px',
                              borderRadius: '3px',
                              fontSize: '12px',
                              marginLeft: '5px'
                            }}>
                              {order.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <button
                          onClick={() => viewOrderUpdates(order)}
                          style={{
                            padding: '8px 12px',
                            background: '#3498db',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          📋 Updates
                        </button>
                        <select
                          value={order.status}
                          onChange={(e) => handleUpdateOrder(order.id, { status: e.target.value })}
                          style={{
                            padding: '8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px'
                          }}
                        >
                          <option value="assigned">Assigned</option>
                          <option value="accepted">Accepted</option>
                          <option value="rejected">Rejected</option>
                          <option value="load_started">Load Started</option>
                          <option value="load_out">Load Out</option>
                          <option value="in_transit">In Transit</option>
                          <option value="delivered">Delivered</option>
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div>
            <h2 style={{ marginBottom: '20px', color: '#2c3e50' }}>🔔 Notifications</h2>
            
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <button
                onClick={() => loadData()}
                style={{
                  padding: '8px 16px',
                  background: '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                🔄 Refresh
              </button>
              <span style={{ alignSelf: 'center', color: '#666' }}>
                {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All notifications read'}
              </span>
            </div>

            <div style={{ display: 'grid', gap: '15px' }}>
              {notifications.length === 0 ? (
                <div style={{
                  background: 'white',
                  padding: '40px',
                  borderRadius: '8px',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                  textAlign: 'center',
                  color: '#666'
                }}>
                  No notifications yet
                </div>
              ) : (
                notifications.map(notification => (
                  <div
                    key={notification.id}
                    style={{
                      background: notification.read ? 'white' : '#e8f4fd',
                      padding: '20px',
                      borderRadius: '8px',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                      borderLeft: notification.read ? '4px solid #ddd' : '4px solid #3498db'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: '0 0 5px 0', color: '#2c3e50' }}>
                          {notification.title}
                        </h4>
                        <p style={{ margin: '0 0 10px 0', color: '#555', lineHeight: '1.5' }}>
                          {notification.message}
                        </p>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {new Date(notification.createdAt).toLocaleString()}
                          {notification.orderId && (
                            <span style={{ marginLeft: '10px' }}>
                              Order ID: {notification.orderId}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        {!notification.read && (
                          <button
                            onClick={async () => {
                              try {
                                await markNotificationAsRead(notification.id);
                                setNotifications(prev => prev.map(n => 
                                  n.id === notification.id ? { ...n, read: true } : n
                                ));
                                setUnreadCount(prev => Math.max(0, prev - 1));
                              } catch (err) {
                                console.error('Failed to mark as read', err);
                              }
                            }}
                            style={{
                              padding: '6px 12px',
                              background: '#27ae60',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            Mark Read
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            if (window.confirm('Delete this notification?')) {
                              try {
                                await deleteNotification(notification.id);
                                setNotifications(prev => prev.filter(n => n.id !== notification.id));
                                if (!notification.read) {
                                  setUnreadCount(prev => Math.max(0, prev - 1));
                                }
                              } catch (err) {
                                console.error('Failed to delete notification', err);
                              }
                            }
                          }}
                          style={{
                            padding: '6px 12px',
                            background: '#e74c3c',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div>
            <h2 style={{ marginBottom: '20px', color: '#2c3e50' }}>📊 Reports & Analytics</h2>
            
            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
              <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                textAlign: 'center'
              }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#3498db' }}>{reports.totalOrders}</h3>
                <p style={{ margin: 0, color: '#666' }}>Total Orders</p>
              </div>
              <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                textAlign: 'center'
              }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#27ae60' }}>{reports.completedOrders}</h3>
                <p style={{ margin: 0, color: '#666' }}>Completed Orders</p>
              </div>
              <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                textAlign: 'center'
              }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#e67e22' }}>{reports.activeDrivers}</h3>
                <p style={{ margin: 0, color: '#666' }}>Active Drivers</p>
              </div>
              <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                textAlign: 'center'
              }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#9b59b6' }}>{reports.totalMileage} km</h3>
                <p style={{ margin: 0, color: '#666' }}>Total Mileage</p>
              </div>
            </div>

            {/* Driver Performance */}
            <div style={{
              background: 'white',
              padding: '30px',
              borderRadius: '8px',
              boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
              marginBottom: '20px'
            }}>
              <h3 style={{ marginBottom: '20px', color: '#2c3e50' }}>🚛 Driver Performance</h3>
              <div style={{ display: 'grid', gap: '15px' }}>
                {drivers.map(driver => {
                  const driverOrders = orders.filter(o => o.driver_id === driver.id);
                  const completedOrders = driverOrders.filter(o => o.status === 'delivered').length;
                  const totalMileage = driverOrders.reduce((sum, order) => sum + (Math.random() * 50 + 10), 0);
                  
                  return (
                    <div
                      key={driver.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '15px',
                        background: '#f8f9fa',
                        borderRadius: '6px'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{driver.name}</div>
                        <div style={{ fontSize: '14px', color: '#666' }}>
                          Vehicle: {driver.vehicle_no} | Orders: {driverOrders.length} | Completed: {completedOrders}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#3498db' }}>
                          {Math.round(totalMileage)} km
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>Total Mileage</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Order Status Breakdown */}
            <div style={{
              background: 'white',
              padding: '30px',
              borderRadius: '8px',
              boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ marginBottom: '20px', color: '#2c3e50' }}>📦 Order Status Breakdown</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                {[
                  { status: 'assigned', label: 'Assigned', color: '#f39c12' },
                  { status: 'accepted', label: 'Accepted', color: '#3498db' },
                  { status: 'load_started', label: 'Load Started', color: '#3498db' },
                  { status: 'load_out', label: 'Load Out', color: '#9b59b6' },
                  { status: 'in_transit', label: 'In Transit', color: '#e67e22' },
                  { status: 'delivered', label: 'Delivered', color: '#27ae60' },
                  { status: 'rejected', label: 'Rejected', color: '#e74c3c' }
                ].map(item => {
                  const count = orders.filter(o => o.status === item.status).length;
                  return (
                    <div
                      key={item.status}
                      style={{
                        padding: '15px',
                        background: '#f8f9fa',
                        borderRadius: '6px',
                        textAlign: 'center',
                        borderLeft: `4px solid ${item.color}`
                      }}
                    >
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: item.color, marginBottom: '5px' }}>
                        {count}
                      </div>
                      <div style={{ fontSize: '14px', color: '#666' }}>{item.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Driver Form Modal */}
        {showDriverForm && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}>
            <div style={{
              background: 'white',
              padding: '30px',
              borderRadius: '8px',
              width: '500px',
              maxWidth: '90%'
            }}>
              <h2 style={{ marginBottom: '20px', color: '#2c3e50' }}>
                {selectedDriver ? '✏️ Edit Driver' : '➕ Add Driver'}
              </h2>
              <form onSubmit={selectedDriver ? handleUpdateDriver : handleCreateDriver}>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Name *</label>
                  <input
                    type="text"
                    value={driverForm.name}
                    onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })}
                    required
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Phone *</label>
                  <input
                    type="text"
                    value={driverForm.phone}
                    onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })}
                    required
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Vehicle Number *</label>
                  <input
                    type="text"
                    value={driverForm.vehicle_no}
                    onChange={(e) => setDriverForm({ ...driverForm, vehicle_no: e.target.value })}
                    required
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Username *</label>
                  <input
                    type="text"
                    value={driverForm.username}
                    onChange={(e) => setDriverForm({ ...driverForm, username: e.target.value })}
                    required
                    disabled={!!selectedDriver}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    Password {selectedDriver ? '(Leave empty to keep current)' : '*'}
                  </label>
                  <input
                    type="password"
                    value={driverForm.password}
                    onChange={(e) => setDriverForm({ ...driverForm, password: e.target.value })}
                    required={!selectedDriver}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Driver Image</label>
                  {driverForm.image && (
                    <div style={{ marginBottom: '8px' }}>
                      <img src={driverForm.image} alt="driver" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #ddd' }} />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files && e.target.files[0];
                      if (f) handleDriverImageChange(f);
                    }}
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDriverForm(false);
                      setSelectedDriver(null);
                      setDriverForm({ name: '', phone: '', vehicle_no: '', username: '', password: '', image: '' });
                    }}
                    style={{
                      padding: '10px 20px',
                      background: '#95a5a6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      marginRight: '10px'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '10px 20px',
                      background: '#27ae60',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    {selectedDriver ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Order Form Modal */}
        {showOrderForm && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}>
            <div style={{
              background: 'white',
              padding: '30px',
              borderRadius: '8px',
              width: '600px',
              maxWidth: '90%'
            }}>
              <h2 style={{ marginBottom: '20px', color: '#2c3e50' }}>➕ Create Order</h2>
              <form onSubmit={handleCreateOrder}>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Driver *</label>
                  <select
                    value={orderForm.driver_id}
                    onChange={(e) => {
                      const driver = drivers.find(d => d.id === e.target.value);
                      setOrderForm({
                        ...orderForm,
                        driver_id: e.target.value,
                        vehicle_no: driver?.vehicle_no || ''
                      });
                    }}
                    required
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                  >
                    <option value="">Select Driver</option>
                    {drivers.filter(d => d.status === 'active').map(driver => (
                      <option key={driver.id} value={driver.id}>
                        {driver.name} - {driver.vehicle_no}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Vehicle Number</label>
                  <input
                    type="text"
                    value={orderForm.vehicle_no}
                    readOnly
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', background: '#f9f9f9' }}
                  />
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Load Quantity *</label>
                  <input
                    type="text"
                    value={orderForm.load_qty}
                    onChange={(e) => setOrderForm({ ...orderForm, load_qty: e.target.value })}
                    placeholder="e.g., 25 tons"
                    required
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Pickup Location *</label>
                  {companyLocation.lat && companyLocation.lng && (
                    <button
                      type="button"
                      onClick={() => setOrderForm({ ...orderForm, pickup: companyLocation })}
                      style={{
                        background: '#3498db',
                        color: 'white',
                        border: 'none',
                        padding: '5px 10px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Use Company
                    </button>
                  )}
                </div>
                <LocationPicker
                  label=""
                  value={orderForm.pickup}
                  onChange={(val) => setOrderForm({ ...orderForm, pickup: val })}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Drop Location *</label>
                  {companyLocation.lat && companyLocation.lng && (
                    <button
                      type="button"
                      onClick={() => setOrderForm({ ...orderForm, drop: companyLocation })}
                      style={{
                        background: '#3498db',
                        color: 'white',
                        border: 'none',
                        padding: '5px 10px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Use Company
                    </button>
                  )}
                </div>
                <LocationPicker
                  label=""
                  value={orderForm.drop}
                  onChange={(val) => setOrderForm({ ...orderForm, drop: val })}
                />
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Schedule Date *</label>
                  <input
                    type="date"
                    value={orderForm.schedule_date}
                    onChange={(e) => setOrderForm({ ...orderForm, schedule_date: e.target.value })}
                    required
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                <div style={{ textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowOrderForm(false);
                      setOrderForm({ driver_id: '', vehicle_no: '', load_qty: '', schedule_date: '', pickup: { address: '', lat: null, lng: null }, drop: { address: '', lat: null, lng: null } });
                    }}
                    style={{
                      padding: '10px 20px',
                      background: '#95a5a6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      marginRight: '10px'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '10px 20px',
                      background: '#27ae60',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Create Order
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Order Updates Modal */}
        {selectedOrder && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}>
            <div style={{
              background: 'white',
              padding: '30px',
              borderRadius: '8px',
              width: '700px',
              maxWidth: '90%',
              maxHeight: '80vh',
              overflow: 'auto'
            }}>
              <h2 style={{ marginBottom: '20px', color: '#2c3e50' }}>
                📋 Order Updates - #{selectedOrder.id}
              </h2>
              {orderTotalMileage > 0 && (
                <div style={{ marginBottom: '10px', fontWeight: 'bold', color: '#34495e' }}>
                  🚗 Total mileage recorded: {orderTotalMileage} km
                </div>
              )}
              <div style={{ marginBottom: '20px' }}>
                {orderUpdates.length === 0 ? (
                  <p style={{ color: '#666', textAlign: 'center', padding: '20px' }}>No updates yet</p>
                ) : (
                  orderUpdates.map(update => (
                    <div
                      key={update.id}
                      style={{
                        background: '#f8f9fa',
                        padding: '15px',
                        borderRadius: '6px',
                        marginBottom: '10px',
                        borderLeft: `3px solid ${getStatusColor(update.status)}`
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <div>
                          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                            {update.status.replace('_', ' ').toUpperCase()}
                          </div>
                          <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>
                            Mileage: {update.mileage} km
                          </div>
                          {update.remark && (
                            <div style={{ fontSize: '14px', marginBottom: '5px' }}>
                              Remark: {update.remark}
                            </div>
                          )}
                          <div style={{ fontSize: '12px', color: '#999' }}>
                            {new Date(update.timestamp).toLocaleString()}
                          </div>
                        </div>
                        {update.image && (
                          <img
                            src={update.image}
                            alt="Update"
                            style={{
                              width: '80px',
                              height: '80px',
                              objectFit: 'cover',
                              borderRadius: '4px',
                              border: '1px solid #ddd'
                            }}
                          />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <button
                  onClick={() => setSelectedOrder(null)}
                  style={{
                    padding: '10px 20px',
                    background: '#95a5a6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Driver Activity Modal */}
        {driverActivity && selectedDriver && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}>
            <div style={{
              background: 'white',
              padding: '30px',
              borderRadius: '8px',
              width: '800px',
              maxWidth: '90%',
              maxHeight: '80vh',
              overflow: 'auto'
            }}>
              <h2 style={{ marginBottom: '20px', color: '#2c3e50' }}>
                📊 Activity Log - {selectedDriver.name}
              </h2>

              {/* total mileage for driver across all orders */}
              {driverActivity.updates && driverActivity.updates.length > 0 && (
                <div style={{ marginBottom: '15px', fontWeight: 'bold', color: '#34495e' }}>
                  🚗 Total mileage by driver: {driverActivity.updates.reduce((sum, u) => sum + (u.mileage || 0), 0)} km
                </div>
              )}

              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ marginBottom: '15px', color: '#2c3e50' }}>Order Updates</h3>
                {driverActivity.updates?.length === 0 ? (
                  <p style={{ color: '#666', textAlign: 'center', padding: '20px' }}>No order updates</p>
                ) : (
                  driverActivity.updates.map(update => (
                    <div
                      key={update.id}
                      style={{
                        background: '#f8f9fa',
                        padding: '15px',
                        borderRadius: '6px',
                        marginBottom: '10px',
                        borderLeft: `3px solid ${getStatusColor(update.status)}`
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                            Order #{update.order_id} - {update.status.replace('_', ' ').toUpperCase()}
                          </div>
                          <div style={{ fontSize: '14px', color: '#666' }}>
                            Mileage: {update.mileage} km | {new Date(update.timestamp).toLocaleString()}
                          </div>
                          {update.remark && (
                            <div style={{ fontSize: '14px', marginTop: '5px' }}>
                              {update.remark}
                            </div>
                          )}
                        </div>
                        {update.image && (
                          <img
                            src={update.image}
                            alt="Update"
                            style={{
                              width: '60px',
                              height: '60px',
                              objectFit: 'cover',
                              borderRadius: '4px',
                              border: '1px solid #ddd'
                            }}
                          />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ marginBottom: '15px', color: '#2c3e50' }}>Location History</h3>
                {driverActivity.locations?.length === 0 ? (
                  <p style={{ color: '#666', textAlign: 'center', padding: '20px' }}>No location data</p>
                ) : (
                  driverActivity.locations.map((location, index) => (
                    <div
                      key={index}
                      style={{
                        background: '#f8f9fa',
                        padding: '10px',
                        borderRadius: '4px',
                        marginBottom: '5px',
                        fontSize: '14px'
                      }}
                    >
                      <span style={{ color: location.on_duty ? '#27ae60' : '#e74c3c' }}>
                        {location.on_duty ? '🟢' : '🔴'}
                      </span>
                      Lat: {location.lat.toFixed(6)}, Lng: {location.lng.toFixed(6)} |
                      {new Date(location.last_update).toLocaleString()}
                    </div>
                  ))
                )}
              </div>

              <div style={{ textAlign: 'right' }}>
                <button
                  onClick={() => {
                    setSelectedDriver(null);
                    setDriverActivity(null);
                  }}
                  style={{
                    padding: '10px 20px',
                    background: '#95a5a6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LogisticsManagement;