const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const { db, initDB, nanoid } = require('./utils');
const path = require('path');
const fs = require('fs');

const SECRET = 'kgflyash_secret_demo';
const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

// Health check
app.get('/', (req, res) => res.send('KGFlyash server OK'));

// ============ MIDDLEWARE ============
function authOptional(){
  return (req,res,next)=>{
    const h = req.headers.authorization;
    if(!h){ return next(); }
    const token = h.split(' ')[1];
    try{
      const u = jwt.verify(token, SECRET);
      req.user = u;
    }catch(e){}
    next();
  };
}

function authMiddleware(allowedRoles){
  return (req,res,next)=>{
    const h = req.headers.authorization;
    if(!h) return res.status(401).json({error:'auth required'});
    const token = h.split(' ')[1];
    try{
      const u = jwt.verify(token, SECRET);
      req.user = u;
      if(Array.isArray(allowedRoles) && allowedRoles.length>0 && !allowedRoles.includes(u.role)) {
        return res.status(403).json({error:'forbidden'});
      }
      next();
    }catch(e){
      return res.status(401).json({error:'invalid token'});
    }
  };
}

(async ()=> {
  console.log('Starting KGFlyash server initialization...');
  await initDB();

  // ============ ANALYTICS ============
  app.get('/api/analytics/dashboard', authMiddleware(['admin','manager']), async(req,res)=>{
    await db.read();
    
    const orders = db.data.orders || [];
    const enquiries = db.data.enquiries || [];
    const products = db.data.products || [];
    const employees = db.data.employees || [];
    
    // Calculate detailed statistics
    const ordersByStatus = {
      pending: orders.filter(o => o.status === 'pending').length,
      accepted: orders.filter(o => o.status === 'accepted').length,
      processing: orders.filter(o => o.status === 'processing').length,
      shipped: orders.filter(o => o.status === 'shipped').length,
      delivered: orders.filter(o => o.status === 'delivered').length,
      rejected: orders.filter(o => o.status === 'rejected').length,
    };
    
    const enquiriesByStatus = {
      new: enquiries.filter(e => e.status === 'new').length,
      replied: enquiries.filter(e => e.status === 'replied').length,
      resolved: enquiries.filter(e => e.status === 'resolved').length,
    };
    
    const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const totalRevenuePending = orders.filter(o => o.status === 'pending').reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const totalRevenueCompleted = orders.filter(o => o.status === 'delivered' || o.status === 'completed').reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    
    const stats = {
      // Orders
      totalOrders: orders.length,
      ordersByStatus,
      totalRevenue,
      totalRevenuePending,
      totalRevenueCompleted,
      averageOrderValue: orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0,
      
      // Customers & Enquiries
      totalCustomers: db.data.publicUsers?.length || 0,
      totalEnquiries: enquiries.length,
      enquiriesByStatus,
      repliedEnquiriesPercentage: enquiries.length > 0 ? Math.round((enquiriesByStatus.replied / enquiries.length) * 100) : 0,
      
      // Products
      totalProducts: products.filter(p => p.status === 'published').length,
      totalStock: products.reduce((sum, p) => sum + (p.stock || 0), 0),
      lowStockProducts: products.filter(p => p.stock && p.stock < 100).length,
      
      // Employees
      totalEmployees: employees.length,
      
      // Trends
      ordersTrend: generateTrend(orders, 7),
      topProducts: getTopProducts(orders),
      recentOrders: orders.slice(-10).reverse(),
      recentEnquiries: enquiries.slice(-10).reverse(),
      
      // Performance metrics
      orderFulfillmentRate: orders.length > 0 ? Math.round((ordersByStatus.delivered / orders.length) * 100) : 0,
    };
    
    res.json(stats);
  });

  // ============ SEARCH & FILTERS ============
  app.get('/api/products/search', async(req,res)=>{
    await db.read();
    const { q, category, minPrice, maxPrice, inStock } = req.query;
    let results = db.data.products?.filter(p => p.status === 'published' || !p.status) || [];
    
    if(q) results = results.filter(p => p.name.toLowerCase().includes(q.toLowerCase()) || p.desc?.toLowerCase().includes(q.toLowerCase()));
    if(category) results = results.filter(p => p.category === category);
    if(minPrice) results = results.filter(p => p.price >= parseFloat(minPrice));
    if(maxPrice) results = results.filter(p => p.price <= parseFloat(maxPrice));
    if(inStock === 'true') results = results.filter(p => p.stock > 0);
    
    res.json(results);
  });

  app.get('/api/products/categories', async(req,res)=>{
    await db.read();
    const categories = [...new Set((db.data.products || []).map(p => p.category).filter(Boolean))];
    res.json(categories);
  });

  // ============ COMPANY ============
  app.get('/api/company', async (req,res)=>{
    await db.read();
    // Return complete company data including images - don't filter!
    res.json(db.data.company);
  });

  app.put('/api/company', authMiddleware(['admin']), async (req,res)=>{
    await db.read();
    const { draftOnly, ...rest } = req.body;
    // also merge directly into db.data.company so GET /api/company shows changes immediately
    if (!db.data.company) db.data.company = {};
    db.data.company = { ...db.data.company, ...rest };

    const page = db.data.pageContents?.find(p => p.pageId === 'company') || { pageId: 'company', status: 'draft' };
    page.data = { ...page.data, ...req.body };
    page.editedBy = req.user.id;
    page.editedAt = new Date().toISOString();
    page.status = draftOnly ? 'draft' : 'published';
    
    if (!Array.isArray(db.data.pageContents)) db.data.pageContents = [];
    const idx = db.data.pageContents.findIndex(p => p.pageId === 'company');
    if (idx >= 0) db.data.pageContents[idx] = page;
    else db.data.pageContents.push(page);
    
    await db.write();
    res.json(page);
  });

  // ============ COMPANY IMAGES - DEBUG TEST ============
  app.post('/api/company/test-upload', async(req,res)=>{
    res.json({ 
      status: 'ok',
      message: 'Test endpoint working - real upload endpoint should work too',
      endpoint: 'POST /api/company/upload-images'
    });
  });

  // ============ DIAGNOSTIC - Check uploads ============
  app.get('/api/diagnostic/images', async(req,res)=>{
    try {
      await db.read();
      const publicDir = path.join(__dirname, 'public/uploads');
      let files = [];
      if (fs.existsSync(publicDir)) {
        files = fs.readdirSync(publicDir);
      }
      
      res.json({
        uploadDir: publicDir,
        exists: fs.existsSync(publicDir),
        files: files,
        databaseCompany: {
          name: db.data.company?.name,
          heroImage: db.data.company?.heroImage,
          ecoFriendlyIcon: db.data.company?.ecoFriendlyIcon,
          strengthIcon: db.data.company?.strengthIcon,
          energyIcon: db.data.company?.energyIcon,
          deliveryIcon: db.data.company?.deliveryIcon,
          teamMember1Image: db.data.company?.teamMember1Image,
          teamMember2Image: db.data.company?.teamMember2Image,
          teamMember3Image: db.data.company?.teamMember3Image,
          teamMember4Image: db.data.company?.teamMember4Image
        }
      });
    } catch (e) {
      res.status(500).json({error: e.message});
    }
  });

  // ============ COMPANY IMAGES ============
  app.post('/api/company/upload-images', authMiddleware(['admin']), async(req,res)=>{
    try {
      await db.read();
      const { images } = req.body;
      if (!images || typeof images !== 'object') {
        return res.status(400).json({error: 'Invalid images object'});
      }

      const uploadedImages = {};
      const publicDir = path.join(__dirname, 'public/uploads');
      if (!fs.existsSync(publicDir)){
        fs.mkdirSync(publicDir, { recursive: true });
      }

      // Process each image
      for (const [key, imageData] of Object.entries(images)) {
        if (!imageData) continue;
        
        try {
          const base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData;
          const buffer = Buffer.from(base64Data, 'base64');
          const fileName = `${Date.now()}_${key}.png`;
          const filePath = path.join(publicDir, fileName);
          
          fs.writeFileSync(filePath, buffer);
          uploadedImages[key] = `/uploads/${fileName}`;
        } catch(e) {
          console.error(`Error uploading ${key}:`, e);
        }
      }

      // Update company data with image URLs
      db.data.company = { ...db.data.company, ...uploadedImages };
      await db.write();

      res.json({ 
        success: true, 
        message: 'Images uploaded successfully',
        images: uploadedImages,
        company: db.data.company
      });
    } catch (e) {
      res.status(500).json({error: e.message});
    }
  });

  // ============ PRODUCTS ============
  app.get('/api/products', async (req,res)=>{
    await db.read();
    const status = req.query.status || 'published';
    let products = (db.data.products || []).filter(p => p.status === status || !p.status);
    products = products.map(p => ({ ...p, rating: 4.5, reviews: Math.floor(Math.random() * 50) }));
    res.json(products);
  });

  app.get('/api/products/:id', authOptional(), async(req,res)=>{
    await db.read();
    const prod = db.data.products?.find(p=>p.id === req.params.id);
    if(!prod) return res.status(404).json({error:'not found'});
    const enhanced = { ...prod, rating: 4.5, reviews: Math.floor(Math.random() * 50), relatedProducts: (db.data.products || []).filter(p => p.category === prod.category && p.id !== prod.id).slice(0, 3) };
    res.json(enhanced);
  });

  app.post('/api/products', authMiddleware(['admin','manager']), async(req,res)=>{
    await db.read();
    const prod = { id: nanoid(), ...req.body, createdAt: new Date().toISOString(), status: req.body.draftOnly ? 'draft' : 'published', rating: 5, reviews: 0 };
    if(!Array.isArray(db.data.products)) db.data.products = [];
    db.data.products.push(prod);
    await db.write();
    res.json(prod);
  });

  app.put('/api/products/:id', authMiddleware(['admin','manager']), async(req,res)=>{
    await db.read();
    const idx = (db.data.products || []).findIndex(p=>p.id === req.params.id);
    if(idx < 0) return res.status(404).json({error:'not found'});
    db.data.products[idx] = { ...db.data.products[idx], ...req.body, updatedAt: new Date().toISOString() };
    await db.write();
    res.json(db.data.products[idx]);
  });

  app.delete('/api/products/:id', authMiddleware(['admin']), async(req,res)=>{
    await db.read();
    db.data.products = (db.data.products || []).filter(p=>p.id !== req.params.id);
    await db.write();
    res.json({success:true});
  });

  // ============ PRODUCT REVIEWS ============
  app.post('/api/products/:id/reviews', authOptional(), async(req,res)=>{
    await db.read();
    const { rating, comment, name } = req.body;
    if(!Array.isArray(db.data.reviews)) db.data.reviews = [];
    const review = { id: nanoid(), productId: req.params.id, rating, comment, name, createdAt: new Date().toISOString() };
    db.data.reviews.push(review);
    await db.write();
    res.json(review);
  });

  app.get('/api/products/:id/reviews', async(req,res)=>{
    await db.read();
    const reviews = (db.data.reviews || []).filter(r => r.productId === req.params.id);
    res.json(reviews);
  });

  // ============ NEWS ============
  app.get('/api/news', async(req,res)=>{
    await db.read();
    const news = (db.data.news || []).filter(n => n.status === 'published' || !n.status).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(news);
  });

  app.get('/api/news/:id', async(req,res)=>{
    await db.read();
    const newsItem = (db.data.news || []).find(n => n.id === req.params.id);
    if(!newsItem) return res.status(404).json({error:'not found'});
    res.json(newsItem);
  });

  app.post('/api/news', authMiddleware(['admin','manager']), async(req,res)=>{
    await db.read();
    const news = { 
      id: nanoid(), 
      ...req.body, 
      image: req.body.image || '', 
      createdAt: new Date().toISOString(), 
      status: req.body.draftOnly ? 'draft' : 'published',
      views: 0,
      likes: 0
    };
    if(!Array.isArray(db.data.news)) db.data.news = [];
    db.data.news.push(news);
    await db.write();
    res.json(news);
  });

  app.put('/api/news/:id', authMiddleware(['admin','manager']), async(req,res)=>{
    await db.read();
    const idx = (db.data.news || []).findIndex(n=>n.id === req.params.id);
    if(idx < 0) return res.status(404).json({error:'not found'});
    db.data.news[idx] = { 
      ...db.data.news[idx], 
      ...req.body, 
      image: req.body.image || db.data.news[idx].image,
      updatedAt: new Date().toISOString() 
    };
    await db.write();
    res.json(db.data.news[idx]);
  });

  app.delete('/api/news/:id', authMiddleware(['admin']), async(req,res)=>{
    await db.read();
    db.data.news = (db.data.news || []).filter(n=>n.id !== req.params.id);
    await db.write();
    res.json({success:true});
  });

  // ============ CERTIFICATES ============
  app.get('/api/certificates', async(req,res)=>{
    await db.read();
    const certs = (db.data.certificates || []).filter(c => c.status === 'published' || !c.status);
    res.json(certs);
  });

  app.post('/api/certificates', authMiddleware(['admin']), async(req,res)=>{
    await db.read();
    const cert = { id: nanoid(), ...req.body, createdAt: new Date().toISOString(), status: req.body.draftOnly ? 'draft' : 'published' };
    if(!Array.isArray(db.data.certificates)) db.data.certificates = [];
    db.data.certificates.push(cert);
    await db.write();
    res.json(cert);
  });

  app.put('/api/certificates/:id', authMiddleware(['admin']), async(req,res)=>{
    await db.read();
    const idx = (db.data.certificates || []).findIndex(c=>c.id === req.params.id);
    if(idx < 0) return res.status(404).json({error:'not found'});
    db.data.certificates[idx] = { ...db.data.certificates[idx], ...req.body, updatedAt: new Date().toISOString() };
    await db.write();
    res.json(db.data.certificates[idx]);
  });

  app.delete('/api/certificates/:id', authMiddleware(['admin']), async(req,res)=>{
    await db.read();
    db.data.certificates = (db.data.certificates || []).filter(c=>c.id !== req.params.id);
    await db.write();
    res.json({success:true});
  });

  // ============ PAGE CONTENT MANAGEMENT ============
  app.get('/api/page-contents', authMiddleware(['admin','manager']), async(req,res)=>{
    await db.read();
    const pages = db.data.pageContents || [];
    res.json(pages);
  });

  app.get('/api/page-contents/:pageId', authMiddleware(['admin','manager']), async(req,res)=>{
    await db.read();
    const page = db.data.pageContents?.find(p => p.pageId === req.params.pageId);
    res.json(page || { pageId: req.params.pageId, status: 'draft', data: {}, sections: [] });
  });

  app.post('/api/page-contents', authMiddleware(['admin','manager']), async(req,res)=>{
    await db.read();
    const { pageId, content, sections, seo, schedulePublish, draftOnly } = req.body;
    
    if (!Array.isArray(db.data.pageContents)) db.data.pageContents = [];
    
    const page = db.data.pageContents.find(p => p.pageId === pageId) || { pageId, sections: [] };
    page.content = content;
    page.sections = sections || [];
    page.seo = seo || { title: '', description: '', keywords: '' };
    page.editedBy = req.user.id;
    page.editedAt = new Date().toISOString();
    page.status = draftOnly ? 'draft' : 'published';
    
    if (schedulePublish) {
      page.schedulePublish = schedulePublish;
      page.status = 'scheduled';
    }
    
    const idx = db.data.pageContents.findIndex(p => p.pageId === pageId);
    if (idx >= 0) db.data.pageContents[idx] = page;
    else db.data.pageContents.push(page);
    
    await db.write();
    res.json(page);
  });

  app.post('/api/page-contents/:pageId/publish', authMiddleware(['admin']), async(req,res)=>{
    await db.read();
    const page = db.data.pageContents?.find(p => p.pageId === req.params.pageId);
    if (!page) return res.status(404).json({error:'not found'});
    
    page.status = 'published';
    page.publishedAt = new Date().toISOString();
    page.publishedBy = req.user.id;
    
    await db.write();
    res.json(page);
  });

  // ============ IMAGE UPLOAD ============
  app.post('/api/upload', authMiddleware(['admin','manager','driver']), async(req,res)=>{
    try {
      const { image, filename } = req.body;
      if (!image) return res.status(400).json({error:'no image provided'});
      
      const publicDir = path.join(__dirname, 'public/uploads');
      if (!fs.existsSync(publicDir)){
        fs.mkdirSync(publicDir, { recursive: true });
      }
      
      // Accept both data URLs (data:[mime];base64,...) and raw base64 strings
      const base64Data = image.includes(',') ? image.split(',')[1] : image;
      const buffer = Buffer.from(base64Data, 'base64');
      const safeName = (filename || 'image.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `${Date.now()}_${safeName}`;
      const filePath = path.join(publicDir, fileName);
      
      fs.writeFileSync(filePath, buffer);
      
      const relativeUrl = `/uploads/${fileName}`;
      res.json({ url: relativeUrl, filename: fileName });
    } catch (e) {
      res.status(500).json({error: e.message});
    }
  });

  // ============ DEV-ONLY DEBUG UPLOAD (UNAUTHENTICATED) ============
  // Use this route from the browser for quick testing. Disabled in production.
  app.post('/api/upload-debug', async(req,res)=>{
    if (process.env.NODE_ENV === 'production') return res.status(403).json({ error: 'not allowed in production' });
    try {
      const { image, filename } = req.body;
      if (!image) return res.status(400).json({error:'no image provided'});

      const publicDir = path.join(__dirname, 'public/uploads');
      if (!fs.existsSync(publicDir)){
        fs.mkdirSync(publicDir, { recursive: true });
      }

      const base64Data = image.includes(',') ? image.split(',')[1] : image;
      const buffer = Buffer.from(base64Data, 'base64');
      const safeName = (filename || 'image.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `${Date.now()}_${safeName}`;
      const filePath = path.join(publicDir, fileName);

      fs.writeFileSync(filePath, buffer);

      const relativeUrl = `/uploads/${fileName}`;
      console.log('[UPLOAD-DEBUG] saved', fileName, '->', relativeUrl);
      res.json({ url: relativeUrl, filename: fileName, debug: true });
    } catch (e) {
      res.status(500).json({error: e.message});
    }
  });

  // ============ AUTHENTICATION ============
  app.post('/api/auth/admin-login', async(req,res)=>{
    const { username, password } = req.body;
    await db.read();
    const user = db.data.users?.find(u => u.username === username && u.password === password);
    if(!user) return res.status(401).json({error:'invalid credentials'});
    
    const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, role: user.role, username: user.username } });
  });

  // ============ ADMIN PROFILE UPDATE ============
  // allow the administrator (or manager updating own account) to change
  // username/password. only the user themselves or a top-level admin may edit.
  app.put('/api/auth/admin/:id', authMiddleware(['admin','manager']), async (req, res) => {
    const { id } = req.params;
    const { username, password } = req.body;
    await db.read();
    const user = (db.data.users || []).find(u => u.id === id);
    if (!user) return res.status(404).json({ error: 'not found' });

    // if a manager is making the request, they can only update their own
    if (req.user.role !== 'admin' && req.user.id !== id) {
      return res.status(403).json({ error: 'forbidden' });
    }

    if (username) user.username = username;
    if (password) user.password = password;
    user.updatedAt = new Date().toISOString();
    await db.write();
    res.json({ success: true, user: { id: user.id, role: user.role, username: user.username } });
  });

  // convenience endpoint to update profile of currently authenticated user
  app.put('/api/auth/profile', authMiddleware(), async (req, res) => {
    const { username, password } = req.body;
    await db.read();
    const user = (db.data.users || []).find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'not found' });
    if (username) user.username = username;
    if (password) user.password = password;
    user.updatedAt = new Date().toISOString();
    await db.write();
    res.json({ success: true, user: { id: user.id, role: user.role, username: user.username } });
  });

  app.post('/api/auth/register', async(req,res)=>{
    const { name, email, mobile, otpMethod = 'sms' } = req.body;
    await db.read();
    
    const otp = Math.floor(100000 + Math.random()*900000);
    console.log(`[OTP MOCK] OTP for ${mobile} (${otpMethod}): ${otp}`);
    
    // Mock WhatsApp OTP send
    if(otpMethod === 'whatsapp') {
      console.log(`[WHATSAPP] Sending OTP ${otp} to ${mobile} via WhatsApp`);
      // In production, integrate with WhatsApp API (Twilio, Nexmo, etc.)
    }
    
    if(!Array.isArray(db.data.publicUsers)) db.data.publicUsers = [];
    const user = { id: nanoid(), name, email, mobile, otp, otpMethod, createdAt: new Date().toISOString() };
    db.data.publicUsers.push(user);
    await db.write();
    
    res.json({success:true, otp, userId:user.id, message: `OTP sent via ${otpMethod.toUpperCase()}`});
  });

  app.post('/api/auth/verify-otp', async(req,res)=>{
    const { userId, otp } = req.body;
    await db.read();
    const user = db.data.publicUsers?.find(u => u.id === userId && u.otp == otp);
    if(!user) return res.status(401).json({error:'invalid otp'});
    
    user.verified = true;
    const token = jwt.sign({ id: user.id, role: 'public', name: user.name }, SECRET, { expiresIn: '7d' });
    await db.write();
    res.json({ token, user: { id: user.id, role: 'public', name: user.name } });
  });

  app.post('/api/auth/request-otp', async(req,res)=>{
    const { mobile, otpMethod = 'sms' } = req.body;
    const otp = Math.floor(100000 + Math.random()*900000);
    console.log(`[OTP MOCK] OTP for ${mobile} (${otpMethod}): ${otp}`);
    
    // Mock WhatsApp OTP send
    if(otpMethod === 'whatsapp') {
      console.log(`[WHATSAPP] Sending OTP ${otp} to ${mobile} via WhatsApp`);
      // In production, integrate with WhatsApp API (Twilio, Nexmo, etc.)
    }
    
    res.json({success:true, otp, message: `OTP sent via ${otpMethod.toUpperCase()}`});
  });

  app.post('/api/auth/login-verify-otp', async(req,res)=>{
    const { mobile, otp } = req.body;
    await db.read();
    const user = db.data.publicUsers?.find(u => u.mobile === mobile);
    if(!user) return res.status(401).json({error:'user not found'});
    
    const token = jwt.sign({ id: user.id, role: 'public', name: user.name }, SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, role: 'public', name: user.name } });
  });

  // ============ CHATBOT ============
  app.post('/api/chatbot', authOptional(), async(req,res)=>{
    const { message } = req.body;
    const responses = {
      'price': 'Our solid bricks cost ₹5.50 per piece, hollow bricks ₹4.25, and paver blocks ₹8.00.',
      'products': 'We offer Solid Flyash Bricks, Hollow Flyash Bricks, Paver Blocks, and Interlocking Bricks.',
      'order': 'To place an order, please visit our website or contact us at +91-9876543210.',
      'delivery': 'We deliver across Tamil Nadu. Delivery time is 2-3 working days.',
      'quality': 'All our products are eco-friendly and tested for durability and strength.',
      'bulk': 'For bulk orders, please contact our sales team at sales@kgflyash.com',
      'warranty': 'Our products come with quality assurance and durability warranty.',
    };
    
    let reply = 'How can I help you today? Ask about prices, products, orders, delivery, quality, bulk orders, or warranty.';
    for (const [key, value] of Object.entries(responses)) {
      if (message.toLowerCase().includes(key)) {
        reply = value;
        break;
      }
    }
    
    res.json({ reply });
  });

  // ============ ENQUIRIES ============
  app.post('/api/enquiries', authOptional(), async(req,res)=>{
    await db.read();
    const enquiry = { id: nanoid(), ...req.body, status: 'new', createdAt: new Date().toISOString(), replies: [] };
    if(!Array.isArray(db.data.enquiries)) db.data.enquiries = [];
    db.data.enquiries.push(enquiry);
    console.log(`[ENQUIRY] ${enquiry.name} - ${enquiry.message}`);
    await db.write();
    res.json(enquiry);
  });

  app.get('/api/enquiries', authMiddleware(['admin','manager']), async(req,res)=>{
    await db.read();
    res.json(db.data.enquiries || []);
  });

  app.get('/api/enquiries/:id', authMiddleware(['admin','manager']), async(req,res)=>{
    await db.read();
    const enquiry = (db.data.enquiries || []).find(e => e.id === req.params.id);
    if(!enquiry) return res.status(404).json({error:'not found'});
    res.json(enquiry);
  });

  app.put('/api/enquiries/:id', authMiddleware(['admin','manager']), async(req,res)=>{
    await db.read();
    const idx = (db.data.enquiries || []).findIndex(e => e.id === req.params.id);
    if(idx < 0) return res.status(404).json({error:'not found'});
    db.data.enquiries[idx] = { ...db.data.enquiries[idx], ...req.body, updatedAt: new Date().toISOString() };
    await db.write();
    res.json(db.data.enquiries[idx]);
  });

  app.post('/api/enquiries/:id/reply', authMiddleware(['admin','manager']), async(req,res)=>{
    await db.read();
    const idx = (db.data.enquiries || []).findIndex(e => e.id === req.params.id);
    if(idx < 0) return res.status(404).json({error:'not found'});
    
    const enquiry = db.data.enquiries[idx];
    if(!Array.isArray(enquiry.replies)) enquiry.replies = [];
    
    const reply = {
      id: nanoid(),
      message: req.body.message,
      repliedBy: req.user.username || req.user.id,
      repliedAt: new Date().toISOString()
    };
    
    enquiry.replies.push(reply);
    enquiry.status = 'replied';
    enquiry.updatedAt = new Date().toISOString();
    
    await db.write();
    res.json(enquiry);
  });

  app.delete('/api/enquiries/:id', authMiddleware(['admin']), async(req,res)=>{
    await db.read();
    db.data.enquiries = (db.data.enquiries || []).filter(e => e.id !== req.params.id);
    await db.write();
    res.json({success:true});
  });

  // ============ ORDERS ============
  app.post('/api/orders', authOptional(), async(req,res)=>{
    await db.read();
    const order = { 
      id: nanoid(), 
      userId: req.user?.id || null,
      ...req.body, 
      status: 'pending', 
      createdAt: new Date().toISOString() 
    };
    if(!Array.isArray(db.data.orders)) db.data.orders = [];
    db.data.orders.push(order);
    console.log(`[ORDER] New order ${order.id} from ${order.customerName || 'Guest'}`);
    
    // Send notification to admins/managers
    if(!Array.isArray(db.data.notifications)) db.data.notifications = [];
    const notification = {
      id: nanoid(),
      type: 'order',
      title: `New Order #${order.id.substring(0, 6)}`,
      message: `Order received from ${order.customerName}. Total: ₹${order.totalAmount || 0}. Phone: ${order.customerPhone}`,
      orderId: order.id,
      userId: order.userId,
      createdAt: new Date().toISOString(),
      read: false,
      recipientRoles: ['admin', 'manager']
    };
    db.data.notifications.push(notification);
    console.log(`[NOTIFICATION] Order notification created for admins/managers`);
    
    await db.write();
    res.json({...order, notification: 'Order confirmation sent to our team'});
  });

  app.get('/api/orders/my', authMiddleware(['public']), async(req,res)=>{
    await db.read();
    const orders = (db.data.orders || []).filter(o => o.userId === req.user.id);
    res.json(orders);
  });

  app.get('/api/orders', authMiddleware(['admin','manager']), async(req,res)=>{
    await db.read();
    res.json(db.data.orders || []);
  });

  app.put('/api/orders/:id', authMiddleware(['admin','manager']), async(req,res)=>{
    await db.read();
    const idx = (db.data.orders || []).findIndex(o => o.id === req.params.id);
    if(idx < 0) return res.status(404).json({error:'not found'});
    
    const oldStatus = db.data.orders[idx].status;
    db.data.orders[idx] = { 
      ...db.data.orders[idx], 
      ...req.body,
      statusUpdatedAt: new Date().toISOString(),
      statusUpdatedBy: req.user.username || req.user.id
    };
    
    // Log status change
    if(!Array.isArray(db.data.orders[idx].statusHistory)) db.data.orders[idx].statusHistory = [];
    db.data.orders[idx].statusHistory.push({
      from: oldStatus,
      to: req.body.status || oldStatus,
      changedAt: new Date().toISOString(),
      changedBy: req.user.username || req.user.id,
      notes: req.body.notes || ''
    });
    
    await db.write();
    res.json(db.data.orders[idx]);
  });

  // ============ NOTIFICATIONS ============
  app.get('/api/notifications', authMiddleware(['admin','manager']), async(req,res)=>{
    await db.read();
    const notifications = (db.data.notifications || []).filter(n => 
      n.recipientRoles?.includes(req.user.role)
    );
    res.json(notifications.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
  });

  app.get('/api/notifications/unread-count', authMiddleware(['admin','manager']), async(req,res)=>{
    await db.read();
    const count = (db.data.notifications || []).filter(n => 
      n.recipientRoles?.includes(req.user.role) && !n.read
    ).length;
    res.json({unreadCount: count});
  });

  app.put('/api/notifications/:id/read', authMiddleware(['admin','manager']), async(req,res)=>{
    await db.read();
    const idx = (db.data.notifications || []).findIndex(n => n.id === req.params.id);
    if(idx < 0) return res.status(404).json({error:'not found'});
    db.data.notifications[idx].read = true;
    await db.write();
    res.json(db.data.notifications[idx]);
  });

  app.delete('/api/notifications/:id', authMiddleware(['admin','manager']), async(req,res)=>{
    await db.read();
    db.data.notifications = (db.data.notifications || []).filter(n => n.id !== req.params.id);
    await db.write();
    res.json({success:true});
  });

  // ============ EMPLOYEES ============
  app.post('/api/employees', authMiddleware(['admin','manager']), async(req,res)=>{
    await db.read();
    const emp = { 
      id: nanoid(), 
      ...req.body, 
      createdAt: new Date().toISOString(),
      status: 'active',
      profileImage: req.body.profileImage || '',
      // Personal Details
      firstName: req.body.firstName || '',
      lastName: req.body.lastName || '',
      email: req.body.email || '',
      phone: req.body.phone || '',
      dateOfBirth: req.body.dateOfBirth || '',
      gender: req.body.gender || '',
      address: req.body.address || '',
      city: req.body.city || '',
      state: req.body.state || '',
      pincode: req.body.pincode || '',
      aadharNumber: req.body.aadharNumber || '',
      panNumber: req.body.panNumber || '',
      // Professional Details
      employeeCode: req.body.employeeCode || `EMP-${nanoid()}`,
      designation: req.body.designation || '',
      department: req.body.department || '',
      role: req.body.role || 'employee',
      joinDate: req.body.joinDate || new Date().toISOString().split('T')[0],
      reportingTo: req.body.reportingTo || '',
      // Bank Details
      bankAccountNumber: req.body.bankAccountNumber || '',
      ifscCode: req.body.ifscCode || '',
      bankName: req.body.bankName || '',
      accountHolderName: req.body.accountHolderName || '',
      // Salary
      baseSalary: req.body.baseSalary || 0,
      salaryStructure: req.body.salaryStructure || {},
      // Emergency Contact
      emergencyContactName: req.body.emergencyContactName || '',
      emergencyContactPhone: req.body.emergencyContactPhone || '',
      emergencyContactRelation: req.body.emergencyContactRelation || '',
      // Additional Info
      qualifications: req.body.qualifications || [],
      certifications: req.body.certifications || [],
      experience: req.body.experience || 0,
      notes: req.body.notes || ''
    };
    if(!Array.isArray(db.data.employees)) db.data.employees = [];
    db.data.employees.push(emp);
    await db.write();
    res.json(emp);
  });

  app.get('/api/employees', authMiddleware(['admin','manager','supervisor']), async(req,res)=>{
    await db.read();
    res.json(db.data.employees || []);
  });

  app.get('/api/employees/:id', authMiddleware(['admin','manager','supervisor']), async(req,res)=>{
    await db.read();
    const emp = (db.data.employees || []).find(e => e.id === req.params.id);
    if(!emp) return res.status(404).json({error:'not found'});
    res.json(emp);
  });

  app.put('/api/employees/:id', authMiddleware(['admin','manager']), async(req,res)=>{
    await db.read();
    const idx = (db.data.employees || []).findIndex(e => e.id === req.params.id);
    if(idx < 0) return res.status(404).json({error:'not found'});
    db.data.employees[idx] = { 
      ...db.data.employees[idx], 
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    await db.write();
    res.json(db.data.employees[idx]);
  });

  app.delete('/api/employees/:id', authMiddleware(['admin']), async(req,res)=>{
    await db.read();
    db.data.employees = (db.data.employees || []).filter(e => e.id !== req.params.id);
    await db.write();
    res.json({success:true});
  });

  // ============ ATTENDANCE ============
  app.post('/api/attendance', authMiddleware(['employee','admin','manager','supervisor']), async(req,res)=>{
    await db.read();
    const att = { id: nanoid(), employeeId: req.user.id, ...req.body, date: new Date().toISOString() };
    if(!Array.isArray(db.data.attendance)) db.data.attendance = [];
    db.data.attendance.push(att);
    await db.write();
    res.json(att);
  });

  app.get('/api/attendance', authMiddleware(['admin','manager','supervisor']), async(req,res)=>{
    await db.read();
    res.json(db.data.attendance || []);
  });

  // ============ LEAVES ============
  app.post('/api/leaves', authMiddleware(['employee','admin','manager']), async(req,res)=>{
    await db.read();
    const leave = { id: nanoid(), employeeId: req.user.id, ...req.body, status: 'pending', createdAt: new Date().toISOString() };
    if(!Array.isArray(db.data.leaves)) db.data.leaves = [];
    db.data.leaves.push(leave);
    await db.write();
    res.json(leave);
  });

  app.get('/api/leaves', authMiddleware(['admin','manager','supervisor']), async(req,res)=>{
    await db.read();
    res.json(db.data.leaves || []);
  });

  app.put('/api/leaves/:id', authMiddleware(['admin','manager']), async(req,res)=>{
    await db.read();
    const idx = (db.data.leaves || []).findIndex(l => l.id === req.params.id);
    if(idx < 0) return res.status(404).json({error:'not found'});
    db.data.leaves[idx] = { ...db.data.leaves[idx], ...req.body };
    await db.write();
    res.json(db.data.leaves[idx]);
  });

  // ============ SALARIES ============
  app.post('/api/salaries', authMiddleware(['admin','manager']), async(req,res)=>{
    await db.read();
    const sal = { id: nanoid(), ...req.body, createdAt: new Date().toISOString() };
    if(!Array.isArray(db.data.salaries)) db.data.salaries = [];
    db.data.salaries.push(sal);
    await db.write();
    res.json(sal);
  });

  app.get('/api/salaries', authMiddleware(['admin','manager']), async(req,res)=>{
    await db.read();
    res.json(db.data.salaries || []);
  });

  app.put('/api/salaries/:id', authMiddleware(['admin','manager']), async(req,res)=>{
    await db.read();
    const idx = (db.data.salaries || []).findIndex(s => s.id === req.params.id);
    if(idx < 0) return res.status(404).json({error:'not found'});
    db.data.salaries[idx] = { ...db.data.salaries[idx], ...req.body };
    await db.write();
    res.json(db.data.salaries[idx]);
  });

  // ============ DELIVERIES ============
  app.post('/api/deliveries', authMiddleware(['admin','manager']), async(req,res)=>{
    await db.read();
    const delivery = { id: nanoid(), ...req.body, status: 'pending', createdAt: new Date().toISOString() };
    if(!Array.isArray(db.data.deliveries)) db.data.deliveries = [];
    db.data.deliveries.push(delivery);
    await db.write();
    res.json(delivery);
  });

  app.get('/api/deliveries', authMiddleware(['admin','manager','supervisor','driver']), async(req,res)=>{
    await db.read();
    let dels = db.data.deliveries || [];
    if(req.user.role==='driver'){
      dels = dels.filter(x=>x.driverId===req.user.id);
    }
    res.json(dels);
  });

  app.put('/api/deliveries/:id', authMiddleware(['driver','admin','manager','supervisor']), async(req,res)=>{
    await db.read();
    const idx = (db.data.deliveries || []).findIndex(x=>x.id===req.params.id);
    if(idx<0) return res.status(404).json({error:'not found'});
    db.data.deliveries[idx] = {...db.data.deliveries[idx], ...req.body};
    if(db.data.deliveries[idx].status === 'completed'){
      const oIdx = db.data.orders.findIndex(x=>x.id===db.data.deliveries[idx].orderId);
      if(oIdx>=0) db.data.orders[oIdx].status = 'delivered';
    }
    await db.write();
    res.json(db.data.deliveries[idx]);
  });

  // ============ LOGISTICS SYSTEM ============

  // Driver Authentication
  app.post('/api/auth/driver-login', async(req,res)=>{
    const { username, password } = req.body;
    await db.read();
    const driver = db.data.logistics_drivers?.find(d => d.username === username && d.password === password && d.status === 'active');
    if(!driver) return res.status(401).json({error:'invalid credentials'});

    const token = jwt.sign({ id: driver.id, name: driver.name, role: 'driver', vehicle_no: driver.vehicle_no }, SECRET, { expiresIn: '24h' });
    res.json({ token, driver: { id: driver.id, name: driver.name, vehicle_no: driver.vehicle_no, image: driver.image } });
  });

  // Get Driver Profile
  app.get('/api/driver/profile', authMiddleware(['driver']), async(req,res)=>{
    await db.read();
    const driver = db.data.logistics_drivers?.find(d => d.id === req.user.id);
    if(!driver) return res.status(404).json({error:'driver not found'});
    res.json(driver);
  });

  // Update Driver Profile
  app.put('/api/driver/profile', authMiddleware(['driver']), async(req,res)=>{
    const updates = req.body;

    await db.read();
    const driverIdx = db.data.logistics_drivers?.findIndex(d => d.id === req.user.id);
    if(driverIdx < 0) return res.status(404).json({error:'driver not found'});

    // Only allow updating certain fields
    const allowedFields = ['name', 'phone', 'image', 'vehicle_no'];
    const filteredUpdates = {};
    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    db.data.logistics_drivers[driverIdx] = { ...db.data.logistics_drivers[driverIdx], ...filteredUpdates };
    await db.write();
    res.json(db.data.logistics_drivers[driverIdx]);
  });

  // Get Driver's Assigned Orders
  app.get('/api/driver/orders', authMiddleware(['driver']), async(req,res)=>{
    await db.read();
    const ordersRaw = db.data.logistics_orders?.filter(o => o.driver_id === req.user.id) || [];
    const orders = ordersRaw.map(o => ({
      ...o,
      pickup: o.pickup || { address: o.pickup_location || '' },
      drop: o.drop || { address: o.drop_location || '' }
    }));
    res.json(orders);
  });

  // Update Order Status (Driver)
  app.put('/api/driver/orders/:id', authMiddleware(['driver']), async(req,res)=>{
    const { id } = req.params;
    const { status, mileage, remark, images } = req.body;

    await db.read();
    const orderIdx = db.data.logistics_orders?.findIndex(o => o.id === id && o.driver_id === req.user.id);
    if(orderIdx < 0) return res.status(404).json({error:'order not found'});

    // Status progression validation - prevent invalid status changes
    const currentStatus = db.data.logistics_orders[orderIdx].status;
    const validTransitions = {
      'assigned': ['accepted', 'rejected', 'load_started', 'load_out', 'in_transit', 'delivered'],
      'accepted': ['load_started', 'load_out', 'in_transit', 'delivered'], // Can't go back to assigned
      'load_started': ['load_out', 'in_transit', 'delivered'], // Can't go back to assigned/accepted
      'load_out': ['in_transit', 'delivered'], // Can't go back
      'in_transit': ['delivered'], // Only can deliver
      'delivered': [], // Can't change once delivered
      'rejected': [] // Can't change once rejected
    };

    if (!validTransitions[currentStatus].includes(status)) {
      return res.status(400).json({
        error: `Invalid status transition from ${currentStatus} to ${status}. Valid options: ${validTransitions[currentStatus].join(', ')}`
      });
    }

    // Update order status
    db.data.logistics_orders[orderIdx].status = status;

    // Create notifications for important status changes
    const importantStatuses = ['load_started', 'delivered'];
    console.log('Driver order update - status:', status, 'important statuses:', importantStatuses);
    if (importantStatuses.includes(status)) {
      console.log('Creating notification for status:', status);
      if (!db.data.notifications) db.data.notifications = [];
      
      const notification = {
        id: nanoid(),
        title: `Order ${status.replace('_', ' ').toUpperCase()}`,
        message: `Order #${id} has been ${status.replace('_', ' ')} by driver ${req.user.name}`,
        type: 'order_update',
        orderId: id,
        recipientRoles: ['admin', 'manager'],
        read: false,
        createdAt: new Date().toISOString()
      };
      
      db.data.notifications.push(notification);
      console.log('Notification created:', notification);
    }

    // Create order update record with multiple images support
    const updateRecord = {
      id: nanoid(),
      order_id: id,
      status,
      mileage: parseFloat(mileage) || 0,
      remark: remark || '',
      images: Array.isArray(images) ? images : (images ? [images] : []), // Support both array and single image
      timestamp: new Date().toISOString(),
      driver_id: req.user.id
    };

    if(!db.data.order_updates) db.data.order_updates = [];
    db.data.order_updates.push(updateRecord);

    await db.write();
    res.json({ order: db.data.logistics_orders[orderIdx], update: updateRecord });
  });

  // Update Driver Location
  app.post('/api/driver/location', authMiddleware(['driver']), async(req,res)=>{
    const { lat, lng, on_duty } = req.body;

    await db.read();
    if(!db.data.driver_locations) db.data.driver_locations = [];

    const existingIdx = db.data.driver_locations.findIndex(l => l.driver_id === req.user.id);
    const locationData = {
      driver_id: req.user.id,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      last_update: new Date().toISOString(),
      on_duty: on_duty === true || on_duty === 'true'
    };

    if(existingIdx >= 0) {
      db.data.driver_locations[existingIdx] = locationData;
    } else {
      db.data.driver_locations.push(locationData);
    }

    await db.write();
    res.json({ success: true });
  });

  // Get Driver Location (Admin/Manager)
  app.get('/api/drivers/location', authMiddleware(['admin','manager']), async(req,res)=>{
    await db.read();
    const locations = db.data.driver_locations?.filter(l => l.on_duty) || [];
    res.json(locations);
  });

  // Get All Drivers (Admin/Manager)
  app.get('/api/drivers', authMiddleware(['admin','manager']), async(req,res)=>{
    await db.read();
    const drivers = db.data.logistics_drivers || [];
    res.json(drivers);
  });

  // Create Driver (Admin/Manager)
  app.post('/api/drivers', authMiddleware(['admin','manager']), async(req,res)=>{
    const { name, phone, vehicle_no, username, password, image } = req.body;

    await db.read();
    if(!db.data.logistics_drivers) db.data.logistics_drivers = [];

    // Check if username exists
    const existing = db.data.logistics_drivers.find(d => d.username === username);
    if(existing) return res.status(400).json({error:'username already exists'});

    const driver = {
      id: nanoid(),
      name,
      phone,
      vehicle_no,
      username,
      password,
      image: image || '',
      status: 'active',
      createdAt: new Date().toISOString()
    };

    db.data.logistics_drivers.push(driver);
    await db.write();
    res.json(driver);
  });

  // Update Driver (Admin)
  app.put('/api/drivers/:id', authMiddleware(['admin']), async(req,res)=>{
    const { id } = req.params;
    const updates = req.body;

    await db.read();
    const driverIdx = db.data.logistics_drivers?.findIndex(d => d.id === id);
    if(driverIdx < 0) return res.status(404).json({error:'driver not found'});

    db.data.logistics_drivers[driverIdx] = { ...db.data.logistics_drivers[driverIdx], ...updates };
    await db.write();
    res.json(db.data.logistics_drivers[driverIdx]);
  });

  // Delete Driver (Admin)
  app.delete('/api/drivers/:id', authMiddleware(['admin']), async(req,res)=>{
    const { id } = req.params;

    await db.read();
    const driverIdx = db.data.logistics_drivers?.findIndex(d => d.id === id);
    if(driverIdx < 0) return res.status(404).json({error:'driver not found'});

    db.data.logistics_drivers.splice(driverIdx, 1);
    await db.write();
    res.json({ success: true });
  });

  // Get All Logistics Orders (Admin/Manager)
  app.get('/api/logistics/orders', authMiddleware(['admin','manager']), async(req,res)=>{
    await db.read();
    const ordersRaw = db.data.logistics_orders || [];
    const orders = ordersRaw.map(o => ({
      ...o,
      pickup: o.pickup || { address: o.pickup_location || '' },
      drop: o.drop || { address: o.drop_location || '' }
    }));
    res.json(orders);
  });

  // Create Logistics Order (Admin/Manager)
  app.post('/api/logistics/orders', authMiddleware(['admin','manager']), async(req,res)=>{
    // support both legacy string fields and new object format
    const { driver_id, vehicle_no, load_qty, schedule_date } = req.body;
    const pickup = req.body.pickup || { address: req.body.pickup_location || '' };
    const drop = req.body.drop || { address: req.body.drop_location || '' };

    await db.read();
    if(!db.data.logistics_orders) db.data.logistics_orders = [];

    const order = {
      id: nanoid(),
      driver_id,
      vehicle_no,
      load_qty,
      schedule_date,
      pickup,    // { address, lat, lng }
      drop,      // { address, lat, lng }
      // keep legacy fields for display convenience (optional)
      pickup_location: pickup.address,
      drop_location: drop.address,
      status: 'assigned',
      created_by: req.user.role,
      createdAt: new Date().toISOString(),
      assignedAt: new Date().toISOString()
    };

    db.data.logistics_orders.push(order);
    await db.write();
    res.json(order);
  });

  // Update Logistics Order (Admin/Manager)
  app.put('/api/logistics/orders/:id', authMiddleware(['admin','manager']), async(req,res)=>{
    const { id } = req.params;
    const updates = req.body;

    // if pickup_location or drop_location are sent as primitive strings, convert
    if (typeof updates.pickup_location === 'string' && !updates.pickup) {
      updates.pickup = { address: updates.pickup_location };
    }
    if (typeof updates.drop_location === 'string' && !updates.drop) {
      updates.drop = { address: updates.drop_location };
    }

    await db.read();
    const orderIdx = db.data.logistics_orders?.findIndex(o => o.id === id);
    if(orderIdx < 0) return res.status(404).json({error:'order not found'});

    db.data.logistics_orders[orderIdx] = { ...db.data.logistics_orders[orderIdx], ...updates };
    // maintain legacy fields
    if (updates.pickup && updates.pickup.address) {
      db.data.logistics_orders[orderIdx].pickup_location = updates.pickup.address;
    }
    if (updates.drop && updates.drop.address) {
      db.data.logistics_orders[orderIdx].drop_location = updates.drop.address;
    }
    await db.write();
    res.json(db.data.logistics_orders[orderIdx]);
  });

  // Get Order Updates/History
  app.get('/api/logistics/orders/:id/updates', authMiddleware(['admin','manager','driver']), async(req,res)=>{
    const { id } = req.params;

    await db.read();
    const updates = db.data.order_updates?.filter(u => u.order_id === id) || [];
    res.json(updates);
  });

  // Get Driver Activity Log (Admin)
  app.get('/api/drivers/:id/activity', authMiddleware(['admin']), async(req,res)=>{
    const { id } = req.params;

    await db.read();
    const updates = db.data.order_updates?.filter(u => u.driver_id === id) || [];
    const locations = db.data.driver_locations?.filter(l => l.driver_id === id) || [];

    res.json({ updates, locations });
  });

  // ============ SERVER START ============
  const PORT = 4000;
  const HOST = '0.0.0.0';
  // Create explicit HTTP server to ensure Node keeps running and allow error handling
  const http = require('http');
  const server = http.createServer(app);
  server.listen(PORT, HOST, () => {
    console.log(`\n✓ KGFlyash server running on http://${HOST}:${PORT} (pid ${process.pid})\n`);
    try{
      const a = server.address();
      console.log('server.address() ->', JSON.stringify(a));
    }catch(e){ console.log('Could not read server.address()', e.message); }
  });
  server.on('error', (err) => console.error('Server error:', err));

  // Keepalive to prevent unexpected process exit in some dev environments
  setInterval(() => {}, 1000 * 60 * 60);

  process.on('uncaughtException', (err) => { console.error('Uncaught Exception:', err); });
  process.on('unhandledRejection', (reason) => { console.error('Unhandled Rejection:', reason); });
})();

// HELPER FUNCTIONS
function generateTrend(orders, days) {
  const trend = [];
  for(let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const count = orders.filter(o => new Date(o.createdAt).toDateString() === date.toDateString()).length;
    trend.push({ date: date.toDateString(), count });
  }
  return trend;
}

function getTopProducts(orders) {
  const productMap = {};
  orders.forEach(o => {
    if(o.products) {
      o.products.forEach(p => {
        productMap[p.id] = (productMap[p.id] || 0) + p.quantity;
      });
    }
  });
  return Object.entries(productMap).sort((a,b) => b[1] - a[1]).slice(0, 5);
}

