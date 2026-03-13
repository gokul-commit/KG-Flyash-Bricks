import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine';
import {
  getDriverProfile,
  getDriverOrders,
  updateDriverOrder,
  updateDriverLocation,
  getOrderUpdates,
  getBaseUrl,
  updateDriverProfile,
  uploadImage
} from '../api';

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

function RouteMap({ origin, destination, onDetails }) {
  const mapRef = useRef(null);
  const routingRef = useRef(null);
  const originMarker = useRef(null);
  const destMarker = useRef(null);

  // custom icons
  const blueIcon = new L.Icon({
    iconUrl: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32]
  });
  const redIcon = new L.Icon({
    iconUrl: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32]
  });

  useEffect(() => {
    const orig = origin || destination;
    const dest = destination;
    if (!orig || !dest || orig.lat == null || orig.lng == null || dest.lat == null || dest.lng == null) {
      return;
    }

    let map = mapRef.current && mapRef.current._leaflet_map;
    if (!map) {
      map = L.map(mapRef.current).setView(orig, 13);
      mapRef.current._leaflet_map = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);
    } else {
      map.panTo(orig, { animate: true, duration: 0.5 });
    }

    // update markers
    if (originMarker.current) {
      originMarker.current.setLatLng(orig);
    } else {
      originMarker.current = L.marker(orig, { icon: blueIcon }).addTo(map);
    }
    if (destMarker.current) {
      destMarker.current.setLatLng(dest);
    } else {
      destMarker.current = L.marker(dest, { icon: redIcon }).addTo(map);
    }

    // routing control
    if (!routingRef.current) {
      routingRef.current = L.Routing.control({
        waypoints: [L.latLng(orig.lat, orig.lng), L.latLng(dest.lat, dest.lng)],
        router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1' }),
        addWaypoints: false,
        draggableWaypoints: false,
        fitSelectedRoute: true,
        showAlternatives: false,
        lineOptions: { styles: [{ color: 'blue', weight: 4 }] }
      }).addTo(map);
      routingRef.current.on('routesfound', function(e) {
        const route = e.routes[0];
        if (onDetails) {
          onDetails({
            distance: `${(route.summary.totalDistance / 1000).toFixed(1)} km`,
            duration: `${Math.ceil(route.summary.totalTime / 60)} min`
          });
        }
      });
    } else {
      routingRef.current.setWaypoints([L.latLng(orig.lat, orig.lng), L.latLng(dest.lat, dest.lng)]);
    }
  }, [origin, destination, onDetails]);

  return <div ref={mapRef} style={{ width: '100%', height: '300px', marginBottom: '20px' }} />;
}

