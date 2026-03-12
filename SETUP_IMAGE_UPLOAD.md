# Image Upload System Setup & Testing Guide

## 📋 Overview
The image upload system has been fully configured to allow admins to upload and manage:
- Hero background image
- "Why Choose Us" icons (4 icons)
- Team member photos (4 photos)

## ✅ What Has Been Implemented

### 1. **Backend Configuration** ✔️
- **File**: `server/server.js`
- **New Endpoint**: `POST /api/company/upload-images`
- **Features**:
  - Accepts base64 encoded images
  - Saves images to `public/uploads/` directory
  - Updates company database with image URLs
  - Returns success response with image URLs

### 2. **Database Updates** ✔️
- **File**: `server/db.json`
- **Added Fields**:
  - `heroImage` - Hero section background
  - `ecoFriendlyIcon` - Why Choose Us icon 1
  - `strengthIcon` - Why Choose Us icon 2
  - `energyIcon` - Why Choose Us icon 3
  - `deliveryIcon` - Why Choose Us icon 4
  - `teamMember1Image` - Team photo 1
  - `teamMember2Image` - Team photo 2
  - `teamMember3Image` - Team photo 3
  - `teamMember4Image` - Team photo 4

### 3. **Frontend API** ✔️
- **File**: `client/src/api.js`
- **New Function**: `uploadCompanyImages(images)`
- **Usage**: Sends multiple base64 images to backend in one request

### 4. **Admin Dashboard Settings Tab** ✔️
- **File**: `client/src/pages/AdminDashboard.jsx`
- **Features**:
  - ⚙️ Settings tab with three sections:
    - Hero Background Image upload
    - Why Choose Us Icons (4 separate uploads)
    - Team Member Photos (4 separate uploads)
  - Live image previews after selection
  - "Save All Settings" button to upload all images at once

### 5. **Home Page Integration** ✔️
- **File**: `client/src/pages/Home.jsx`
- **Features**:
  - Hero section loads background image from database
  - Why Choose Us section displays icon images OR fallback to emojis
  - Team section displays member photos OR fallback to emoji avatars
  - News section displays article images if available
  - Certificates section displays certificate images if available

## 🚀 How to Use

### Step 1: Start the Server
```bash
cd server
npm install
npm start
# Server runs on http://localhost:4000
```

### Step 2: Start the Client
```bash
cd client
npm install
npm start
# Client runs on http://localhost:5173 (or specified port)
```

### Step 3: Login as Admin
- Navigate to admin dashboard
- Login with admin credentials

### Step 4: Upload Images
1. Click on **⚙️ Settings** tab
2. Select and upload images:
   - **Hero Background**: Recommended 1920 x 600px
   - **Why Choose Us Icons**: Recommended 150 x 150px each
   - **Team Member Photos**: Recommended 300 x 300px each
3. Preview images in real-time
4. Click **💾 Save All Settings**
5. Confirm with success message

### Step 5: Verify on Home Page
- Images will immediately display on the home page
- Fallback to emojis if images not provided
- Images load from `/uploads/` directory

## 📁 File Structure
```
uploads/
├── 1708900000001_heroImage.png
├── 1708900000002_ecoFriendlyIcon.png
├── 1708900000003_strengthIcon.png
├── 1708900000004_energyIcon.png
├── 1708900000005_deliveryIcon.png
├── 1708900000006_teamMember1Image.png
├── 1708900000007_teamMember2Image.png
├── 1708900000008_teamMember3Image.png
└── 1708900000009_teamMember4Image.png
```

## 🔍 Testing Checklist

### Backend Tests
- [ ] Server starts without errors
- [ ] `/api/company` endpoint returns company data with image fields
- [ ] `/api/company/upload-images` accepts POST requests
- [ ] Images are saved to `public/uploads/` directory
- [ ] Database updates with image URLs
- [ ] Image URLs are returned in response

### Frontend Tests
- [ ] Admin can navigate to Settings tab
- [ ] Admin can select images in each upload field
- [ ] Live preview shows selected images
- [ ] Click "Save All Settings" triggers upload
- [ ] Success message appears after upload
- [ ] Images appear on home page immediately
- [ ] Hero background displays correctly
- [ ] Icons display in "Why Choose Us" section
- [ ] Team photos display in team section

### Image Display Tests
- [ ] Home page loads company data correctly
- [ ] Hero background image displays with gradient overlay
- [ ] "Why Choose Us" icons show OR fallback to emojis
- [ ] Team member photos display OR fallback to avatars
- [ ] Images load from correct URLs
- [ ] No console errors related to images

## 🐛 Troubleshooting

### Images not displaying?
1. Check browser console for errors
2. Verify image URLs are correct
3. Check if images exist in `public/uploads/`
4. Ensure server is running on port 4000
5. Check CORS configuration

### Upload fails?
1. Check server console for errors
2. Ensure `public/uploads/` directory exists
3. Verify file permissions on uploads directory
4. Check image file size (max 50MB due to body parser limit)

### Images not updating?
1. Clear browser cache
2. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
3. Check network tab for failed requests
4. Verify admin token is valid

## 📊 API Endpoints

### GET /api/company
Returns company data including all image URLs
```json
{
  "name": "KG Flyash Bricks",
  "heroImage": "/uploads/1708900000001_heroImage.png",
  "ecoFriendlyIcon": "/uploads/1708900000002_ecoFriendlyIcon.png",
  ...
}
```

### POST /api/company/upload-images
Uploads multiple company images
```json
Request Body:
{
  "images": {
    "heroImage": "data:image/png;base64,...",
    "ecoFriendlyIcon": "data:image/png;base64,...",
    ...
  }
}

Response:
{
  "success": true,
  "message": "Images uploaded successfully",
  "images": {
    "heroImage": "/uploads/1708900000001_heroImage.png",
    ...
  },
  "company": { ...full company object... }
}
```

## 🎨 Recommended Image Sizes

| Section | Size | Format |
|---------|------|--------|
| Hero Background | 1920 x 600px | PNG/JPG |
| Why Choose Us Icons | 150 x 150px | PNG |
| Team Member Photos | 300 x 300px | PNG/JPG |
| Certificates | 200 x 200px | PNG |
| News Images | 600 x 400px | PNG/JPG |

## ✨ Features Summary

✅ **Full Image Upload Support**
- Multiple image types supported
- Base64 encoding for easy transmission
- Automatic image directory creation
- Image path normalization

✅ **Admin Dashboard Integration**
- Intuitive Settings tab
- Live image previews
- Batch upload capability
- Real-time validation

✅ **Home Page Integration**
- Dynamic image loading
- Graceful fallback to emojis
- Responsive image display
- Optimized image loading

✅ **Database Persistence**
- Images saved permanently
- Database synced with file system
- Automatic URL normalization
- Version control ready

## 🎯 Next Steps

- Monitor image usage
- Optimize image sizes if needed
- Consider image CDN for production
- Implement image compression
- Add image lazy loading for performance

---

**Status**: ✅ Fully Configured and Ready for Use
**Last Updated**: February 14, 2026
