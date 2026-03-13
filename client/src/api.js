import axios from 'axios';

// Build API URL dynamically to work on mobile networks
// Uses current hostname so that a phone on the same Wi‑Fi can reach the
// development server instead of trying to connect to localhost.
// If you run the server on a different port, update the `port` variable.
const getApiUrl = () => {
  const protocol = window.location.protocol; // http: or https:
  const hostname = window.location.hostname; // could be 192.168.x.x on mobile
  const port = 4000; // change if your API runs on another port
  if (hostname === 'localhost') {
    return `${protocol}//${hostname}:${port}/api`;
  } else {
    // Production backend URL
    return 'https://kg-flyash-bricks.onrender.com/api';
  }
};

// Build base URL dynamically to work on mobile networks
export const getBaseUrl = () => {
  // Temporarily hardcoded for debugging
  return 'http://localhost:4000';
};

const api = axios.create({
  baseURL: getApiUrl(),
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if(token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ============ ANALYTICS ============
export const getAnalyticsDashboard = () => api.get('/analytics/dashboard');

// ============ COMPANY ============
export const getCompany = () => api.get('/company');
export const updateCompany = (data) => api.put('/company', data);
export const uploadCompanyImages = (images) => api.post('/company/upload-images', { images });

// Generic image upload (returns { url, filename })
export const uploadImage = (imageBase64, filename) => api.post('/upload', { image: imageBase64, filename });

// ============ PRODUCTS ============
export const getProducts = (status = 'published') => api.get(`/products?status=${status}`);
export const getProduct = (id) => api.get(`/products/${id}`);
export const createProduct = (data) => api.post('/products', data);
export const updateProduct = (id, data) => api.put(`/products/${id}`, data);
export const deleteProduct = (id) => api.delete(`/products/${id}`);

// ============ NEWS ============
export const getNews = (status = 'published') => api.get(`/news?status=${status}`);
export const createNews = (data) => api.post('/news', data);
export const updateNews = (id, data) => api.put(`/news/${id}`, data);
export const deleteNews = (id) => api.delete(`/news/${id}`);

// ============ CERTIFICATES ============
export const getCertificates = (status = 'published') => api.get(`/certificates?status=${status}`);
export const createCertificate = (data) => api.post('/certificates', data);
export const updateCertificate = (id, data) => api.put(`/certificates/${id}`, data);
export const deleteCertificate = (id) => api.delete(`/certificates/${id}`);

// ============ AUTHENTICATION ============
export const loginAdmin = (username, password) => api.post('/auth/admin-login', { username, password });
export const registerPublic = (name, email, mobile, otpMethod = 'sms') => api.post('/auth/register', { name, email, mobile, otpMethod });
export const verifyOTP = (userId, otp) => api.post('/auth/verify-otp', { userId, otp });
export const requestOTP = (mobile, otpMethod = 'sms') => api.post('/auth/request-otp', { mobile, otpMethod });
export const loginVerifyOTP = (mobile, otp) => api.post('/auth/login-verify-otp', { mobile, otp });

// ============ ADMIN PROFILE ============
export const updateAdmin = (id, data) => api.put(`/auth/admin/${id}`, data);
export const updateMyProfile = (data) => api.put('/auth/profile', data);

// ============ CHATBOT ============
export const chatbotQuery = (message) => api.post('/chatbot', { message });

// ============ ENQUIRIES ============
export const createEnquiry = (data) => api.post('/enquiries', data);
export const getEnquiries = () => api.get('/enquiries');
export const getEnquiry = (id) => api.get(`/enquiries/${id}`);
export const updateEnquiry = (id, data) => api.put(`/enquiries/${id}`, data);
export const replyToEnquiry = (id, message) => api.post(`/enquiries/${id}/reply`, { message });
export const deleteEnquiry = (id) => api.delete(`/enquiries/${id}`);

// ============ ORDERS ============
export const createOrder = (data) => api.post('/orders', data);
export const getOrders = () => api.get('/orders');
export const getOrder = (id) => api.get(`/orders/${id}`);
export const getMyOrders = () => api.get('/orders/my');
export const updateOrder = (id, data) => api.put(`/orders/${id}`, data);
export const updateOrderStatus = (id, status, notes) => api.put(`/orders/${id}`, { status, notes });
export const deleteOrder = (id) => api.delete(`/orders/${id}`);

// ============ EMPLOYEES ============
export const getEmployees = () => api.get('/employees');
export const createEmployee = (data) => api.post('/employees', data);
export const deleteEmployee = (id) => api.delete(`/employees/${id}`);

// ============ ATTENDANCE ============
export const markAttendance = (data) => api.post('/attendance', data);
export const getAttendance = () => api.get('/attendance');

// ============ LEAVES ============
export const applyLeave = (data) => api.post('/leaves', data);
export const getLeaves = () => api.get('/leaves');
export const updateLeave = (id, data) => api.put(`/leaves/${id}`, data);

// ============ SALARIES ============
export const createSalary = (data) => api.post('/salaries', data);
export const getSalaries = () => api.get('/salaries');
export const updateSalary = (id, data) => api.put(`/salaries/${id}`, data);

// ============ DELIVERIES ============
export const createDelivery = (data) => api.post('/deliveries', data);
export const getDeliveries = () => api.get('/deliveries');
export const updateDelivery = (id, data) => api.put(`/deliveries/${id}`, data);

// ============ NOTIFICATIONS ============
export const getNotifications = () => api.get('/notifications');
export const getUnreadNotificationCount = () => api.get('/notifications/unread-count');
export const markNotificationAsRead = (id) => api.put(`/notifications/${id}/read`);
export const deleteNotification = (id) => api.delete(`/notifications/${id}`);

// ============ PAGE CONTENT MANAGEMENT ============
export const getPageContents = () => api.get('/page-contents');
export const getPageContent = (pageId) => api.get(`/page-contents/${pageId}`);
export const savePageContent = (data) => api.post('/page-contents', data);
export const publishPage = (pageId) => api.post(`/page-contents/${pageId}/publish`);

// ============ LOGISTICS SYSTEM ============

// Driver Authentication
export const driverLogin = (username, password) => api.post('/auth/driver-login', { username, password });

// Driver APIs
export const getDriverProfile = () => api.get('/driver/profile');
export const updateDriverProfile = (data) => api.put('/driver/profile', data);
export const getDriverOrders = () => api.get('/driver/orders');
export const updateDriverOrder = (id, data) => api.put(`/driver/orders/${id}`, data);
export const updateDriverLocation = (data) => api.post('/driver/location', data);

// Admin/Manager Logistics APIs
export const getDrivers = () => api.get('/drivers');
export const getDriverLocations = () => api.get('/drivers/location');
export const createDriver = (data) => api.post('/drivers', data);
export const updateDriver = (id, data) => api.put(`/drivers/${id}`, data);
export const deleteDriver = (id) => api.delete(`/drivers/${id}`);

export const getLogisticsOrders = () => api.get('/logistics/orders');
export const createLogisticsOrder = (data) => api.post('/logistics/orders', data);
export const updateLogisticsOrder = (id, data) => api.put(`/logistics/orders/${id}`, data);

export const getOrderUpdates = (orderId) => api.get(`/logistics/orders/${orderId}/updates`);
export const getDriverActivity = (driverId) => api.get(`/drivers/${driverId}/activity`);

export default api;
