import React, { useState, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getProducts, getEnquiries, getOrders, getEmployees, createProduct, createEmployee, deleteEmployee, getAnalyticsDashboard, uploadCompanyImages, getCompany, getBaseUrl, updateCompany, updateMyProfile } from '../api';

// free map helpers
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

function LocationPicker({ label, value, onChange }) {
  const mapRef = React.useRef(null);
  const markerRef = React.useRef(null);
  const mapInstanceRef = React.useRef(null);

  React.useEffect(() => {
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

  React.useEffect(() => {
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
      <input
        type="text"
        value={value.address}
        onChange={(e) => onChange({ ...value, address: e.target.value })}
        placeholder="Click map or type address"
        style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
      />
      <div ref={mapRef} style={{ width: '100%', height: '200px', marginTop: '10px', border: '1px solid #ccc' }} />
    </div>
  );
}

function AdminDashboard({ user, onLogout, setPageEditorMode, logisticsMode, setLogisticsMode }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [analytics, setAnalytics] = useState(null);
  const [products, setProducts] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [orders, setOrders] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [newProduct, setNewProduct] = useState({ name: '', desc: '', price: 0, stock: 0, category: '' });
  const [newEmployee, setNewEmployee] = useState({ 
    name: '', 
    email: '', 
    phone: '', 
    role: 'employee', 
    department: '',
    designation: '',
    joinDate: new Date().toISOString().split('T')[0],
    dateOfBirth: '',
    gender: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    aadharNumber: '',
    panNumber: '',
    bankAccountNumber: '',
    ifscCode: '',
    bankName: '',
    accountHolderName: '',
    baseSalary: 100,
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: ''
  });
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderStatusUpdate, setOrderStatusUpdate] = useState({ status: '', notes: '' });
  const [selectedEnquiry, setSelectedEnquiry] = useState(null);
  const [enquiryReply, setEnquiryReply] = useState('');
  const [company, setCompany] = useState(null);
  const [companySettings, setCompanySettings] = useState({
    heroImage: null,
    whyChooseUsBackground: null,
    ecoFriendlyIcon: null,
    strengthIcon: null,
    energyIcon: null,
    deliveryIcon: null,
    teamMember1Image: null,
    teamMember2Image: null,
    teamMember3Image: null,
    teamMember4Image: null
  });
  const [companyLocation, setCompanyLocation] = useState({ address: '', lat: null, lng: null });


  // profile editing state
  const [editUsername, setEditUsername] = useState(user.username || '');
  const [editPassword, setEditPassword] = useState('');


  useEffect(() => {
    loadData();
  }, []);

  // Load company data when Settings tab is opened
  useEffect(() => {
    if (activeTab === 'settings') {
      loadCompanyData();
    }
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [prodsData, enquiriesData, ordersData, empData, analyticsData] = await Promise.all([
        getProducts('all'),
        getEnquiries(),
        getOrders(),
        getEmployees(),
        getAnalyticsDashboard()
      ]);
      
      // Normalize product images for mobile compatibility
      const base = getBaseUrl();
      const normalizedProducts = (prodsData.data || []).map(p => ({
        ...p,
        image: p.image ? normalizeImageUrl(p.image, base) : p.image
      }));
      
      setProducts(normalizedProducts);
      setEnquiries(enquiriesData.data || []);
      setOrders(ordersData.data || []);
      setEmployees(empData.data || []);
      setAnalytics(analyticsData.data || {});
    } catch (e) {
      console.error('Error:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadCompanyData = async () => {
    try {
      const compData = await getCompany();
      const companyInfo = compData.data || {};
      const base = getBaseUrl();

      // Normalize stored image URLs so they work in production (avoid localhost loopback)
      const normalizedCompany = {
        ...companyInfo,
        heroImage: normalizeImageUrl(companyInfo.heroImage, base),
        whyChooseUsBackground: normalizeImageUrl(companyInfo.whyChooseUsBackground, base),
        ecoFriendlyIcon: normalizeImageUrl(companyInfo.ecoFriendlyIcon, base),
        strengthIcon: normalizeImageUrl(companyInfo.strengthIcon, base),
        energyIcon: normalizeImageUrl(companyInfo.energyIcon, base),
        deliveryIcon: normalizeImageUrl(companyInfo.deliveryIcon, base),
        teamMember1Image: normalizeImageUrl(companyInfo.teamMember1Image, base),
        teamMember2Image: normalizeImageUrl(companyInfo.teamMember2Image, base),
        teamMember3Image: normalizeImageUrl(companyInfo.teamMember3Image, base),
        teamMember4Image: normalizeImageUrl(companyInfo.teamMember4Image, base)
      };

      setCompany(normalizedCompany);
      // location may be stored directly or in lat/lng fields
      setCompanyLocation({
        address: normalizedCompany.address || normalizedCompany.location?.address || '',
        lat: normalizedCompany.lat || normalizedCompany.location?.lat || null,
        lng: normalizedCompany.lng || normalizedCompany.location?.lng || null
      });
    } catch (e) {
      console.error('Error loading company data:', e);
    }
  };

  const normalizeImageUrl = (imageUrl, base) => {
    if (!imageUrl) return imageUrl;
    
    // If it's already a relative path starting with /, prepend base
    if (imageUrl.startsWith('/')) {
      return `${base}${imageUrl}`;
    }
    
    // If it's a localhost URL, replace with current base
    if (imageUrl.includes('localhost:4000')) {
      return imageUrl.replace(/http:\/\/localhost:4000/, base);
    }
    
    // If it's already a full URL (not localhost), use as-is
    if (imageUrl.startsWith('http')) {
      return imageUrl;
    }
    
    // Fallback
    return imageUrl;
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      const response = await createProduct(newProduct);
      setProducts([...products, response.data]);
      setNewProduct({ name: '', desc: '', price: 0, stock: 0, category: '' });
      alert('Product added!');
    } catch (e) {
      alert('Error adding product');
    }
  };

  const handleAddEmployee = async () => {
    try {
      if (!newEmployee.name?.trim() || !newEmployee.email?.trim() || !newEmployee.phone?.trim()) {
        alert('❌ Kindly fill all required fields');
        return;
      }
      await createEmployee(newEmployee);
      alert('✅ Employee added successfully!');
      setNewEmployee({ name: '', email: '', phone: '', role: 'Supervisor', department: '', joinDate: new Date().toISOString().split('T')[0] });
      setShowAddEmployee(false);
      loadData();
    } catch (e) {
      alert('❌ Error adding employee: ' + (e.response?.data?.error || e.message));
    }
  };

  const handleDeleteEmployee = async (id) => {
    if (!window.confirm('Are you sure you want to delete this employee?')) return;
    try {
      await deleteEmployee(id);
      alert('✅ Employee deleted successfully!');
      loadData();
    } catch (e) {
      alert('❌ Error deleting employee');
    }
  };

  const handleUpdateProfile = async () => {
    try {
      if (!editUsername.trim() && !editPassword) {
        alert('Please enter a new username or password');
        return;
      }
      const payload = {};
      if (editUsername.trim() && editUsername !== user.username) payload.username = editUsername.trim();
      if (editPassword) payload.password = editPassword;
      // use convenience endpoint
      await updateMyProfile(payload);
      alert('✅ Profile updated successfully! Please log out and log in again.');
      setEditPassword('');
    } catch (e) {
      alert('❌ Error updating profile: ' + (e.response?.data?.error || e.message));
    }
  };

  const handleSaveCompanyInfo = async () => {
    try {
      // send address/coordinates along with whatever else you wish
      await updateCompany({
        address: companyLocation.address,
        lat: companyLocation.lat,
        lng: companyLocation.lng
      });
      alert('✅ Company location updated');
      await loadCompanyData();
    } catch (e) {
      alert('❌ Error saving company info: ' + (e.response?.data?.error || e.message));
    }
  };

  const handleSaveCompanySettings = async () => {
    try {
      // Filter out null/empty images
      const imagesToUpload = {};
      Object.entries(companySettings).forEach(([key, value]) => {
        if (value) {
          imagesToUpload[key] = value;
        }
      });

      if (Object.keys(imagesToUpload).length === 0) {
        alert('⚠️ Please select at least one image to upload');
        return;
      }

      const response = await uploadCompanyImages(imagesToUpload);
      alert('✅ Company images updated successfully!');
      
      // Reload company data to show updated images
      await loadCompanyData();
      
      // Reset the settings
      setCompanySettings({
        heroImage: null,
        whyChooseUsBackground: null,
        ecoFriendlyIcon: null,
        strengthIcon: null,
        energyIcon: null,
        deliveryIcon: null,
        teamMember1Image: null,
        teamMember2Image: null,
        teamMember3Image: null,
        teamMember4Image: null
      });
      
      // Reload data to refresh the company info
      loadData();
    } catch (e) {
      alert('❌ Error saving company images: ' + (e.response?.data?.error || e.message));
    }
  };

  const handleUpdateOrderStatus = async () => {
    if (!selectedOrder || !orderStatusUpdate.status) {
      alert('Please select a status');
      return;
    }
    try {
      const response = await fetch(`${getBaseUrl()}/api/orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: orderStatusUpdate.status,
          notes: orderStatusUpdate.notes
        })
      });
      if (!response.ok) throw new Error('Failed to update order');
      alert('✅ Order status updated!');
      setSelectedOrder(null);
      setOrderStatusUpdate({ status: '', notes: '' });
      loadData();
    } catch (e) {
      alert('❌ Error updating order: ' + e.message);
    }
  };

  const handleReplyToEnquiry = async () => {
    if (!selectedEnquiry || !enquiryReply.trim()) {
      alert('Please enter a reply message');
      return;
    }
    try {
      const response = await fetch(`${getBaseUrl()}/api/enquiries/${selectedEnquiry.id}/reply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: enquiryReply })
      });
      if (!response.ok) throw new Error('Failed to reply to enquiry');
      alert('✅ Reply sent successfully!');
      setSelectedEnquiry(null);
      setEnquiryReply('');
      loadData();
    } catch (e) {
      alert('❌ Error replying to enquiry: ' + e.message);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
        color: 'white',
        padding: '20px 30px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px' }}>Admin Dashboard</h1>
            <p style={{ margin: '5px 0 0 0', opacity: 0.9, fontSize: '13px' }}>Welcome back, {user.username}</p>
          </div>
          <button onClick={onLogout} style={{
            padding: '10px 20px',
            background: '#db4737',
            color: 'white',
            border: 'groove',
            borderRadius: '1000px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}>Logout</button>
        </div>
      </div>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 80px)' }}>
        {/* Sidebar */}
        <div style={{
          width: '250px',
          background: 'white',
          boxShadow: '2px 0 10px rgba(0,0,0,0.05)',
          padding: '20px',
          overflowY: 'auto'
        }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '12px', color: '#999', textTransform: 'uppercase' }}>Menu</h3>
          {['overview', 'analytics', 'products', 'enquiries', 'orders', 'employees', 'settings'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                width: '100%',
                padding: '12px 15px',
                marginBottom: '8px',
                background: activeTab === tab ? '#667eea' : 'transparent',
                color: activeTab === tab ? 'white' : '#2c3e50',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                textAlign: 'left',
                fontWeight: activeTab === tab ? 'bold' : 'normal',
                transition: 'all 0.3s'
              }}
            >
              {tab === 'overview' && '📊 Overview'}
              {tab === 'analytics' && '📈 Analytics'}
              {tab === 'products' && '📦 Products'}
              {tab === 'enquiries' && '💬 Enquiries'}
              {tab === 'orders' && '🛒 Orders'}
              {tab === 'employees' && '👥 Employees'}
              {tab === 'settings' && '⚙️ Settings'}
            </button>
          ))}

          <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '12px', color: '#999', textTransform: 'uppercase' }}>Tools</h3>
            <button
              onClick={() => setPageEditorMode(true)}
              style={{
                width: '100%',
                padding: '12px 15px',
                background: '#22ac03',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                textAlign: 'left',
                marginBottom: '8px'
              }}
            >
              📝 Page Editor
            </button>
            <button
              onClick={() => setLogisticsMode(true)}
              style={{
                width: '100%',
                padding: '12px 15px',
                background: '#e67e22',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                textAlign: 'left'
              }}
            >
              🚛 Logistics Management
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, padding: '30px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '50px' }}>Loading...</div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && analytics && (
                <div>
                  <h2 style={{ margin: '0 0 30px 0', color: '#2c3e50' }}>Dashboard Overview</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                    {[
                      { label: 'Total Orders', value: analytics.totalOrders, icon: '🛒', color: '#3498db' },
                      { label: 'Revenue', value: '₹' + (analytics.totalRevenue || 0).toLocaleString(), icon: '💰', color: '#27ae60' },
                      { label: 'Customers', value: analytics.totalCustomers, icon: '👥', color: '#f39c12' },
                      { label: 'Products', value: analytics.totalProducts, icon: '📦', color: '#9b59b6' },
                      { label: 'Enquiries', value: analytics.totalEnquiries, icon: '💬', color: '#e74c3c' }
                    ].map((stat, i) => (
                      <div key={i} style={{
                        background: 'white',
                        padding: '25px',
                        borderRadius: '8px',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                        borderLeft: `4px solid ${stat.color}`
                      }}>
                        <div style={{ fontSize: '24px', marginBottom: '10px' }}>{stat.icon}</div>
                        <p style={{ margin: '0 0 5px 0', color: '#999', fontSize: '12px', textTransform: 'uppercase' }}>{stat.label}</p>
                        <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: stat.color }}>{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  <h3 style={{ margin: '30px 0 20px 0', color: '#2c3e50' }}>Recent Orders</h3>
                  <div style={{ background: 'white', borderRadius: '8px', overflowX: 'auto', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                          <th style={{ padding: '15px', textAlign: 'left', fontWeight: 'bold', color: '#2c3e50' }}>Order ID</th>
                          <th style={{ padding: '15px', textAlign: 'left', fontWeight: 'bold', color: '#2c3e50' }}>Status</th>
                          <th style={{ padding: '15px', textAlign: 'left', fontWeight: 'bold', color: '#2c3e50' }}>Amount</th>
                          <th style={{ padding: '15px', textAlign: 'left', fontWeight: 'bold', color: '#2c3e50' }}>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.slice(-5).reverse().map(o => (
                          <tr key={o.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '15px', color: '#667eea', fontWeight: 'bold' }}>{o.id.slice(0, 8)}</td>
                            <td style={{ padding: '15px' }}>
                              <span style={{
                                background: o.status === 'pending' ? '#f39c12' : o.status === 'completed' ? '#27ae60' : '#3498db',
                                color: 'white',
                                padding: '4px 10px',
                                borderRadius: '4px',
                                fontSize: '12px'
                              }}>
                                {o.status}
                              </span>
                            </td>
                            <td style={{ padding: '15px', fontWeight: 'bold' }}>₹{(o.amount || 0).toLocaleString()}</td>
                            <td style={{ padding: '15px', color: '#666', fontSize: '13px' }}>{new Date(o.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Analytics Tab */}
              {activeTab === 'analytics' && (
                <div>
                  <h2 style={{ margin: '0 0 30px 0', color: '#2c3e50' }}>Analytics & Insights</h2>
                  
                  {/* Key Metrics */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                    <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', borderTop: '4px solid #3498db' }}>
                      <p style={{ margin: 0, color: '#999', fontSize: '12px', fontWeight: 'bold' }}>ORDER FULFILLMENT RATE</p>
                      <p style={{ margin: '10px 0 0 0', fontSize: '28px', fontWeight: 'bold', color: '#3498db' }}>{analytics?.orderFulfillmentRate || 0}%</p>
                    </div>
                    <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', borderTop: '4px solid #27ae60' }}>
                      <p style={{ margin: 0, color: '#999', fontSize: '12px', fontWeight: 'bold' }}>REPLIES RATE</p>
                      <p style={{ margin: '10px 0 0 0', fontSize: '28px', fontWeight: 'bold', color: '#27ae60' }}>{analytics?.repliedEnquiriesPercentage || 0}%</p>
                    </div>
                    <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', borderTop: '4px solid #e74c3c' }}>
                      <p style={{ margin: 0, color: '#999', fontSize: '12px', fontWeight: 'bold' }}>LOW STOCK ITEMS</p>
                      <p style={{ margin: '10px 0 0 0', fontSize: '28px', fontWeight: 'bold', color: '#e74c3c' }}>{analytics?.lowStockProducts || 0}</p>
                    </div>
                    <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', borderTop: '4px solid #f39c12' }}>
                      <p style={{ margin: 0, color: '#999', fontSize: '12px', fontWeight: 'bold' }}>AVG ORDER VALUE</p>
                      <p style={{ margin: '10px 0 0 0', fontSize: '28px', fontWeight: 'bold', color: '#f39c12' }}>₹{analytics?.averageOrderValue || 0}</p>
                    </div>
                  </div>

                  {/* Orders by Status */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '30px' }}>
                    <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                      <h3 style={{ margin: '0 0 20px 0', color: '#2c3e50' }}>Orders by Status</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {analytics?.ordersByStatus && Object.entries(analytics.ordersByStatus).map(([status, count]) => (
                          <div key={status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ textTransform: 'capitalize', fontWeight: 'bold', color: '#2c3e50' }}>{status}</span>
                            <span style={{ background: '#ecf0f1', padding: '4px 12px', borderRadius: '20px', fontWeight: 'bold', color: '#2c3e50' }}>{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                      <h3 style={{ margin: '0 0 20px 0', color: '#2c3e50' }}>Enquiries Status</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {analytics?.enquiriesByStatus && Object.entries(analytics.enquiriesByStatus).map(([status, count]) => (
                          <div key={status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ textTransform: 'capitalize', fontWeight: 'bold', color: '#2c3e50' }}>{status}</span>
                            <span style={{ background: '#ecf0f1', padding: '4px 12px', borderRadius: '20px', fontWeight: 'bold', color: '#2c3e50' }}>{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Revenue */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '30px' }}>
                    <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                      <h3 style={{ margin: '0 0 20px 0', color: '#2c3e50' }}>Revenue Overview</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div>
                          <p style={{ margin: '0 0 5px 0', color: '#999', fontSize: '12px' }}>Total Revenue</p>
                          <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#2c3e50' }}>₹{(analytics?.totalRevenue || 0).toLocaleString()}</p>
                        </div>
                        <div>
                          <p style={{ margin: '0 0 5px 0', color: '#999', fontSize: '12px' }}>Completed Orders</p>
                          <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#27ae60' }}>₹{(analytics?.totalRevenueCompleted || 0).toLocaleString()}</p>
                        </div>
                        <div>
                          <p style={{ margin: '0 0 5px 0', color: '#999', fontSize: '12px' }}>Pending Orders</p>
                          <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#f39c12' }}>₹{(analytics?.totalRevenuePending || 0).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>

                    <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                      <h3 style={{ margin: '0 0 20px 0', color: '#2c3e50' }}>Orders Trend (Last 7 days)</h3>
                      <div style={{ height: '200px', background: '#f9f9f9', borderRadius: '4px', display: 'flex', alignItems: 'flex-end', gap: '5px', padding: '10px', justifyContent: 'space-around' }}>
                        {analytics?.ordersTrend && analytics.ordersTrend.map((d, i) => {
                          const maxCount = Math.max(...analytics.ordersTrend.map(t => t.count || 0)) || 1;
                          return (
                            <div key={i} style={{
                              flex: 1,
                              height: ((d.count || 0) / maxCount) * 100 + '%',
                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              borderRadius: '4px 4px 0 0',
                              minHeight: '10px'
                            }} title={`${d.count} orders`} />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
{/*
              
              {activeTab === 'products' && (
                <div>
                  <h2 style={{ margin: '0 0 30px 0', color: '#2c3e50' }}>Products Management</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '30px' }}>
                    <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                      <h3 style={{ margin: '0 0 20px 0', color: '#2c3e50' }}>Add New Product</h3>
                      <form onSubmit={handleAddProduct} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <input
                          type="text"
                          placeholder="Product Name"
                          value={newProduct.name}
                          onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                          required
                          style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }}
                        />
                        <input
                          type="text"
                          placeholder="Category"
                          value={newProduct.category}
                          onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                          style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }}
                        />
                        <textarea
                          placeholder="Description"
                          value={newProduct.desc}
                          onChange={(e) => setNewProduct({...newProduct, desc: e.target.value})}
                          rows="5"
                          style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', fontFamily: 'Arial' }}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <input
                            type="number"
                            placeholder="Price"
                            value={newProduct.price}
                            onChange={(e) => setNewProduct({...newProduct, price: parseFloat(e.target.value)})}
                            required
                            style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }}
                          />
                          <input
                            type="number"
                            placeholder="Stock"
                            value={newProduct.stock}
                            onChange={(e) => setNewProduct({...newProduct, stock: parseInt(e.target.value)})}
                            required
                            style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }}
                          />
                        </div>
                        <button type="submit" style={{
                          padding: '10px',
                          background: '#27ae60',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}>Add Product</button>
                      </form>
                    </div>
                    <div style={{ background: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                      <h3 style={{ margin: '0 0 20px 0', color: '#2c3e50' }}>All Products ({products.length})</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px', maxHeight: '500px', overflowY: 'auto' }}>
                        {products.map(p => (
                          <div key={p.id} style={{
                            background: '#f9f9f9',
                            padding: '15px',
                            borderRadius: '4px',
                            borderLeft: '3px solid #667eea'
                          }}>
                            <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', fontSize: '13px', color: '#2c3e50' }}>{p.name}</p>
                            <p style={{ margin: '0 0 8px 0', color: '#666', fontSize: '12px' }}>{p.category}</p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                              <span style={{ fontWeight: 'bold', color: '#667eea' }}>₹{p.price}</span>
                              <span style={{ background: p.stock > 0 ? '#27ae60' : '#e74c3c', color: 'white', padding: '2px 6px', borderRadius: '2px' }}>
                                {p.stock}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
*/}
              {/* Enquiries Tab */}
              {activeTab === 'enquiries' && (
                <div>
                  <h2 style={{ margin: '0 0 30px 0', color: '#2c3e50' }}>Customer Enquiries ({enquiries.length})</h2>
                  
                  {selectedEnquiry && (
                    <div style={{
                      background: 'white',
                      padding: '25px',
                      borderRadius: '8px',
                      marginBottom: '30px',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
                    }}>
                      <h3 style={{ margin: '0 0 20px 0', color: '#2c3e50' }}>Reply to Enquiry</h3>
                      <p><strong>From:</strong> {selectedEnquiry.name} ({selectedEnquiry.email}, {selectedEnquiry.phone})</p>
                      <p><strong>Original Message:</strong></p>
                      <p style={{ background: '#f5f5f5', padding: '15px', borderRadius: '4px', marginBottom: '20px' }}>{selectedEnquiry.message}</p>
                      
                      {selectedEnquiry.replies && selectedEnquiry.replies.length > 0 && (
                        <div style={{ marginBottom: '20px' }}>
                          <h4 style={{ color: '#2c3e50', marginBottom: '10px' }}>Previous Replies:</h4>
                          {selectedEnquiry.replies.map((r, i) => (
                            <div key={i} style={{ background: '#ecf0f1', padding: '12px', borderRadius: '4px', marginBottom: '10px' }}>
                              <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', fontSize: '12px' }}>{r.repliedBy} - {new Date(r.repliedAt).toLocaleString()}</p>
                              <p style={{ margin: 0 }}>{r.message}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Your Reply:</label>
                      <textarea
                        value={enquiryReply}
                        onChange={(e) => setEnquiryReply(e.target.value)}
                        placeholder="Type your reply here..."
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          minHeight: '120px',
                          fontFamily: 'Arial',
                          fontSize: '13px',
                          boxSizing: 'border-box',
                          marginBottom: '15px'
                        }}
                      />
                      
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          onClick={handleReplyToEnquiry}
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
                          ✓ Send Reply
                        </button>
                        <button
                          onClick={() => setSelectedEnquiry(null)}
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
                      </div>
                    </div>
                  )}
                  
                  <div style={{ display: 'grid', gap: '15px' }}>
                    {enquiries.map(e => (
                      <div key={e.id} style={{
                        background: 'white',
                        padding: '20px',
                        borderRadius: '8px',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                        borderLeft: '4px solid #f39c12'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'start' }}>
                          <div style={{ flex: 1 }}>
                            <h4 style={{ margin: 0, color: '#2c3e50' }}>{e.name}</h4>
                            <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '13px' }}>{e.email} | {e.phone}</p>
                          </div>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <span style={{
                              background: e.status === 'new' ? '#e74c3c' : e.status === 'repliedok' ? '#3498db' : '#27ae60',
                              color: 'white',
                              padding: '4px 10px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 'bold'
                            }}>{e.status}</span>
                            {e.status !== 'resolved' && (
                              <button
                                onClick={() => setSelectedEnquiry(e)}
                                style={{
                                  padding: '4px 12px',
                                  background: '#3498db',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '12px'
                                }}
                              >
                                Reply
                              </button>
                            )}
                          </div>
                        </div>
                        <p style={{ margin: 0, color: '#333', fontSize: '13px', lineHeight: '1.5' }}>{e.message}</p>
                        <p style={{ margin: '10px 0 0 0', color: '#999', fontSize: '12px' }}>Created: {new Date(e.createdAt).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Orders Tab */}
              {activeTab === 'orders' && (
                <div>
                  <h2 style={{ margin: '0 0 30px 0', color: '#2c3e50' }}>Orders ({orders.length})</h2>
                  
                  {selectedOrder && (
                    <div style={{
                      background: 'white',
                      padding: '25px',
                      borderRadius: '8px',
                      marginBottom: '30px',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
                    }}>
                      <h3 style={{ margin: '0 0 20px 0', color: '#2c3e50' }}>Order #{selectedOrder.id.slice(0, 8)}</h3>
                      <p><strong>Customer:</strong> {selectedOrder.customerName}</p>
                      <p><strong>Amount:</strong> ₹{selectedOrder.totalAmount}</p>
                      <p><strong>Current Status:</strong> <span style={{ background: '#3498db', color: 'white', padding: '4px 10px', borderRadius: '4px' }}>{selectedOrder.status}</span></p>
                      
                      <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Update Status:</label>
                          <select
                            value={orderStatusUpdate.status}
                            onChange={(e) => setOrderStatusUpdate({ ...orderStatusUpdate, status: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '10px',
                              border: '1px solid #ddd',
                              borderRadius: '4px'
                            }}
                          >
                            <option value="">-- Select Status --</option>
                            <option value="pending">Pending</option>
                            <option value="accepted">Accepted</option>
                            <option value="processingok">Processing</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Notes:</label>
                          <input
                            type="text"
                            placeholder="Add notes..."
                            value={orderStatusUpdate.notes}
                            onChange={(e) => setOrderStatusUpdate({ ...orderStatusUpdate, notes: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '10px',
                              border: '1px solid #ddd',
                              borderRadius: '4px'
                            }}
                          />
                        </div>
                      </div>
                      
                      <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                        <button
                          onClick={handleUpdateOrderStatus}
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
                          ✓ Update Status
                        </button>
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
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <div style={{ background: 'white', borderRadius: '8px', overflowX: 'auto', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                          <th style={{ padding: '15px', textAlign: 'left', fontWeight: 'bold' }}>Order ID</th>
                          <th style={{ padding: '15px', textAlign: 'left', fontWeight: 'bold' }}>Customer</th>
                          <th style={{ padding: '15px', textAlign: 'left', fontWeight: 'bold' }}>Status</th>
                          <th style={{ padding: '15px', textAlign: 'left', fontWeight: 'bold' }}>Amount</th>
                          <th style={{ padding: '15px', textAlign: 'left', fontWeight: 'bold' }}>Date</th>
                          <th style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map(o => (
                          <tr key={o.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '15px' }}>{o.id.slice(0, 8)}</td>
                            <td style={{ padding: '15px' }}>{o.customerName}</td>
                            <td style={{ padding: '15px' }}>
                              <span style={{
                                background: o.status === 'pending' ? '#f39c12' : o.status === 'accepted' ? '#3498db' : o.status === 'processing' ? '#9b59b6' : o.status === 'shipped' ? '#16a085' : o.status === 'delivered' ? '#27ae60' : '#e74c3c',
                                color: 'white',
                                padding: '4px 10px',
                                borderRadius: '4px',
                                fontSize: '12px'
                              }}>{o.status}</span>
                            </td>
                            <td style={{ padding: '15px', fontWeight: 'bold' }}>₹{(o.totalAmount || 0).toLocaleString()}</td>
                            <td style={{ padding: '15px', color: '#666' }}>{new Date(o.createdAt).toLocaleDateString()}</td>
                            <td style={{ padding: '15px', textAlign: 'center' }}>
                              <button
                                onClick={() => {
                                  setSelectedOrder(o);
                                  setOrderStatusUpdate({ status: o.status, notes: '' });
                                }}
                                style={{
                                  padding: '6px 12px',
                                  background: '#3498db',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '12px'
                                }}
                              >
                                Manage
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Employees Tab */}
              {activeTab === 'employees' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                    <h2 style={{ margin: 0, color: '#2c3e50' }}>Employees ({employees.length})</h2>
                    <button
                      onClick={() => setShowAddEmployee(!showAddEmployee)}
                      style={{
                        padding: '10px 20px',
                        background: showAddEmployee ? '#e74c3c' : '#27ae60',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      {showAddEmployee ? '✕ Cancel' : '➕ Add Employee'}
                    </button>
                  </div>

                  {showAddEmployee && (
                    <div style={{
                      background: 'white',
                      padding: '25px',
                      borderRadius: '8px',
                      marginBottom: '30px',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
                    }}>
                      <h3 style={{ margin: '0 0 20px 0', color: '#2c3e50' }}>Add New Employee</h3>
                      
                      {/* Personal Information Section */}
                      <div style={{ marginBottom: '25px', paddingBottom: '20px', borderBottom: '2px solid #e8e8e8' }}>
                        <h4 style={{ margin: '0 0 15px 0', color: '#667eea', fontSize: '14px', fontWeight: 'bold' }}>👤 Personal Information</h4>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                          gap: '20px'
                        }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#2c3e50' }}>Full Name *</label>
                            <input
                              type="text"
                              placeholder="Employee name"
                              value={newEmployee.name}
                              onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                              style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '13px',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#2c3e50' }}>Email *</label>
                            <input
                              type="email"
                              placeholder="email@example.com"
                              value={newEmployee.email}
                              onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                              style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '13px',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#2c3e50' }}>Phone *</label>
                            <input
                              type="tel"
                              placeholder="10-digit phone"
                              maxLength="10"
                              value={newEmployee.phone}
                              onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value.replace(/\D/g, '') })}
                              style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '13px',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#2c3e50' }}>Date of Birth</label>
                            <input
                              type="date"
                              value={newEmployee.dateOfBirth}
                              onChange={(e) => setNewEmployee({ ...newEmployee, dateOfBirth: e.target.value })}
                              style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '13px',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#2c3e50' }}>Gender</label>
                            <select
                              value={newEmployee.gender}
                              onChange={(e) => setNewEmployee({ ...newEmployee, gender: e.target.value })}
                              style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '13px',
                                boxSizing: 'border-box'
                              }}
                            >
                              <option value="">-- Select --</option>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Address Information Section */}
                      <div style={{ marginBottom: '25px', paddingBottom: '20px', borderBottom: '2px solid #e8e8e8' }}>
                        <h4 style={{ margin: '0 0 15px 0', color: '#667eea', fontSize: '14px', fontWeight: 'bold' }}>📍 Address Details</h4>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                          gap: '20px'
                        }}>
                          <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#2c3e50' }}>Address</label>
                            <input
                              type="text"
                              placeholder="Street address"
                              value={newEmployee.address}
                              onChange={(e) => setNewEmployee({ ...newEmployee, address: e.target.value })}
                              style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '13px',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#2c3e50' }}>City</label>
                            <input
                              type="text"
                              placeholder="City"
                              value={newEmployee.city}
                              onChange={(e) => setNewEmployee({ ...newEmployee, city: e.target.value })}
                              style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '13px',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#2c3e50' }}>State</label>
                            <input
                              type="text"
                              placeholder="State"
                              value={newEmployee.state}
                              onChange={(e) => setNewEmployee({ ...newEmployee, state: e.target.value })}
                              style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '13px',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#2c3e50' }}>Pincode</label>
                            <input
                              type="text"
                              placeholder="6-digit pincode"
                              maxLength="6"
                              value={newEmployee.pincode}
                              onChange={(e) => setNewEmployee({ ...newEmployee, pincode: e.target.value.replace(/\D/g, '') })}
                              style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '13px',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Professional Details Section */}
                      <div style={{ marginBottom: '25px', paddingBottom: '20px', borderBottom: '2px solid #e8e8e8' }}>
                        <h4 style={{ margin: '0 0 15px 0', color: '#667eea', fontSize: '14px', fontWeight: 'bold' }}>💼 Professional Details</h4>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                          gap: '20px'
                        }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#2c3e50' }}>Role</label>
                            <select
                              value={newEmployee.role}
                              onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })}
                              style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '13px',
                                boxSizing: 'border-box'
                              }}
                            >
                              <option value="employee">Employee</option>
                              <option value="Supervisor">Supervisor</option>
                              <option value="Manager">Manager</option>
                              <option value="Driver">Driver</option>
                              <option value="Engineer">Engineer</option>
                              <option value="Technician">Technician</option>
                              <option value="Accountant">Accountant</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#2c3e50' }}>Department</label>
                            <input
                              type="text"
                              placeholder="e.g., Production, Sales"
                              value={newEmployee.department}
                              onChange={(e) => setNewEmployee({ ...newEmployee, department: e.target.value })}
                              style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '13px',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#2c3e50' }}>Designation</label>
                            <input
                              type="text"
                              placeholder="e.g., Senior Manager"
                              value={newEmployee.designation}
                              onChange={(e) => setNewEmployee({ ...newEmployee, designation: e.target.value })}
                              style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '13px',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#2c3e50' }}>Join Date</label>
                            <input
                              type="date"
                              value={newEmployee.joinDate}
                              onChange={(e) => setNewEmployee({ ...newEmployee, joinDate: e.target.value })}
                              style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '13px',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#2c3e50' }}>Base Salary (₹)</label>
                            <input
                              type="number"
                              placeholder="0"
                              min="0"
                              value={newEmployee.baseSalary}
                              onChange={(e) => setNewEmployee({ ...newEmployee, baseSalary: parseInt(e.target.value) || 0 })}
                              style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '13px',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Identity Documents Section */}
                      <div style={{ marginBottom: '25px', paddingBottom: '20px', borderBottom: '2px solid #e8e8e8' }}>
                        <h4 style={{ margin: '0 0 15px 0', color: '#667eea', fontSize: '14px', fontWeight: 'bold' }}>🆔 Identity Documents</h4>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                          gap: '20px'
                        }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#2c3e50' }}>Aadhaar Number</label>
                            <input
                              type="text"
                              placeholder="12-digit Aadhaar"
                              maxLength="12"
                              value={newEmployee.aadharNumber}
                              onChange={(e) => setNewEmployee({ ...newEmployee, aadharNumber: e.target.value.replace(/\D/g, '') })}
                              style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '13px',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#2c3e50' }}>PAN Number</label>
                            <input
                              type="text"
                              placeholder="e.g., ABCDE1234F"
                              maxLength="10"
                              value={newEmployee.panNumber}
                              onChange={(e) => setNewEmployee({ ...newEmployee, panNumber: e.target.value.toUpperCase() })}
                              style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '13px',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Bank Details Section */}
                      <div style={{ marginBottom: '25px', paddingBottom: '20px', borderBottom: '2px solid #e8e8e8' }}>
                        <h4 style={{ margin: '0 0 15px 0', color: '#667eea', fontSize: '14px', fontWeight: 'bold' }}>🏦 Bank Details</h4>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                          gap: '20px'
                        }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#2c3e50' }}>Bank Name</label>
                            <input
                              type="text"
                              placeholder="e.g., HDFC Bank"
                              value={newEmployee.bankName}
                              onChange={(e) => setNewEmployee({ ...newEmployee, bankName: e.target.value })}
                              style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '13px',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#2c3e50' }}>Account Number</label>
                            <input
                              type="text"
                              placeholder="Account number"
                              value={newEmployee.bankAccountNumber}
                              onChange={(e) => setNewEmployee({ ...newEmployee, bankAccountNumber: e.target.value })}
                              style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '13px',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#2c3e50' }}>IFSC Code</label>
                            <input
                              type="text"
                              placeholder="e.g., HDFC0000001"
                              maxLength="11"
                              value={newEmployee.ifscCode}
                              onChange={(e) => setNewEmployee({ ...newEmployee, ifscCode: e.target.value.toUpperCase() })}
                              style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '13px',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#2c3e50' }}>Account Holder Name</label>
                            <input
                              type="text"
                              placeholder="Account holder name"
                              value={newEmployee.accountHolderName}
                              onChange={(e) => setNewEmployee({ ...newEmployee, accountHolderName: e.target.value })}
                              style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '13px',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Emergency Contact Section */}
                      <div style={{ marginBottom: '25px' }}>
                        <h4 style={{ margin: '0 0 15px 0', color: '#667eea', fontSize: '14px', fontWeight: 'bold' }}>📞 Emergency Contact</h4>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                          gap: '20px'
                        }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#2c3e50' }}>Contact Name</label>
                            <input
                              type="text"
                              placeholder="Contact person name"
                              value={newEmployee.emergencyContactName}
                              onChange={(e) => setNewEmployee({ ...newEmployee, emergencyContactName: e.target.value })}
                              style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '13px',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#2c3e50' }}>Phone Number</label>
                            <input
                              type="tel"
                              placeholder="10-digit phone"
                              maxLength="10"
                              value={newEmployee.emergencyContactPhone}
                              onChange={(e) => setNewEmployee({ ...newEmployee, emergencyContactPhone: e.target.value.replace(/\D/g, '') })}
                              style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '13px',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#2c3e50' }}>Relation</label>
                            <select
                              value={newEmployee.emergencyContactRelation}
                              onChange={(e) => setNewEmployee({ ...newEmployee, emergencyContactRelation: e.target.value })}
                              style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '13px',
                                boxSizing: 'border-box'
                              }}
                            >
                              <option value="">-- Select Relation --</option>
                              <option value="Spouse">Spouse</option>
                              <option value="Parent">Parent</option>
                              <option value="Child">Child</option>
                              <option value="Sibling">Sibling</option>
                              <option value="Friend">Friend</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={handleAddEmployee}
                        style={{
                          padding: '12px 24px',
                          background: 'linear-gradient(135deg, #27ae60 0%, #229954 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          fontSize: '14px'
                        }}
                      >
                        ✅ Add Employee
                      </button>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                    {employees.map(emp => (
                      <div key={emp.id} style={{
                        background: 'white',
                        padding: '20px',
                        borderRadius: '8px',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                        textAlign: 'center',
                        transition: 'transform 0.3s, boxShadow 0.3s',
                        cursor: 'pointer'
                      }} onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-5px)';
                        e.currentTarget.style.boxShadow = '0 5px 20px rgba(0,0,0,0.1)';
                      }} onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.05)';
                      }}>
                        <div style={{ fontSize: '40px', marginBottom: '10px' }}>👤</div>
                        <h4 style={{ margin: '0 0 5px 0', color: '#2c3e50' }}>{emp.name}</h4>
                        <p style={{ margin: '0 0 8px 0', color: '#27ae60', fontSize: '13px', fontWeight: 'bold' }}>{emp.role}</p>
                        <p style={{ margin: '0 0 3px 0', color: '#999', fontSize: '12px' }}>📧 {emp.email}</p>
                        {emp.phone && <p style={{ margin: '0 0 3px 0', color: '#999', fontSize: '12px' }}>📱 {emp.phone}</p>}
                        {emp.department && <p style={{ margin: '0 0 10px 0', color: '#999', fontSize: '12px' }}>🏢 {emp.department}</p>}
                        <button
                          onClick={() => handleDeleteEmployee(emp.id)}
                          style={{
                            padding: '8px 12px',
                            background: '#e74c3c',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            marginTop: '10px',
                            width: '100%'
                          }}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Settings Tab */}
              {activeTab === 'settings' && (
                <div>
                  {/* profile update card */}
                  <div style={{
                    background: 'white',
                    padding: '25px',
                    borderRadius: '8px',
                    marginBottom: '30px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
                  }}>
                    <h2 style={{ margin: '0 0 20px 0', color: '#2c3e50' }}>🔐 Update Your Account</h2>
                    <div style={{ marginBottom: '15px' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#2c3e50' }}>Username</label>
                      <input
                        type="text"
                        value={editUsername}
                        onChange={e => setEditUsername(e.target.value)}
                        style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
                      />
                    </div>
                    <div style={{ marginBottom: '15px' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#2c3e50' }}>New Password</label>
                      <input
                        type="password"
                        value={editPassword}
                        onChange={e => setEditPassword(e.target.value)}
                        placeholder="Leave blank to keep unchanged"
                        style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
                      />
                    </div>
                    <button
                      onClick={handleUpdateProfile}
                      style={{
                        padding: '10px 20px',
                        background: '#667eea',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Save Credentials
                    </button>
                  </div>

                  <h2 style={{ margin: '0 0 30px 0', color: '#2c3e50' }}>🎨 Company Settings & Images</h2>
                  {/* Company info section including location */}
                  <div style={{
                    background: 'white',
                    padding: '25px',
                    borderRadius: '8px',
                    marginBottom: '30px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
                  }}>
                    <h3 style={{ margin: '0 0 15px 0', color: '#2c3e50' }}>🏢 Company Info</h3>
                    <div style={{ marginBottom: '15px' }}>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Address</label>
                      <input
                        type="text"
                        value={companyLocation.address}
                        onChange={e => setCompanyLocation({ ...companyLocation, address: e.target.value })}
                        style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                      />
                    </div>
                    <LocationPicker
                      label="Select on Map"
                      value={companyLocation}
                      onChange={setCompanyLocation}
                    />
                    <button
                      onClick={handleSaveCompanyInfo}
                      style={{
                        padding: '10px 20px',
                        background: '#3498db',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        marginTop: '10px'
                      }}
                    >
                      Save Company Info
                    </button>
                  </div>
                  
                  {/* Hero Background Image */}
                  <div style={{
                    background: 'white',
                    padding: '25px',
                    borderRadius: '8px',
                    marginBottom: '30px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
                  }}>
                    <h3 style={{ margin: '0 0 15px 0', color: '#2c3e50' }}>🏠 Hero Background Image</h3>
                    <p style={{ margin: '0 0 15px 0', color: '#666', fontSize: '13px' }}>Recommended size: 1920 x 600px (PNG/JPG)</p>
                    
                    {/* Current Image */}
                    {company?.heroImage && (
                      <div style={{ marginBottom: '20px' }}>
                        <p style={{ margin: '0 0 8px 0', color: '#2c3e50', fontWeight: 'bold', fontSize: '12px' }}>📸 Currently Saved:</p>
                        <img src={company.heroImage} alt="Current Hero" style={{ maxWidth: '100%', height: '150px', objectFit: 'cover', borderRadius: '4px', border: '2px solid #27ae60' }} />
                      </div>
                    )}
                    
                    <p style={{ margin: '0 0 10px 0', color: '#2c3e50', fontWeight: 'bold', fontSize: '12px' }}>📁 Upload New Image:</p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            setCompanySettings({ ...companySettings, heroImage: event.target.result });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      style={{
                        padding: '10px',
                        border: '2px solid #ddd',
                        borderRadius: '4px',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                    />
                    {companySettings.heroImage && (
                      <div style={{ marginTop: '15px' }}>
                        <p style={{ margin: '0 0 8px 0', color: '#2c3e50', fontWeight: 'bold', fontSize: '12px' }}>✨ Preview of New Image:</p>
                        <img src={companySettings.heroImage} alt="Hero Preview" style={{ maxWidth: '100%', height: '200px', objectFit: 'cover', borderRadius: '4px', border: '2px solid #f39c12' }} />
                      </div>
                    )}
                  </div>

                  {/* Why Choose Us Background */}
                  <div style={{
                    background: 'white',
                    padding: '25px',
                    borderRadius: '8px',
                    marginBottom: '30px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
                  }}>
                    <h3 style={{ margin: '0 0 15px 0', color: '#2c3e50' }}>🏞️ Why Choose Us? Section Background</h3>
                    <p style={{ margin: '0 0 15px 0', color: '#666', fontSize: '13px' }}>Recommended size: 1920 x 600px (PNG/JPG) - This image will be displayed as the background of the "Why Choose Us?" section</p>
                    
                    {/* Current Image */}
                    {company?.whyChooseUsBackground && (
                      <div style={{ marginBottom: '20px' }}>
                        <p style={{ margin: '0 0 8px 0', color: '#2c3e50', fontWeight: 'bold', fontSize: '12px' }}>📸 Currently Saved:</p>
                        <img src={company.whyChooseUsBackground} alt="Why Choose Us Background" style={{ maxWidth: '100%', height: '150px', objectFit: 'cover', borderRadius: '4px', border: '2px solid #27ae60' }} />
                      </div>
                    )}
                    
                    <p style={{ margin: '0 0 10px 0', color: '#2c3e50', fontWeight: 'bold', fontSize: '12px' }}>📁 Upload New Image:</p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            setCompanySettings({ ...companySettings, whyChooseUsBackground: event.target.result });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      style={{
                        padding: '10px',
                        border: '2px solid #ddd',
                        borderRadius: '4px',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                    />
                    {companySettings.whyChooseUsBackground && (
                      <div style={{ marginTop: '15px' }}>
                        <p style={{ margin: '0 0 8px 0', color: '#2c3e50', fontWeight: 'bold', fontSize: '12px' }}>✨ Preview of New Image:</p>
                        <img src={companySettings.whyChooseUsBackground} alt="Why Choose Us Background Preview" style={{ maxWidth: '100%', height: '200px', objectFit: 'cover', borderRadius: '4px', border: '2px solid #f39c12' }} />
                      </div>
                    )}
                  </div>

                  {/* Why Choose Us Icons */}
                  <div style={{
                    background: 'white',
                    padding: '25px',
                    borderRadius: '8px',
                    marginBottom: '30px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
                  }}>
                    <h3 style={{ margin: '0 0 15px 0', color: '#2c3e50' }}>🎯 Why Choose Us Icons</h3>
                    <p style={{ margin: '0 0 15px 0', color: '#666', fontSize: '13px' }}>Recommended size: 150 x 150px (PNG)</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                      {[
                        { key: 'ecoFriendlyIcon', label: '♻️ Eco-Friendly Icon' },
                        { key: 'strengthIcon', label: '💪 High Strength Icon' },
                        { key: 'energyIcon', label: '⚡ Energy Efficient Icon' },
                        { key: 'deliveryIcon', label: '🚚 Fast Delivery Icon' }
                      ].map((item) => (
                        <div key={item.key} style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '4px' }}>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#2c3e50' }}>{item.label}</label>
                          
                          {/* Current Image */}
                          {company?.[item.key] && (
                            <div style={{ marginBottom: '10px', textAlign: 'center', padding: '10px', background: '#f0f9ff', borderRadius: '4px', border: '1px solid #27ae60' }}>
                              <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#2c3e50', fontWeight: 'bold' }}>📸 Current:</p>
                              <img src={company[item.key]} alt={item.label} style={{ maxHeight: '70px', maxWidth: '100%', objectFit: 'contain' }} />
                            </div>
                          )}
                          
                          {/* File Input */}
                          <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#2c3e50', fontWeight: 'bold' }}>📁 Upload New:</p>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  setCompanySettings({ ...companySettings, [item.key]: event.target.result });
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            style={{
                              padding: '10px',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              width: '100%',
                              boxSizing: 'border-box',
                              fontSize: '12px'
                            }}
                          />
                          
                          {/* Preview */}
                          {companySettings[item.key] && (
                            <div style={{ marginTop: '10px', textAlign: 'center', padding: '10px', background: '#fffaf0', borderRadius: '4px', border: '1px solid #f39c12' }}>
                              <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#2c3e50', fontWeight: 'bold' }}>✨ Preview:</p>
                              <img src={companySettings[item.key]} alt={item.label} style={{ maxHeight: '70px', maxWidth: '100%', objectFit: 'contain' }} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Team Member Photos */}
                  <div style={{
                    background: 'white',
                    padding: '25px',
                    borderRadius: '8px',
                    marginBottom: '30px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
                  }}>
                    <h3 style={{ margin: '0 0 15px 0', color: '#2c3e50' }}>👥 Team Member Photos</h3>
                    <p style={{ margin: '0 0 15px 0', color: '#666', fontSize: '13px' }}>Recommended size: 300 x 300px (PNG/JPG)</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                      {[
                        { key: 'teamMember1Image', label: '👨‍💼 Team Member 1 (Sathish Kumar)' },
                        { key: 'teamMember2Image', label: '👩‍💼 Team Member 2 (Jegan)' },
                        { key: 'teamMember3Image', label: '👨‍🔧 Team Member 3 (YYY-YYY)' },
                        { key: 'teamMember4Image', label: '👩‍💻 Team Member 4 (Gokul)' }
                      ].map((item) => (
                        <div key={item.key} style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '4px' }}>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#2c3e50' }}>{item.label}</label>
                          
                          {/* Current Image */}
                          {company?.[item.key] && (
                            <div style={{ marginBottom: '10px', textAlign: 'center', padding: '10px', background: '#f0f9ff', borderRadius: '4px', border: '1px solid #27ae60' }}>
                              <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#2c3e50', fontWeight: 'bold' }}>📸 Current:</p>
                              <img src={company[item.key]} alt={item.label} style={{ maxHeight: '100px', maxWidth: '100%', objectFit: 'cover', borderRadius: '4px' }} />
                            </div>
                          )}
                          
                          {/* File Input */}
                          <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#2c3e50', fontWeight: 'bold' }}>📁 Upload New:</p>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  setCompanySettings({ ...companySettings, [item.key]: event.target.result });
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            style={{
                              padding: '10px',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              width: '100%',
                              boxSizing: 'border-box',
                              fontSize: '12px'
                            }}
                          />
                          
                          {/* Preview */}
                          {companySettings[item.key] && (
                            <div style={{ marginTop: '10px', textAlign: 'center', padding: '10px', background: '#fffaf0', borderRadius: '4px', border: '1px solid #f39c12' }}>
                              <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#2c3e50', fontWeight: 'bold' }}>✨ Preview:</p>
                              <img src={companySettings[item.key]} alt={item.label} style={{ maxHeight: '120px', maxWidth: '100%', objectFit: 'cover', borderRadius: '4px' }} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleSaveCompanySettings}
                    style={{
                      padding: '12px 24px',
                      background: 'linear-gradient(135deg, #27ae60 0%, #229954 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      transition: 'opacity 0.3s'
                    }}
                    onMouseOver={(e) => e.target.style.opacity = '0.9'}
                    onMouseOut={(e) => e.target.style.opacity = '1'}
                  >
                    💾 Save All Settings
                  </button>
                  <p style={{ marginTop: '15px', color: '#27ae60', fontSize: '12px', fontWeight: 'bold' }}>✅ Image upload is now fully functional!</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
