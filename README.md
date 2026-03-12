# 🧱 KG Flyash Bricks - Complete Web Solution

## Project Overview

A comprehensive full-stack web application for KG Flyash Bricks Company featuring:
- Public-facing website with product display and chatbot
- Role-based admin/manager dashboard
- Order and enquiry management system
- Employee management (attendance, leave, salary)
- Delivery tracking system
- OTP-based authentication for public users

## Technology Stack

### Backend
- **Framework**: Express.js (Node.js)
- **Database**: lowdb (JSON-based)
- **Authentication**: JWT
- **Port**: 4000

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **HTTP Client**: Axios
- **Port**: 3000

## Project Structure

```
kgflyash-full/
├── server/
│   ├── server.js              # Main server file with all APIs
│   ├── db.json                # Database file
│   ├── utils.js               # Database utilities
│   └── package.json
│
├── client/
│   ├── src/
│   │   ├── App.jsx            # Main app component with routing logic
│   │   ├── api.js             # API service layer
│   │   ├── styles.css         # Global styles
│   │   ├── pages/
│   │   │   ├── Home.jsx       # Public homepage with products and chatbot
│   │   │   ├── LoginModal.jsx # Authentication modal (Admin/Public)
│   │   │   ├── AdminDashboard.jsx # Admin/Manager dashboard
│   │   │   ├── ProductModal.jsx   # Product details modal
│   │   │   └── Chatbot.jsx    # Chatbot component
│   │   ├── main.jsx
│   │   └── index.html
│   ├── package.json
│   └── vite.config.js
```

## Installation & Setup

### Prerequisites
- Node.js (v14+)
- npm or yarn

### Backend Setup

```bash
cd server
npm install
npm start
# Server will run on http://localhost:4000
```

### Frontend Setup

```bash
cd client
npm install
npm run dev
# Application will run on http://localhost:3000
```

## Default Credentials

### Admin Login
- **Username**: KGflyash.admin@admintiruppur
- **Password**: admin123
- **Role**: Full system access

### Manager Login
- **Username**: KGflyash.manager@admintiruppur
- **Password**: manager123
- **Role**: Stock & employee management

### Public User
- Register with mobile number and name
- Receive OTP for verification
- Access public user dashboard

## Features Implementation

### 1. Home Page (Public View)
✅ Company information display
✅ Product showcase with details
✅ News & updates section
✅ Certifications & approvals
✅ Contact information
✅ Integrated chatbot
✅ Professional responsive design

### 2. Product Management
✅ Display products with details
✅ Admin can add/edit/delete products
✅ Stock availability indicator
✅ Product features listing
✅ Search & filter capabilities

### 3. Authentication System
✅ Admin/Manager login with JWT
✅ Public user registration with OTP
✅ OTP verification (console logs for demo)
✅ Token-based authorization
✅ Role-based access control

### 4. Admin Dashboard
✅ Overview with statistics
✅ Product management (CRUD)
✅ Enquiry tracking
✅ Order monitoring
✅ Employee management

### 5. Chatbot
✅ AI-powered responses based on keywords
✅ Contextual answers about products/company
✅ Real-time conversation
✅ Integration with API

### 6. Enquiry & Order System
✅ Customer enquiry submission
✅ Order creation
✅ Status tracking
✅ Admin/Manager review

### 7. Employee Management
✅ Employee creation by admin
✅ Attendance tracking
✅ Leave application system
✅ Salary management
✅ Employee dashboard (coming soon)

### 8. Delivery System
✅ Delivery assignment
✅ Driver tracking
✅ Route management
✅ Delivery status updates
✅ Driver portal (coming soon)

## API Endpoints

### Company & Products
- `GET /api/company` - Get company info
- `PUT /api/company` - Update company info
- `GET /api/products` - Get all products
- `POST /api/products` - Create product (Admin/Manager)
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product (Admin)

### Authentication
- `POST /api/auth/login` - Admin/Manager login
- `PUT /api/auth/admin/:id` - Update an admin/manager account (only self or admin role)
- `PUT /api/auth/profile` - Update your own profile (username/password)

## Logistics Map Enhancements

* Admin/manager can now pick pickup and drop locations on an interactive map
  when creating logistics orders. The coordinates and address are stored in the
  order record and sent to drivers. The map is rendered with Leaflet and Open-
  StreetMap tiles, so there is no dependency on proprietary APIs or keys.
* Driver dashboard displays a simple map route from current GPS position to the
  pickup (and later the drop) location along with approximate distance. The
  free Leaflet/OSM renderer works immediately after a user logs in; no API key
  configuration is needed.