function DriverDashboard({ user, onLogout }) {
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderUpdates, setOrderUpdates] = useState([]);
  const [orderTotalMileage, setOrderTotalMileage] = useState(0);
  const [showOrderUpdatesModal, setShowOrderUpdatesModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [onDuty, setOnDuty] = useState(false);
  const [locationInterval, setLocationInterval] = useState(null);
  const [driverCoords, setDriverCoords] = useState(null);
  const [routeInfo, setRouteInfo] = useState({ distance: '', duration: '' });
  const [currentUpdate, setCurrentUpdate] = useState({
    status: '',
    mileage: '',
    remark: '',
    images: [] // Changed from single image to array of images
  });

  // New state for profile management and earnings
  const [activeTab, setActiveTab] = useState('orders');
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    image: '',
    vehicle_id: '' // Added vehicle assignment
  });
  const [earnings, setEarnings] = useState({
    totalEarnings: 0,
    completedTrips: 0,
    totalMileage: 0,
    recentPayments: []
  });
  const [vehicles, setVehicles] = useState([]); // Available vehicles for assignment

  const normalizeImageUrl = (imageUrl, base) => {
    if (!imageUrl) return imageUrl;
    if (imageUrl.startsWith('/')) return `${base}${imageUrl}`;
    if (imageUrl.includes('localhost:4000')) return imageUrl.replace(/http:\/\/localhost:4000/, base);
    if (imageUrl.startsWith('http')) return imageUrl;
    return imageUrl;
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('DriverDashboard: Loading real data');
      
      // Load driver profile and orders
      const [profileData, ordersData] = await Promise.all([
        getDriverProfile(),
        getDriverOrders()
      ]);
      const base = getBaseUrl();
      const normalizedProfile = {
        ...profileData.data,
        image: normalizeImageUrl(profileData.data?.image, base)
      };
      setProfile(normalizedProfile);
      const rawOrders = ordersData.data || [];
      // ensure each order has pickup/drop coords when possible
      const normalizedOrders = await Promise.all(rawOrders.map(async o => {
        const ord = {
          ...o,
          pickup: o.pickup || { address: o.pickup_location || '' },
          drop: o.drop || { address: o.drop_location || '' }
        };
        // coerce any existing numeric fields to numbers
        if (ord.pickup) {
          if (ord.pickup.lat != null) ord.pickup.lat = parseFloat(ord.pickup.lat);
          if (ord.pickup.lng != null) ord.pickup.lng = parseFloat(ord.pickup.lng);
        }
        if (ord.drop) {
          if (ord.drop.lat != null) ord.drop.lat = parseFloat(ord.drop.lat);
          if (ord.drop.lng != null) ord.drop.lng = parseFloat(ord.drop.lng);
        }
        // geocode missing coordinates
        if (ord.pickup.address && (!ord.pickup.lat || !ord.pickup.lng)) {
          const coords = await geocodeAddress(ord.pickup.address);
          ord.pickup = { ...ord.pickup, ...coords };
        }
        if (ord.drop.address && (!ord.drop.lat || !ord.drop.lng)) {
          const coords = await geocodeAddress(ord.drop.address);
          ord.drop = { ...ord.drop, ...coords };
        }
        return ord;
      }));
      setOrders(normalizedOrders);

      // Load available vehicles (mock data for now - in real app this would come from API)
      const availableVehicles = [
        'TN-01-AA-1234',
        'TN-01-BB-5678', 
        'TN01AB1234',
        'TN-42-H-2222',
        'TN-42-M-1558',
        'tn-42-kk-5555',
        'tn-4-hk-5588'
      ];
      setVehicles(availableVehicles);

      // Calculate earnings (mock calculation - in real app this would come from backend)
      const completedOrders = normalizedOrders.filter(o => o.status === 'delivered');
      const totalMileage = completedOrders.reduce((sum, order) => {
        // Get updates for this order to calculate mileage
        // For now, use a mock calculation
        return sum + (Math.random() * 50 + 10); // Mock mileage per trip
      }, 0);
      
      const totalEarnings = completedOrders.length * 500; // Mock: ₹500 per trip
      
      setEarnings({
        totalEarnings,
        completedTrips: completedOrders.length,
        totalMileage: Math.round(totalMileage),
        recentPayments: completedOrders.slice(-5).map(order => ({
          id: order.id,
          amount: 500,
          date: order.updatedAt || order.createdAt,
          trip: `Order #${order.id}`
        }))
      });
      
      console.log('DriverDashboard: Data loaded', { profile: profileData.data, orders: normalizedOrders });
    } catch (e) {
      console.error('Error loading driver data:', e);
      alert('Failed to load driver data. Please check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const toggleDuty = async () => {
    const newDutyStatus = !onDuty;
    setOnDuty(newDutyStatus);

    if (newDutyStatus) {
      // reset session distance
      // Start location tracking
      startLocationTracking();
    } else {
      // Stop location tracking
      stopLocationTracking();
    }
  };


  const startLocationTracking = () => {
    // Get initial location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setDriverCoords({ lat, lng });
        await updateLocation(lat, lng, true);
      });
    }

    // Set up interval for location updates (every 30 seconds)
    const interval = setInterval(() => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setDriverCoords({ lat, lng });
          await updateLocation(lat, lng, true);
        });
      }
    }, 30000);

    setLocationInterval(interval);
  };

  const stopLocationTracking = async () => {
    if (locationInterval) {
      clearInterval(locationInterval);
      setLocationInterval(null);
    }

    // Send final location update with on_duty: false
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        await updateLocation(position.coords.latitude, position.coords.longitude, false);
      });
    }
  };

  const updateLocation = async (lat, lng, dutyStatus) => {
    try {
      await updateDriverLocation({ lat, lng, on_duty: dutyStatus });
    } catch (e) {
      console.error('Error updating location:', e);
    }
  };

  const selectOrder = async (order) => {
    setSelectedOrder(order);
    setCurrentUpdate({
      status: order.status,
      mileage: '',
      remark: '',
      images: []
    });

    // geocode pickup/drop if coords missing
    const fixCoords = async (ord) => {
      let changed = false;
      const o = { ...ord };
      if (o.pickup?.address && (!o.pickup.lat || !o.pickup.lng)) {
        const { lat, lng } = await geocodeAddress(o.pickup.address);
        o.pickup = { ...o.pickup, lat, lng };
        changed = true;
      }
      if (o.drop?.address && (!o.drop.lat || !o.drop.lng)) {
        const { lat, lng } = await geocodeAddress(o.drop.address);
        o.drop = { ...o.drop, lat, lng };
        changed = true;
      }
      return changed ? o : ord;
    };

    const fixed = await fixCoords(order);
    if (fixed !== order) {
      setSelectedOrder(fixed);
    }

    // load any previous updates so we can calculate total mileage
    try {
      const res = await getOrderUpdates(order.id);
      const updates = res.data || [];
      setOrderUpdates(updates);
      setOrderTotalMileage(updates.reduce((s,u) => s + (u.mileage || 0), 0));
    } catch (e) {
      console.error('Error fetching order updates for driver:', e);
      setOrderUpdates([]);
      setOrderTotalMileage(0);
    }

    // attempt to update current coordinates immediately for better routing
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setDriverCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    }
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Limit to 4 images maximum
    const maxImages = 4;
    const currentImages = currentUpdate.images || [];
    const availableSlots = maxImages - currentImages.length;

    if (files.length > availableSlots) {
      alert(`You can only upload up to ${maxImages} images. You have ${availableSlots} slots remaining.`);
      return;
    }

    // Process each file
    const newImages = [];
    let processedCount = 0;

    files.forEach((file, index) => {
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          newImages.push({
            id: Date.now() + index,
            data: event.target.result,
            name: file.name
          });
          processedCount++;

          // When all files are processed, update state
          if (processedCount === files.length) {
            setCurrentUpdate({
              ...currentUpdate,
              images: [...currentImages, ...newImages]
            });
          }
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const removeImage = (imageId) => {
    setCurrentUpdate({
      ...currentUpdate,
      images: currentUpdate.images.filter(img => img.id !== imageId)
    });
  };

  const handleProfileUpdate = async () => {
    try {
      const updateData = {
        name: profileForm.name,
        phone: profileForm.phone,
        image: profileForm.image
      };

      // Include vehicle assignment if changed
      if (profileForm.vehicle_id && profileForm.vehicle_id !== profile?.vehicle_no) {
        updateData.vehicle_no = profileForm.vehicle_id;
      }

      await updateDriverProfile(updateData);
      
      // Update local profile state
      const updatedProfile = { ...profile, ...updateData };
      setProfile(updatedProfile);
      
      setEditingProfile(false);
      alert('Profile updated successfully!');
    } catch (e) {
      console.error('Error updating profile:', e);
      alert('Failed to update profile');
    }
  };

  const handleTripAction = async (orderId, action) => {
    try {
      if (action === 'accept') {
        await updateDriverOrder(orderId, { status: 'accepted', mileage: 0, remark: 'Trip accepted' });
      } else if (action === 'reject') {
        await updateDriverOrder(orderId, { status: 'rejected', mileage: 0, remark: 'Trip rejected' });
      }
      // Reload orders
      const ordersData = await getDriverOrders();
      setOrders(ordersData.data || []);
      alert(`Trip ${action}ed successfully`);
    } catch (e) {
      console.error('Error updating trip:', e);
      alert('Failed to update trip status');
    }
  };

  const submitUpdate = async () => {
    console.log('submitUpdate called with:', currentUpdate);
    try {
      if (!currentUpdate.status) {
        alert('Please select a status before submitting.');
        return;
      }

      // Upload images first if any
      const uploadedImageUrls = [];
      if (currentUpdate.images && currentUpdate.images.length > 0) {
        console.log('Uploading images:', currentUpdate.images.length);
        for (const image of currentUpdate.images) {
          try {
            const uploadResponse = await uploadImage(image.data, image.name);
            uploadedImageUrls.push(uploadResponse.data.url);
            console.log('Image uploaded:', uploadResponse.data.url);
          } catch (uploadError) {
            console.error('Error uploading image:', uploadError);
            alert(`Failed to upload image ${image.name}. Please try again.`);
            return;
          }
        }
      }

      // Prepare update data
      const updateData = {
        status: currentUpdate.status,
        mileage: currentUpdate.mileage,
        remark: currentUpdate.remark,
        images: uploadedImageUrls
      };

      console.log('Sending update data:', updateData);
      const response = await updateDriverOrder(selectedOrder.id, updateData);
      console.log('Update response:', response);
      alert('Status updated successfully!');
      
      // Refresh the orders list to show updated status
      loadData();
      
      setSelectedOrder(null);
      setOrderUpdates(prev => [...prev, response.data.update]);
      setOrderTotalMileage(prev => prev + parseFloat(currentUpdate.mileage || 0));
      setCurrentUpdate({ status: '', mileage: '', remark: '', images: [] });
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status. Please try again.');
    }
  };

  const handleCloseOrderUpdates = () => {
    setShowOrderUpdatesModal(false);
  };

  const getAvailableStatuses = (currentStatus) => {
    const allStatuses = [
      { value: 'load_started', label: '🚛 Start Load' },
      { value: 'load_out', label: '📦 Load Out' },
      { value: 'in_transit', label: '🚚 In Transit' },
      { value: 'delivered', label: '✅ Delivered' }
    ];

    // Status progression rules
    switch (currentStatus) {
      case 'assigned':
        return allStatuses; // Can choose any status
      case 'accepted':
        return allStatuses.filter(s => s.value !== 'assigned'); // Can't go back to assigned
      case 'load_started':
        return allStatuses.filter(s => !['assigned', 'accepted'].includes(s.value)); // Can't go back
      case 'load_out':
        return allStatuses.filter(s => !['assigned', 'accepted', 'load_started'].includes(s.value)); // Can't go back
      case 'in_transit':
        return allStatuses.filter(s => s.value === 'delivered'); // Only can deliver
      case 'delivered':
        return []; // Can't change once delivered
      default:
        return allStatuses;
    }
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {profile?.image && (
            <img 
              src={profile.image}
              alt="Driver"
              style={{ 
                width: '50px', 
                height: '50px', 
                borderRadius: '50%', 
                objectFit: 'cover',
                border: '2px solid #3498db'
              }}
            />
          )}
          <div>
            <h1 style={{ margin: '0 0 5px 0', color: '#2c3e50' }}>🚛 Driver Dashboard</h1>
            <p style={{ margin: 0, color: '#666' }}>
              Welcome, {profile?.name} | Vehicle: {profile?.vehicle_no}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontWeight: 'bold', color: onDuty ? '#27ae60' : '#e74c3c' }}>
              {onDuty ? '🟢 On Duty' : '🔴 Off Duty'}
            </span>
            <button
              onClick={toggleDuty}
              style={{
                padding: '8px 16px',
                background: onDuty ? '#e74c3c' : '#27ae60',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              {onDuty ? 'Go Off Duty' : 'Go On Duty'}
            </button>
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
      </div>

      <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Tab Navigation */}
        <div style={{ marginBottom: '30px' }}>
          <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid #ddd' }}>
            {[
              { id: 'orders', label: '📋 Orders', count: orders.length },
              { id: 'profile', label: '👤 Profile' },
              { id: 'earnings', label: '💰 Earnings' }
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
                {tab.label} {tab.count !== undefined ? `(${tab.count})` : ''}
              </button>
            ))}
          </div>
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div>
            <h2 style={{ marginBottom: '20px', color: '#2c3e50' }}>👤 Profile Management</h2>
            <div style={{
              background: 'white',
              padding: '30px',
              borderRadius: '8px',
              boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
              maxWidth: '600px'
            }}>
              {!editingProfile ? (
                <div>
                  <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    {profile?.image && (
                      <img 
                        src={profile.image}
                        alt="Driver"
                        style={{ 
                          width: '120px', 
                          height: '120px', 
                          borderRadius: '50%', 
                          objectFit: 'cover',
                          border: '4px solid #3498db',
                          marginBottom: '15px'
                        }}
                      />
                    )}
                  </div>
                  <div style={{ display: 'grid', gap: '15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>Name:</strong> {profile?.name}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>Phone:</strong> {profile?.phone}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>Vehicle:</strong> {profile?.vehicle_no}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>Username:</strong> {profile?.username}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>Status:</strong>
                      <span style={{
                        background: profile?.status === 'active' ? '#27ae60' : '#e74c3c',
                        color: 'white',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px'
                      }}>
                        {profile?.status}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', marginTop: '30px' }}>
                    <button
                      onClick={() => {
                        setProfileForm({
                          name: profile?.name || '',
                          phone: profile?.phone || '',
                          image: profile?.image || ''
                        });
                        setEditingProfile(true);
                      }}
                      style={{
                        padding: '12px 30px',
                        background: '#3498db',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '16px',
                        fontWeight: 'bold'
                      }}
                    >
                      ✏️ Edit Profile
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 style={{ marginBottom: '20px', color: '#2c3e50' }}>Edit Profile</h3>
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Name *</label>
                    <input
                      type="text"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                      style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                  </div>
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Phone *</label>
                    <input
                      type="text"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                  </div>
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Vehicle Assignment *</label>
                    <select
                      value={profileForm.vehicle_id || profile?.vehicle_no || ''}
                      onChange={(e) => setProfileForm({ ...profileForm, vehicle_id: e.target.value })}
                      style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                    >
                      <option value="">Select a vehicle</option>
                      {vehicles.map(vehicle => (
                        <option key={vehicle} value={vehicle}>
                          {vehicle}
                        </option>
                      ))}
                    </select>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                      Current vehicle: {profile?.vehicle_no || 'Not assigned'}
                    </div>
                  </div>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Profile Image</label>
                    {profileForm.image && (
                      <div style={{ marginBottom: '8px' }}>
                        <img src={profileForm.image} alt="preview" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #ddd' }} />
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => setProfileForm({ ...profileForm, image: reader.result });
                          reader.readAsDataURL(file);
                        }
                      }}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div style={{ textAlign: 'right', gap: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setEditingProfile(false)}
                      style={{
                        padding: '10px 20px',
                        background: '#95a5a6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleProfileUpdate}
                      style={{
                        padding: '10px 20px',
                        background: '#27ae60',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Update Profile
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Earnings Tab */}
        {activeTab === 'earnings' && (
          <div>
            <h2 style={{ marginBottom: '20px', color: '#2c3e50' }}>💰 Earnings & Payments</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '30px' }}>
              <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                textAlign: 'center'
              }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#27ae60' }}>₹{earnings.totalEarnings}</h3>
                <p style={{ margin: 0, color: '#666' }}>Total Earnings</p>
              </div>
              <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                textAlign: 'center'
              }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#3498db' }}>{earnings.completedTrips}</h3>
                <p style={{ margin: 0, color: '#666' }}>Completed Trips</p>
              </div>
              <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                textAlign: 'center'
              }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#e67e22' }}>{earnings.totalMileage} km</h3>
                <p style={{ margin: 0, color: '#666' }}>Total Mileage</p>
              </div>
            </div>

            <div style={{
              background: 'white',
              padding: '30px',
              borderRadius: '8px',
              boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ marginBottom: '20px', color: '#2c3e50' }}>Recent Payments</h3>
              {earnings.recentPayments.length === 0 ? (
                <p style={{ color: '#666', textAlign: 'center', padding: '20px' }}>No payments yet</p>
              ) : (
                <div style={{ display: 'grid', gap: '15px' }}>
                  {earnings.recentPayments.map(payment => (
                    <div
                      key={payment.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '15px',
                        background: '#f8f9fa',
                        borderRadius: '6px',
                        borderLeft: '4px solid #27ae60'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{payment.trip}</div>
                        <div style={{ fontSize: '14px', color: '#666' }}>
                          {new Date(payment.date).toLocaleDateString()}
                        </div>
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#27ae60' }}>
                        ₹{payment.amount}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div>
            <h2 style={{ marginBottom: '20px', color: '#2c3e50' }}>📋 Assigned Orders</h2>
            <div style={{ display: 'grid', gap: '15px' }}>
              {orders.length === 0 ? (
                <div style={{
                  padding: '40px',
                  textAlign: 'center',
                  background: 'white',
                  borderRadius: '8px',
                  color: '#666'
                }}>
                  No orders assigned yet
                </div>
              ) : (
                orders.map(order => (
                  <div
                    key={order.id}
                    style={{
                      background: 'white',
                      padding: '20px',
                      borderRadius: '8px',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                      borderLeft: `4px solid ${getStatusColor(order.status)}`,
                      cursor: 'pointer'
                    }}
                    onClick={() => selectOrder(order)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>
                          Order #{order.id}
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '14px' }}>
                          <div><strong>Vehicle:</strong> {order.vehicle_no}</div>
                          <div><strong>Load:</strong> {order.load_qty}</div>
                          <div><strong>Pickup:</strong> {order.pickup?.address || order.pickup_location}</div>
                          <div><strong>Drop:</strong> {order.drop?.address || order.drop_location}</div>
                          <div><strong>Date:</strong> {order.schedule_date}</div>
                          <div>
                            <strong>Status:</strong>
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
                      <div style={{ textAlign: 'right' }}>
                        {order.status === 'assigned' && (
                          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTripAction(order.id, 'accept');
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
                              ✅ Accept
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTripAction(order.id, 'reject');
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
                              ❌ Reject
                            </button>
                          </div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            selectOrder(order);
                          }}
                          style={{
                            padding: '8px 16px',
                            background: '#3498db',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                          }}
                        >
                          {order.status === 'assigned' ? 'Review Trip' : 'Update Status'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Order Update Form */}
        {selectedOrder && (
          <div style={{
            background: 'white',
            padding: '30px',
            borderRadius: '8px',
            boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
            marginTop: '30px'
          }}>
            <h2 style={{ marginBottom: '20px', color: '#2c3e50' }}>
              📝 Update Order #{selectedOrder.id}
            </h2>
            {orderTotalMileage > 0 && (
              <div style={{ marginBottom: '10px', fontWeight: 'bold', color: '#34495e' }}>
                🚗 Total mileage entered: {orderTotalMileage} km
              </div>
            )}

            {/* show navigation map if we have drop coordinates */}
            {(() => {
              const dropObj = selectedOrder.drop;
              if (!dropObj || !dropObj.lat || !dropObj.lng) return null;

              // origin is driver location if available; otherwise use pickup coords if we haven't left pickup yet,
              // or fall back to drop as last resort so map still renders
              let originCoords = null;
              if (driverCoords) {
                originCoords = driverCoords;
              } else if (
                selectedOrder.pickup &&
                selectedOrder.pickup.lat &&
                selectedOrder.pickup.lng
              ) {
                originCoords = { lat: selectedOrder.pickup.lat, lng: selectedOrder.pickup.lng };
              } else {
                originCoords = { lat: dropObj.lat, lng: dropObj.lng };
              }

              return (
                <>
                  <RouteMap
                    origin={originCoords}
                    destination={{ lat: dropObj.lat, lng: dropObj.lng }}
                    onDetails={(info) => setRouteInfo(info)}
                  />
                  {routeInfo.distance && (
                    <p>
                      <strong>Distance:</strong> {routeInfo.distance}{' '}
                      <strong>ETA:</strong> {routeInfo.duration}
                    </p>
                  )}
                  {/* show both addresses for clarity */}
                  {selectedOrder.pickup && (
                    <p>
                      <strong>Pickup:</strong> {selectedOrder.pickup.address}
                    </p>
                  )}
                  <p>
                    <strong>Drop:</strong> {dropObj.address || selectedOrder.drop_location}
                  </p>
                </>
              );
            })()}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Status *
                </label>
                <select
                  value={currentUpdate.status}
                  onChange={(e) => setCurrentUpdate({ ...currentUpdate, status: e.target.value })}
                  disabled={getAvailableStatuses(selectedOrder?.status || '').length === 0}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                    backgroundColor: getAvailableStatuses(selectedOrder?.status || '').length === 0 ? '#f5f5f5' : 'white',
                    cursor: getAvailableStatuses(selectedOrder?.status || '').length === 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  <option value="">Select Status</option>
                  {getAvailableStatuses(selectedOrder?.status || '').map(status => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
                {getAvailableStatuses(selectedOrder?.status || '').length === 0 && (
                  <div style={{ fontSize: '12px', color: '#e74c3c', marginTop: '5px' }}>
                    ⚠️ This order status cannot be modified
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Mileage (km) *
                </label>
                <input
                  type="number"
                  value={currentUpdate.mileage}
                  onChange={(e) => setCurrentUpdate({ ...currentUpdate, mileage: e.target.value })}
                  placeholder="Enter mileage"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>

            <div style={{ marginTop: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Remark (Optional)
              </label>
              <textarea
                value={currentUpdate.remark}
                onChange={(e) => setCurrentUpdate({ ...currentUpdate, remark: e.target.value })}
                placeholder="Add any remarks..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ marginTop: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Upload Images (Optional) - Max 4 images ({currentUpdate.images?.length || 0}/4)
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                disabled={(currentUpdate.images?.length || 0) >= 4}
                style={{
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  width: '100%',
                  opacity: (currentUpdate.images?.length || 0) >= 4 ? 0.5 : 1
                }}
              />
              <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                You can upload up to 4 images. Each image should be less than 5MB.
              </div>

              {/* Display uploaded images */}
              {currentUpdate.images && currentUpdate.images.length > 0 && (
                <div style={{ marginTop: '15px' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>Uploaded Images:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px' }}>
                    {currentUpdate.images.map((image, index) => (
                      <div key={image.id} style={{ position: 'relative' }}>
                        <img
                          src={image.data}
                          alt={`Upload ${index + 1}`}
                          style={{
                            width: '100%',
                            height: '100px',
                            objectFit: 'cover',
                            borderRadius: '4px',
                            border: '1px solid #ddd'
                          }}
                        />
                        <button
                          onClick={() => removeImage(image.id)}
                          style={{
                            position: 'absolute',
                            top: '5px',
                            right: '5px',
                            background: '#e74c3c',
                            color: 'white',
                            border: 'none',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Remove image"
                        >
                          ×
                        </button>
                        <div style={{
                          position: 'absolute',
                          bottom: '5px',
                          left: '5px',
                          background: 'rgba(0,0,0,0.7)',
                          color: 'white',
                          padding: '2px 6px',
                          borderRadius: '3px',
                          fontSize: '10px'
                        }}>
                          {index + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginTop: '30px', textAlign: 'center' }}>
              <button
                onClick={submitUpdate}
                style={{
                  padding: '12px 30px',
                  background: '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  marginRight: '10px'
                }}
              >
                Submit Update
              </button>
              {orderUpdates.length > 0 && (
                <button
                  onClick={() => setShowOrderUpdatesModal(true)}
                  style={{
                    padding: '12px 20px',
                    background: '#3498db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    marginRight: '10px'
                  }}
                >
                  View Updates ({orderUpdates.length})
                </button>
              )}
              <button
                onClick={() => setSelectedOrder(null)}
                style={{
                  padding: '12px 30px',
                  background: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Order Updates Modal */}
        {showOrderUpdatesModal && selectedOrder && orderUpdates.length > 0 && (
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
                  onClick={handleCloseOrderUpdates}
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

export default DriverDashboard;