# 🚀 Quick Start Guide - KG Flyash Bricks

## ⚡ Instant Setup (5 minutes)

### 1. Start Both Servers

**In Terminal 1 - Backend Server:**
```bash
cd server
npm start
# Output: KGFlyash server running on http://localhost:4000
```

**In Terminal 2 - Frontend Client:**
```bash
cd client
npm run dev
# Output: Local: http://localhost:3000/
```

### 2. Open Application
Visit: **http://localhost:3000**

---

## 🔐 Test Different Roles

### Option 1: Admin/Manager Dashboard
1. Click "Login/Register" button (top right)
2. Select "Admin/Manager Login"
3. Use credentials:
   - **Username**: `KGflyash.admin@admintiruppur`
   - **Password**: `admin123`
4. Access full admin dashboard with all features

### Option 2: Public User
1. Click "Login/Register" button
2. Select "Register as Public User"
3. Enter:
   - Name: Any name
   - Mobile: Any 10 digits (e.g., 9876543210)
   - Email: Optional
4. **Note**: OTP will be shown in server console
5. Copy the OTP and enter it
6. Now logged in as public user!

### Option 3: Browse as Visitor (No Login)
- Explore homepage
- View all products
- Chat with the bot
- View company info
- See contact details

---

## 📱 What You Can Do Right Now

### On Homepage
✅ View company information  
✅ Browse 4 products with details  
✅ Read news and updates  
✅ See certifications  
✅ Use integrated chatbot  
✅ View contact info  

**Try asking chatbot:**
- "What types of bricks do you have?"
- "Where is your company located?"
- "What are your contact details?"
- "Are you eco-friendly?"

### As Admin (after login)
✅ View dashboard overview with statistics  
✅ Add/edit/delete products  
✅ View all enquiries and orders  
✅ View employee list  
✅ Manage all system data  

### As Public User (after registration)
✅ View your profile info  
✅ Submit enquiries  
✅ Browse products and details  
✅ Use chatbot  

---

## 🗂️ Default Data in System

### Existing Products (4)
1. Solid Flyash Brick - 9 inch (₹5.50)
2. Hollow Flyash Brick - 9 inch (₹4.25)
3. Paver Block - 60mm (₹12.00)
4. Interlocking Brick (₹8.50)

### Company Information
- **Name**: KG Flyash Bricks
- **Address**: Tiruppur, Tamil Nadu
- **Phone**: +91-9876543210
- **Email**: sales@kgflyash.com
- **Hours**: Mon–Sat 8:00 AM – 6:00 PM

### Certifications
- MSME Certificate (Issued: 2023-01-15)
- ISO 9001:2015 (Issued: 2024-06-10)

---

## 🤖 Chatbot Features

The chatbot understands queries about:
- Types of products available
- Company location
- Contact information
- Working hours
- Pricing information
- Eco-friendly practices
- Quality assurance

**Note**: Keywords trigger responses. Try different variations!

---

## 🛠️ Admin Dashboard Features

### Overview Tab
- Total products count
- New enquiries count
- Pending orders count
- Total employees count

### Products Tab
- Add new product with name, description, price, stock
- View all products in table format
- Delete any product
- Real-time stock display

### Enquiries Tab
- View all customer enquiries
- See enquiry status (new/in progress/completed)
- View customer details and messages
- Track creation date and time

### Orders Tab
- View all orders
- See order status
- View items and delivery address
- Track order timestamps

### Employees Tab
- View all registered employees
- See employee role and contact info
- Manage employee list

---

## 📲 OTP System (Demo)

The system uses OTP for public user authentication:

1. **Registration**: User provides name, mobile, and email
   - OTP is generated
   - Displayed in server console (for demo)
   
2. **Login**: User provides mobile number
   - New OTP is generated
   - Check server console for OTP
   - Enter OTP to login

**In Production**: Replace with real SMS service (Twilio, AWS SNS, etc.)

---

## 🔗 API Endpoints Quick Reference

### Public
- `GET /api/company` - Company info
- `GET /api/products` - All products
- `GET /api/news` - News updates
- `POST /api/chatbot/query` - Chatbot

### Authentication
- `POST /api/auth/login` - Admin login
- `POST /api/public/register` - User registration
- `POST /api/public/verify` - Verify registration OTP
- `POST /api/public/request-otp` - Login OTP
- `POST /api/public/login-verify` - Verify login OTP

### Admin Only
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product
- `GET /api/enquiries` - View enquiries
- `GET /api/orders` - View orders
- `GET /api/employees` - View employees

---

## 🎨 User Interface Highlights

✨ **Modern Design**
- Clean, professional interface
- Responsive design (works on mobile)
- Smooth animations and transitions
- Color-coded elements

🎯 **Easy Navigation**
- Sticky top navigation
- Clear section separation
- Floating chatbot always available
- Quick action buttons

📊 **Admin Dashboard**
- Side-by-side navigation
- Statistics cards
- Table layouts for data
- Form inputs for management

---

## 💡 Pro Tips

1. **Test Different Scenarios**
   - Add multiple products
   - Create several enquiries
   - Try different chatbot queries

2. **Check Server Console**
   - New enquiries are logged
   - OTP codes appear here
   - System alerts shown here

3. **Browser DevTools**
   - Check Network tab for API calls
   - Console for any errors
   - Use device emulation for mobile testing

4. **Database**
   - All data stored in `server/db.json`
   - You can edit directly for testing
   - Changes reflect immediately

---

## ⚠️ Important Notes

### OTP Demo Mode
- OTPs are printed to console (not sent via SMS)
- Same OTP shown in response (for testing only)
- Production will use real SMS service

### Database
- Using file-based database (lowdb)
- All data persists in db.json
- Suitable for development/demo
- Production should use MongoDB/PostgreSQL

### Authentication
- JWT tokens valid for 7 days
- Stored in browser localStorage
- Automatically sent with API requests

---

## 🐛 Troubleshooting

### Can't Access http://localhost:3000
- Check if client server is running
- Look for "VITE v5.4.21 ready" message
- Port 3000 might be in use (change in vite.config.js)

### API Calls Failing
- Ensure backend server is running (http://localhost:4000)
- Check browser Network tab for errors
- Verify token in localStorage

### OTP Not Working
- Check server console for OTP code
- Copy exact OTP (6 digits)
- OTP expires on logout/page refresh

### Product Not Saving
- Check browser console for errors
- Verify you're logged in as admin
- Check server console for API errors

---

## 📚 Learn More

See `README.md` for:
- Complete feature list
- All API endpoints
- Project structure
- Database schema
- Development notes

---

## ✅ You're All Set!

Your complete KG Flyash Bricks website is ready to use! 🎉

**Key URLs:**
- 🌐 **Website**: http://localhost:3000
- ⚙️ **API Server**: http://localhost:4000
- 📊 **Database**: server/db.json

**Next Steps:**
- Add more products
- Create test enquiries
- Explore admin features
- Customize content
- Deploy to production

---

**Enjoy! 🚀**