- `POST /api/public/register` - Public user registration
- `POST /api/public/verify` - Verify OTP (registration)
- `POST /api/public/request-otp` - Request OTP (login)
- `POST /api/public/login-verify` - Verify OTP (login)

### Chatbot
- `POST /api/chatbot/query` - Send chatbot query

### Enquiries & Orders
- `POST /api/enquiry` - Create enquiry
- `GET /api/enquiries` - Get enquiries
- `PUT /api/enquiries/:id` - Update enquiry
- `POST /api/orders` - Create order
- `GET /api/orders` - Get orders
- `PUT /api/orders/:id` - Update order

### Employees
- `GET /api/employees` - Get all employees
- `POST /api/employees` - Create employee
- `DELETE /api/employees/:id` - Delete employee

### Attendance
- `POST /api/attendance` - Mark attendance
- `GET /api/attendance/:empId` - Get employee attendance

### Leaves
- `POST /api/leaves` - Apply for leave
- `GET /api/leaves` - Get all leaves
- `PUT /api/leaves/:id` - Approve/reject leave

### Salaries
- `POST /api/salaries` - Create salary entry
- `GET /api/salaries/:empId` - Get employee salaries
- `PUT /api/salaries/:id` - Update salary

### Deliveries
- `POST /api/deliveries` - Create delivery
- `GET /api/deliveries` - Get deliveries
- `PUT /api/deliveries/:id` - Update delivery status

## Usage Guide

### For Visitors/Public Users
1. Open http://localhost:3000
2. Browse products and company information
3. Use the chatbot for inquiries
4. Click "Login/Register" to create an account
5. Register with name, mobile, and email
6. Verify OTP
7. Submit product enquiries or orders

### For Admin/Manager
1. Open http://localhost:3000
2. Click "Login/Register"
3. Select "Admin/Manager Login"
4. Enter credentials
5. Access comprehensive dashboard
6. Manage products, enquiries, orders, employees

## Database Structure

The `db.json` file contains:

```json
{
  "company": {},           // Company information
  "products": [],          // Product catalog
  "news": [],              // News & updates
  "certificates": [],      // Certifications
  "users": [],            // Admin/Manager accounts
  "publicUsers": [],      // Customer accounts
  "employees": [],        // Employee records
  "enquiries": [],        // Customer enquiries
  "orders": [],           // Orders
  "attendance": [],       // Employee attendance
  "leaves": [],          // Leave requests
  "salaries": [],        // Salary information
  "deliveries": []       // Delivery tracking
}
```

## Features Roadmap

### Completed ✅
- Public homepage with all sections
- Product management system
- Role-based authentication
- Admin dashboard
- Chatbot integration
- Enquiry/Order management
- Employee basic management
- Delivery system structure

### In Progress 🔄
- Employee dashboard
- Driver portal
- Advanced search & filtering
- Email notifications
- SMS notifications

### Planned 📋
- Mobile app
- Payment gateway integration
- Advanced analytics
- Multi-language support
- Dark mode
- Advanced reporting

## Development Notes

### OTP System
For demonstration purposes, OTPs are logged to the console. In production:
1. Integrate with Twilio or similar SMS service
2. Send OTP via SMS to user's phone
3. Implement expiry time (usually 5-10 minutes)
4. Add rate limiting

### Security Notes
- Change `SECRET` in server.js for production
- Use environment variables for sensitive data
- Implement HTTPS in production
- Add request validation
- Implement CORS properly for production
- Add rate limiting

### Database
- Current system uses lowdb (file-based JSON)
- For production, migrate to:
  - MongoDB
  - PostgreSQL
  - MySQL

## Troubleshooting

### Port Already in Use
```bash
# Find process using port
netstat -ano | findstr :3000  # Windows
lsof -i :3000                 # Mac/Linux

# Kill process
taskkill /PID <PID> /F        # Windows
```

### CORS Issues
- Ensure both servers are running
- Check `Access-Control-Allow-Origin` in server.js
- Verify API URL in client/src/api.js

### Module Not Found
```bash
# In client directory
npm install

# In server directory
npm install
```

## Performance Tips

1. **Frontend**: Use React DevTools to check renders
2. **Backend**: Monitor response times
3. **Database**: Optimize queries in lowdb
4. **Caching**: Implement Redis for production
5. **CDN**: Use CDN for static assets in production

## Support & Contact

For issues, improvements, or questions:
- Check API response in browser console
- Review server console for errors
- Verify database structure in db.json

## License

This project is proprietary to KG Flyash Bricks Company.

## Version

**Current Version**: 1.0.0 (Full Feature Release)

---

**Created**: January 21, 2026
**Last Updated**: January 21, 2026
