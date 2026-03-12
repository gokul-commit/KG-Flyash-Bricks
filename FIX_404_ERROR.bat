@echo off
REM Quick Fix for 404 Error - Database Image Upload
REM Run this from the root directory

echo.
echo ===================================
echo   FIX 404 Error - Image Upload
echo ===================================
echo.
echo IMPORTANT: Follow these steps:
echo.
echo Step 1: STOP the server
echo   - Go to terminal running server
echo   - Press Ctrl+C to stop it
echo.
echo Step 2: START server again
echo   - Run in server directory:
echo   cd server
echo   npm start
echo.
echo Step 3: VERIFY endpoint works
echo   - Open browser
echo   - Go to: http://localhost:4000/api/company
echo   - Should see company data with image fields
echo.
echo Step 4: TEST image upload
echo   - Go to Admin Dashboard
echo   - Click Settings tab
echo   - Upload an image
echo   - Click Save All Settings
echo   - Should see success message
echo.
echo ===================================
echo If still not working:
echo   1. Check server console for errors
echo   2. Verify server port is 4000
echo   3. Clear browser cache (Ctrl+Shift+Delete)
echo   4. Hard refresh page (Ctrl+Shift+R)
echo ===================================
echo.
pause
