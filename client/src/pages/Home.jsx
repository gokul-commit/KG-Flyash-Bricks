import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api, { getBaseUrl, getCompany, getProducts, getNews, getCertificates, chatbotQuery, createEnquiry, createOrder } from '../api';
import logo from '../assets/logo.png';

function Home({ user }) {
  const [company, setCompany] = useState(null);
  
  // free map defaults
  const defaultCenter = { lat: 9.9252, lng: 78.1198 };
  const mapRef = useRef(null);

  // render a simple map when the user is logged in
  useEffect(() => {
    if (!user || !mapRef.current) return;
    const map = L.map(mapRef.current).setView([defaultCenter.lat, defaultCenter.lng], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
  }, [user]);
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [news, setNews] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [chatMessages, setChatMessages] = useState([{ type: 'bot', text: 'Hi! How can I help you?' }]);
  const [chatInput, setChatInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [enquiryForm, setEnquiryForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [chatbotOpen, setChatbotOpen] = useState(true);
  const [chatImage, setChatImage] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({ name: '', email: '', rating: '5', message: '', type: 'general' });
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [orderForm, setOrderForm] = useState({ name: '', email: '', phone: '', address: '', city: '', state: '', pincode: '', quantity: 1 });
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [selectedProductForOrder, setSelectedProductForOrder] = useState(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  // Reload company data when page becomes visible (to show latest uploaded images)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, selectedCategory, searchQuery]);

  const loadData = async () => {
    try {
      console.log('Starting to load data...');
      setLoading(true);
      setError(null);
      console.log('Making API calls...');
      const [compData, prodsData, newsData, certsData] = await Promise.all([
        getCompany(),
        getProducts(),
        getNews(),
        getCertificates()
      ]);
      console.log('API calls completed:', { compData, prodsData, newsData, certsData });
      
      // Build base URL for the backend (works in both local dev and production)
      const base = getBaseUrl();
      
      // Normalize company data
      const normalizedComp = compData.data ? {
        ...compData.data,
        heroImage: compData.data.heroImage ? normalizeImageUrl(compData.data.heroImage, base) : null,
        whyChooseUsBackground: compData.data.whyChooseUsBackground
          ? normalizeImageUrl(compData.data.whyChooseUsBackground, base)
          : null,
        ecoFriendlyIcon: compData.data.ecoFriendlyIcon
          ? normalizeImageUrl(compData.data.ecoFriendlyIcon, base)
          : null,
        strengthIcon: compData.data.strengthIcon
          ? normalizeImageUrl(compData.data.strengthIcon, base)
          : null,
        energyIcon: compData.data.energyIcon
          ? normalizeImageUrl(compData.data.energyIcon, base)
          : null,
        deliveryIcon: compData.data.deliveryIcon
          ? normalizeImageUrl(compData.data.deliveryIcon, base)
          : null,
        teamMember1Image: compData.data.teamMember1Image
          ? normalizeImageUrl(compData.data.teamMember1Image, base)
          : null,
        teamMember2Image: compData.data.teamMember2Image
          ? normalizeImageUrl(compData.data.teamMember2Image, base)
          : null,
        teamMember3Image: compData.data.teamMember3Image
          ? normalizeImageUrl(compData.data.teamMember3Image, base)
          : null,
        teamMember4Image: compData.data.teamMember4Image
          ? normalizeImageUrl(compData.data.teamMember4Image, base)
          : null
      } : null;
      
      setCompany(normalizedComp);
      
      // Normalize products
      const normalizedProds = (prodsData.data || []).map(p => ({
        ...p,
        image: p.image ? normalizeImageUrl(p.image, base) : ''
      }));
      setProducts(normalizedProds);
      
      // Normalize news with images
      const normalizedNews = (newsData.data || []).map(n => ({
        ...n,
        image: n.image ? normalizeImageUrl(n.image, base) : null
      }));
      setNews(normalizedNews);
      
      // Normalize certificates with images
      const normalizedCerts = (certsData.data || []).map(c => ({
        ...c,
        image: c.image ? normalizeImageUrl(c.image, base) : null
      }));
      setCertificates(normalizedCerts);
    } catch (e) {
      console.error('Error loading data:', e);
      console.error('Error details:', e.response || e.message);
      setError('Failed to load data. Please check your connection.');
    } finally {
      setLoading(false);
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

  const filterProducts = () => {
    let filtered = products;
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }
    if (searchQuery) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.desc?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFilteredProducts(filtered);
  };

  const handleChat = async () => {
    if (!chatInput.trim() && !chatImage) return;
    const userMsg = { type: 'user', text: chatInput, image: chatImage };
    setChatMessages([...chatMessages, userMsg]);
    setChatInput('');
    setChatImage('');

    try {
      const response = await chatbotQuery(chatInput);
      const botMsg = { type: 'bot', text: response.data.reply };
      setChatMessages(prev => [...prev, botMsg]);
    } catch (e) {
      setChatMessages(prev => [...prev, { type: 'bot', text: 'Sorry, I encountered an error.' }]);
    }
  };

  const handleChatImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setChatImage(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleFeedback = async (e) => {
    e.preventDefault();
    try {
      // In a real app, you'd send this to your backend
      console.log('Feedback submitted:', feedbackForm);
      // await createFeedback(feedbackForm); // Uncomment when backend is ready
      
      setFeedbackSubmitted(true);
      setTimeout(() => {
        setShowFeedback(false);
        setFeedbackSubmitted(false);
        setFeedbackForm({ name: '', email: '', rating: '5', message: '', type: 'general' });
      }, 2000);
    } catch (e) {
      console.error('Error submitting feedback:', e);
      alert('Error submitting feedback');
    }
  };

  const addToCart = (product) => {
    setSelectedProductForOrder(product);
    setOrderForm({ name: '', email: '', phone: '', address: '', city: '', state: '', pincode: '', quantity: 1, productId: product.id, productName: product.name, price: product.price });
    setShowOrderForm(true);
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setOrderLoading(true);
    try {
      // Validation
      if(!orderForm.name?.trim()) {
        alert('❌ Please enter your name');
        setOrderLoading(false);
        return;
      }
      if(!orderForm.email?.trim()) {
        alert('❌ Please enter your email');
        setOrderLoading(false);
        return;
      }
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(orderForm.email)) {
        alert('❌ Please enter valid email format');
        setOrderLoading(false);
        return;
      }
      if(!orderForm.phone?.trim()) {
        alert('❌ Please enter phone number');
        setOrderLoading(false);
        return;
      }
      if(!/^\d{10}$/.test(orderForm.phone)) {
        alert('❌ Phone number must be 10 digits');
        setOrderLoading(false);
        return;
      }
      if(!orderForm.address?.trim()) {
        alert('❌ Please enter delivery address');
        setOrderLoading(false);
        return;
      }
      if(!orderForm.city?.trim()) {
        alert('❌ Please enter city');
        setOrderLoading(false);
        return;
      }
      if(!orderForm.state?.trim()) {
        alert('❌ Please enter state');
        setOrderLoading(false);
        return;
      }
      if(!orderForm.pincode?.trim() || !/^\d{6}$/.test(orderForm.pincode)) {
        alert('❌ Please enter valid 6-digit pincode');
        setOrderLoading(false);
        return;
      }
      if(!orderForm.quantity || parseInt(orderForm.quantity) < 1) {
        alert('❌ Please enter valid quantity');
        setOrderLoading(false);
        return;
      }

      const order = {
        customerName: orderForm.name.trim(),
        customerEmail: orderForm.email.trim(),
        customerPhone: orderForm.phone.trim(),
        address: orderForm.address.trim(),
        city: orderForm.city.trim(),
        state: orderForm.state.trim(),
        pincode: orderForm.pincode.trim(),
        items: [{
          productId: selectedProductForOrder.id,
          productName: selectedProductForOrder.name,
          price: selectedProductForOrder.price,
          quantity: parseInt(orderForm.quantity)
        }],
        totalAmount: selectedProductForOrder.price * parseInt(orderForm.quantity),
        notes: (orderForm.notes || '').trim()
      };

      const response = await createOrder(order);
      alert(`✅ Order Placed Successfully!\n\nOrder ID: ${response.data.id}\nTotal: ₹${response.data.totalAmount}\nDelivery to: ${orderForm.city}, ${orderForm.state}\n\nOur team will contact you soon!`);
      setShowOrderForm(false);
      setOrderForm({ name: '', email: '', phone: '', address: '', city: '', state: '', pincode: '', quantity: 1, notes: '' });
      setSelectedProductForOrder(null);
    } catch (e) {
      console.error('Error placing order:', e);
      alert('❌ Error Placing Order\n\n' + (e.response?.data?.error || e.message || 'Please check your details and try again'));
    } finally {
      setOrderLoading(false);
    }
  };

  const handleEnquiry = async (e) => {
    e.preventDefault();
    try {
      await createEnquiry(enquiryForm);
      alert('Enquiry sent successfully!');
      setEnquiryForm({ name: '', email: '', phone: '', message: '' });
    } catch (e) {
      alert('Error sending enquiry');
    }
  };

  const categories = ['All', ...new Set(products.map(p => p.category))];

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px',
        background: '#f8f9fa'
      }}>
        Loading KG Flyash Bricks...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px',
        background: '#f8f9fa',
        color: '#e74c3c'
      }}>
        <div style={{ textAlign: 'center', maxWidth: '500px' }}>
          <h2>Connection Error</h2>
          <p>{error}</p>
          <button 
            onClick={loadData}
            style={{
              padding: '10px 20px',
              background: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: '20px'
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#fff' }}>
      {/* Navigation */}
      <nav style={{
        background: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
        color: 'white',
        padding: '15px 30px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '1 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <img 
            src={logo} 
            alt="KG Flyash Bricks Logo" 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            style={{ 
              height: '50px', 
              cursor: 'pointer',
              transition: 'transform 0.3s ease, filter 0.3s ease',
              filter: 'brightness(1)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.filter = 'brightness(0.95)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.filter = 'brightness(1)';
            }}
            title="Click to go to top"
          />
          <div style={{ display: 'flex', gap: '30px', fontSize: '14px' }}>
            <a href="#products" style={{ color: 'white', textDecoration: 'none' }}>Products</a>
            <a href="#about" style={{ color: 'white', textDecoration: 'none' }}>About</a>
            <a href="#contact" style={{ color: 'white', textDecoration: 'none' }}>Contact</a>
          </div>
        </div>
      </nav>

      {/* optionally show map to logged-in user */}
      {user && (
        <section style={{ padding: '20px' }}>
          <h3 style={{ textAlign: 'center' }}>Your Map</h3>
          <div ref={mapRef} style={{ width: '100%', height: '300px', border: '1px solid #ccc' }} />
        </section>
      )}

      {/* Hero Section */}
      <section style={{
        backgroundImage: company?.heroImage ? `url(${company.heroImage}), linear-gradient(135deg, rgba(102,126,234,0.8) 0%, rgba(118,75,162,0.8) 100%)` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        color: 'white',
        padding: '80px 30px',
        textAlign: 'center',
        animation: 'fadeIn 0.8s ease-in',
        minHeight: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div>
          <h2 style={{ fontSize: '48px', margin: '0 0 20px 0', fontWeight: 'bold' }}>Premium Eco-Friendly Bricks</h2>
          <p style={{ fontSize: '18px', maxWidth: '600px', margin: '0 auto', opacity: 0.95 }}>
            High-quality flyash bricks for sustainable construction. Trusted by builders across Tamil Nadu since 2008.
          </p>
          <button style={{
            marginTop: '30px',
            padding: '12px 30px',
            background: '#e74c3c',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'transform 0.3s'
          }} onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'} onMouseOut={(e) => e.target.style.transform = 'scale(1)'}>
            Explore Products
          </button>
        </div>
      </section>

      {/* Company Info */}
      <section id="about" data-section="why-choose-us" style={{ 
        padding: '80px 30px', 
        backgroundImage: company?.whyChooseUsBackground ? `linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.92) 100%), url(${company.whyChooseUsBackground})` : 'white',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '48px', marginBottom: '60px', color: '#2c3e50', textAlign: 'center', fontWeight: 'bold' }}>Why Choose Us?</h2>
          <div className="cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '40px' }}>
            {[
              { icon: '♻️', title: 'Eco-Friendly', desc: 'Made from industrial flyash - sustainable & environmentally responsible', image: company?.ecoFriendlyIcon },
              { icon: '💪', title: 'High Strength', desc: 'Superior compressive strength tested for durability', image: company?.strengthIcon },
              { icon: '⚡', title: 'Energy Efficient', desc: 'Excellent thermal insulation reduces cooling costs', image: company?.energyIcon },
              { icon: '🚚', title: 'Fast Delivery', desc: 'Quick delivery across Tamil Nadu in 2-3 days', image: company?.deliveryIcon }
            ].map((item, i) => (
              <div key={i} className="card" style={{
                background: item.image ? `linear-gradient(135deg, rgba(102,126,234,0.85) 0%, rgba(118,75,162,0.85) 100%), url(${item.image})` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                padding: '50px 30px',
                borderRadius: '12px',
                textAlign: 'center',
                boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
                transition: 'all 0.3s ease',
                cursor: 'pointer',
                minHeight: '350px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                position: 'relative',
                overflow: 'hidden'
              }} 
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-15px)';
                e.currentTarget.style.boxShadow = '0 15px 40px rgba(0,0,0,0.25)';
              }} 
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
              }}>
                {/* Background image as backdrop if available */}
                {item.image && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundImage: `url(${item.image})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    opacity: 0.3,
                    zIndex: 0
                  }} />
                )}
                
                {/* Content overlay */}
                <div style={{ position: 'relative', zIndex: 1, width: '100%' }}>
                  <div className="card-image" style={{ fontSize: '60px', marginBottom: '20px', height: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {item.image ? (
                      <img src={item.image} alt={item.title} style={{ maxHeight: '100px', maxWidth: '100%', objectFit: 'contain', filter: 'brightness(1.1) drop-shadow(0 2px 8px rgba(0,0,0,0.3))' }} />
                    ) : (
                      <span>{item.icon}</span>
                    )}
                  </div>
                  <h3 style={{ margin: '20px 0 15px 0', color: 'white', fontSize: '24px', fontWeight: 'bold' }}>{item.title}</h3>
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.95)', fontSize: '15px', lineHeight: '1.6' }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section id="products" style={{ padding: '60px 30px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '32px', marginBottom: '10px', color: '#2c3e50', textAlign: 'center' }}>Our Products</h2>
          
          {/* Search & Filter */}
          <div style={{ marginBottom: '40px', textAlign: 'center' }}>
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                maxWidth: '400px',
                padding: '12px',
                marginBottom: '20px',
                border: '2px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: '8px 16px',
                    background: selectedCategory === cat ? '#667eea' : '#f0f0f0',
                    color: selectedCategory === cat ? 'white' : '#333',
                    border: 'none',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    transition: 'all 0.3s'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Products Grid */}
          <div className="products-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '25px' }}>
            {filteredProducts.map(prod => (
              <div key={prod.id} style={{
                background: 'white',
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                transition: 'transform 0.3s, box-shadow 0.3s',
                cursor: 'pointer'
              }} onClick={() => setSelectedProduct(prod)} onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-10px)';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
              }} onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
              }}>
                {prod.image ? (
                  <div style={{ height: '200px', overflow: 'hidden' }}>
                    <img src={prod.image} alt={prod.name} style={{ width: '100%', height: '200px', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    height: '200px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '40px'
                  }}>📦</div>
                )}
                <div style={{ padding: '20px' }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#2c3e50' }}>{prod.name}</h3>
                  <p style={{ margin: '0 0 10px 0', color: '#666', fontSize: '13px' }}>{prod.desc}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#667eea' }}>₹{prod.price}</span>
                    <span style={{
                      background: prod.stock > 0 ? '#27ae60' : '#e74c3c',
                      color: 'white',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}>
                      {prod.stock > 0 ? 'In Stock' : 'Out'}
                    </span>
                  </div>
                  {prod.rating && <div style={{ marginTop: '8px', fontSize: '12px', color: '#f39c12' }}>⭐ {prod.rating} ({prod.reviews} reviews)</div>}
                  <button 
                    onClick={(e) => { e.stopPropagation(); addToCart(prod); }}
                    style={{
                      width: '100%',
                      marginTop: '15px',
                      padding: '10px',
                      background: 'linear-gradient(135deg, #27ae60 0%, #229954 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '13px',
                      transition: 'opacity 0.3s'
                    }}
                    onMouseOver={(e) => e.target.style.opacity = '0.9'}
                    onMouseOut={(e) => e.target.style.opacity = '1'}
                  >🛒 Order Now</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* News Section */}
      <section style={{ padding: '60px 30px', background: '#f5f5f5' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '32px', marginBottom: '40px', color: '#2c3e50', textAlign: 'center' }}>Latest News</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '25px' }}>
            {news.map(n => (
              <div key={n.id} style={{
                background: 'white',
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                borderLeft: '4px solid #667eea',
                transition: 'transform 0.3s, box-shadow 0.3s'
              }} onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-5px)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.15)';
              }} onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
              }}>
                {n.image && (
                  <div style={{ height: '180px', overflow: 'hidden' }}>
                    <img src={n.image} alt={n.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                <div style={{ padding: '25px' }}>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#2c3e50' }}>{n.title}</h3>
                  <p style={{ margin: '0 0 10px 0', color: '#666', fontSize: '13px', lineHeight: '1.6' }}>{n.content}</p>
                  <p style={{ margin: 0, color: '#999', fontSize: '12px' }}>📰 {new Date(n.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Certifications */}
      <section style={{ padding: '60px 30px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '32px', marginBottom: '40px', color: '#2c3e50' }}>Certifications & Awards</h2>
          <div style={{ display: 'flex', gap: '30px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {certificates.map(c => (
              <div key={c.id} style={{
                background: '#f0f0f0',
                padding: '30px',
                borderRadius: '8px',
                minWidth: '150px',
                textAlign: 'center',
                transition: 'transform 0.3s, box-shadow 0.3s'
              }} onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.15)';
              }} onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}>
                <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                  {c.image ? (
                    <img src={c.image} alt={c.title} style={{ maxHeight: '80px', maxWidth: '100%', objectFit: 'contain' }} />
                  ) : (
                    <div style={{ fontSize: '40px' }}>🏆</div>
                  )}
                </div>
                <h3 style={{ margin: 0, fontSize: '14px', color: '#2c3e50', fontWeight: 'bold' }}>{c.title}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" style={{ padding: '60px 30px', background: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)', color: 'white' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '28px', margin: '0 0 20px 0' }}>Get in Touch</h2>
              <p style={{ margin: '0 0 15px 0', lineHeight: '1.8' }}>
                Have questions? Our team is here to help you find the perfect building materials for your project.
              </p>
              {company && (
                <div style={{ marginTop: '20px' }}>
                  <p style={{ margin: '0 0 10px 0' }}><strong>📍 Address:</strong> {company.address}</p>
                  <p style={{ margin: '0 0 10px 0' }}><strong>📞 Phone:</strong> {company.phone}</p>
                  <p style={{ margin: '0 0 10px 0' }}><strong>✉️ Email:</strong> {company.email}</p>
                  <p style={{ margin: 0 }}><strong>⏰ Hours:</strong> {company.hours}</p>
                </div>
              )}
            </div>
            <form onSubmit={handleEnquiry} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <input
                type="text"
                placeholder="Your Name"
                value={enquiryForm.name}
                onChange={(e) => setEnquiryForm({...enquiryForm, name: e.target.value})}
                required
                style={{ padding: '12px', borderRadius: '4px', border: 'none', fontSize: '14px' }}
              />
              <input
                type="email"
                placeholder="Your Email"
                value={enquiryForm.email}
                onChange={(e) => setEnquiryForm({...enquiryForm, email: e.target.value})}
                required
                style={{ padding: '12px', borderRadius: '4px', border: 'none', fontSize: '14px' }}
              />
              <input
                type="tel"
                placeholder="Your Phone"
                value={enquiryForm.phone}
                onChange={(e) => setEnquiryForm({...enquiryForm, phone: e.target.value})}
                required
                style={{ padding: '12px', borderRadius: '4px', border: 'none', fontSize: '14px' }}
              />
              <textarea
                placeholder="Your Message"
                value={enquiryForm.message}
                onChange={(e) => setEnquiryForm({...enquiryForm, message: e.target.value})}
                required
                rows="4"
                style={{ padding: '12px', borderRadius: '4px', border: 'none', fontSize: '14px', fontFamily: 'Arial' }}
              />
              <button type="submit" style={{
                padding: '12px',
                background: '#e74c3c',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'background 0.3s'
              }} onMouseOver={(e) => e.target.style.background = '#c0392b'} onMouseOut={(e) => e.target.style.background = '#e74c3c'}>
                Send Enquiry
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', padding: '80px 30px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: '32px', color: '#2c3e50', marginBottom: '10px' }}>👥 Our Team</h2>
          <p style={{ textAlign: 'center', color: '#666', marginBottom: '40px', fontSize: '16px' }}>
            Professional team dedicated to serving you with excellence
          </p>

          <div className="team-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '25px' }}>
            {[
              { name: 'Sathish kumar', role: 'CEO', email: 'kgflyash@gmail.com', phone: '+91-96003-72221', avatar: '👨‍💼', image: company?.teamMember1Image },
              { name: 'jegan', role: 'Manager', email: 'jegan@gmail.com', phone: '+91-96003-72225', avatar: '👩‍💼', image: company?.teamMember2Image },
              { name: 'yyy-yyy', role: 'supervisor', email: 'yyy-yyy@kgflyash.com', phone: '+91-98765-43212', avatar: '👨‍🔧', image: company?.teamMember3Image },
              { name: 'Gokul', role: 'Admin', email: 'gokul88644@gmail.com', phone: '+91-90424-88644', avatar: '👩‍💻', image: company?.teamMember4Image }
            ].map((member, idx) => (
              <div key={idx} className="team-member" style={{
                background: 'white',
                borderRadius: '12px',
                padding: '25px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                textAlign: 'center',
                transition: 'transform 0.3s, box-shadow 0.3s'
              }} onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-10px)';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
              }} onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
              }}>
                <div className="team-member-image" style={{ width: '80px', height: '80px', margin: '0 auto 15px', borderRadius: '50%', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {member.image ? (
                    <img src={member.image} alt={member.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ fontSize: '40px' }}>{member.avatar}</div>
                  )}
                </div>
                <h3 style={{ margin: '10px 0', color: '#2c3e50', fontSize: '18px' }}>{member.name}</h3>
                <p style={{ margin: '5px 0', color: '#4d69e3', fontWeight: 'bold', fontSize: '14px' }}>{member.role}</p>
                <p style={{ margin: '8px 0', color: '#666', fontSize: '12px' }}>📧 {member.email}</p>
                <p style={{ margin: '5px 0', color: '#666', fontSize: '12px' }}>📱 {member.phone}</p>
                <button
                  onClick={() => {
                    setEnquiryForm({ name: '', email: '', phone: '', message: `Query for ${member.name}` });
                    document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  style={{
                    marginTop: '15px',
                    padding: '8px 16px',
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                >Contact</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Chatbot Widget */}
      {chatbotOpen && (
        <div style={{
          position: 'fixed',
          bottom: '30px',
          right: '30px',
          width: '350px',
          height: '450px',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 5px 30px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 999
        }}>
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '15px',
          borderRadius: '12px 12px 0 0',
          fontWeight: 'bold',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>💬 Chat with us</span>
          <button onClick={() => setChatbotOpen(false)} style={{
            background: 'none',
            border: 'none',
            color: 'white',
            fontSize: '20px',
            cursor: 'pointer',
            fontWeight: 'bold',
            padding: '0',
            width: '30px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>×</button>
        </div>
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '15px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          {chatMessages.map((msg, i) => (
            <div key={i} style={{
              background: msg.type === 'bot' ? '#f0f0f0' : '#667eea',
              color: msg.type === 'bot' ? '#333' : 'white',
              padding: '10px 15px',
              borderRadius: '8px',
              maxWidth: '80%',
              alignSelf: msg.type === 'bot' ? 'flex-start' : 'flex-end',
              fontSize: '13px',
              wordWrap: 'break-word'
            }}>
              {msg.image && (
                <img src={msg.image} alt="chat" style={{
                  maxWidth: '100%',
                  borderRadius: '4px',
                  marginBottom: msg.text ? '8px' : '0'
                }} />
              )}
              {msg.text}
            </div>
          ))}
        </div>
        <div style={{
          padding: '12px',
          borderTop: '1px solid #ddd',
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-end'
        }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {chatImage && (
              <div style={{
                position: 'relative',
                width: '60px',
                height: '60px',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <img src={chatImage} alt="upload" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button
                  onClick={() => setChatImage('')}
                  style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    background: 'rgba(0,0,0,0.6)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    padding: '0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >×</button>
              </div>
            )}
            <div style={{ display: 'flex', gap: '4px' }}>
              <input
                type="text"
                placeholder="Type a message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleChat()}
                style={{
                  flex: 1,
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '13px'
                }}
              />
              <label style={{ cursor: 'pointer', fontSize: '16px' }}>
                📎
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleChatImageUpload}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>
          <button onClick={handleChat} style={{
            padding: '8px 12px',
            background: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            whiteSpace: 'nowrap'
          }}>Send</button>
        </div>
        </div>
      )}
      {!chatbotOpen && (
        <button
          onClick={() => setChatbotOpen(true)}
          style={{
            position: 'fixed',
            bottom: '30px',
            right: '30px',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            boxShadow: '0 5px 20px rgba(102, 126, 234, 0.4)',
            zIndex: 999
          }}
        >💬</button>
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '40px',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              height: '200px',
              borderRadius: '8px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '60px'
            }}>📦</div>
            <h2 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>{selectedProduct.name}</h2>
            <p style={{ color: '#666', marginBottom: '15px' }}>{selectedProduct.desc}</p>
            <p style={{ fontSize: '24px', color: '#667eea', fontWeight: 'bold', margin: '0 0 15px 0' }}>₹{selectedProduct.price}</p>
            <h4 style={{ margin: '20px 0 10px 0', color: '#2c3e50' }}>Features:</h4>
            <ul style={{ margin: '0 0 20px 0', paddingLeft: '20px', color: '#666' }}>
              {(selectedProduct.features || []).map((f, i) => <li key={i}>{f}</li>)}
            </ul>
            <button onClick={() => setSelectedProduct(null)} style={{
              width: '100%',
              padding: '12px',
              background: '#e74c3c',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}>Close</button>
          </div>
        </div>
      )}

      {/* Feedback Button */}
      <button
        onClick={() => setShowFeedback(true)}
        style={{
          position: 'fixed',
          bottom: '110px',
          right: '30px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)',
          color: 'white',
          border: 'none',
          fontSize: '24px',
          cursor: 'pointer',
          boxShadow: '0 5px 20px rgba(243, 156, 18, 0.4)',
          zIndex: 998,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        title="Send Feedback"
      >💬</button>

      {/* Order Form Modal */}
      {showOrderForm && selectedProductForOrder && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1002,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#2c3e50' }}>🛒 Order {selectedProductForOrder.name}</h2>
              <button
                onClick={() => setShowOrderForm(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666'
                }}
              >×</button>
            </div>

            <form onSubmit={handlePlaceOrder} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {/* Product Info */}
              <div style={{ background: '#f0f0f0', padding: '15px', borderRadius: '8px' }}>
                <p style={{ margin: '0 0 5px 0', fontSize: '13px', color: '#666' }}>Product</p>
                <p style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: 'bold', color: '#2c3e50' }}>{selectedProductForOrder.name}</p>
                <p style={{ margin: '0 0 5px 0', fontSize: '13px', color: '#666' }}>Price: <strong>₹{selectedProductForOrder.price}</strong></p>
              </div>

              {/* Name */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px', color: '#2c3e50' }}>Name *</label>
                <input
                  type="text"
                  required
                  value={orderForm.name}
                  onChange={(e) => setOrderForm({ ...orderForm, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Your name"
                />
              </div>

              {/* Email */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px', color: '#2c3e50' }}>Email *</label>
                <input
                  type="email"
                  required
                  value={orderForm.email}
                  onChange={(e) => setOrderForm({ ...orderForm, email: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: orderForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(orderForm.email) ? '2px solid #e74c3c' : '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="your@email.com"
                />
                {orderForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(orderForm.email) && (
                  <p style={{ color: '#e74c3c', fontSize: '12px', marginTop: '4px' }}>❌ Invalid email format</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px', color: '#2c3e50' }}>Phone *</label>
                <input
                  type="tel"
                  required
                  maxLength="10"
                  value={orderForm.phone}
                  onChange={(e) => setOrderForm({ ...orderForm, phone: e.target.value.replace(/\D/g, '') })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: orderForm.phone && !/^\d{10}$/.test(orderForm.phone) ? '2px solid #e74c3c' : '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="10-digit phone number"
                />
                {orderForm.phone && !/^\d{10}$/.test(orderForm.phone) && (
                  <p style={{ color: '#e74c3c', fontSize: '12px', marginTop: '4px' }}>❌ Phone must be exactly 10 digits</p>
                )}
                {orderForm.phone && /^\d{10}$/.test(orderForm.phone) && (
                  <p style={{ color: '#27ae60', fontSize: '12px', marginTop: '4px' }}>✅ Valid phone number</p>
                )}
              </div>

              {/* Quantity */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px', color: '#2c3e50' }}>Quantity (Units) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={orderForm.quantity}
                  onChange={(e) => setOrderForm({ ...orderForm, quantity: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Address */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px', color: '#2c3e50' }}>Delivery Address *</label>
                <textarea
                  required
                  value={orderForm.address}
                  onChange={(e) => setOrderForm({ ...orderForm, address: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    minHeight: '80px',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                  placeholder="Full delivery address"
                />
              </div>

              {/* City and State */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px', color: '#2c3e50' }}>City *</label>
                  <input
                    type="text"
                    required
                    value={orderForm.city}
                    onChange={(e) => setOrderForm({ ...orderForm, city: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                    placeholder="City name"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px', color: '#2c3e50' }}>State *</label>
                  <input
                    type="text"
                    required
                    value={orderForm.state}
                    onChange={(e) => setOrderForm({ ...orderForm, state: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                    placeholder="State name"
                  />
                </div>
              </div>

              {/* Pincode */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px', color: '#2c3e50' }}>Pincode *</label>
                <input
                  type="text"
                  required
                  maxLength="6"
                  value={orderForm.pincode}
                  onChange={(e) => setOrderForm({ ...orderForm, pincode: e.target.value.replace(/\D/g, '') })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: orderForm.pincode && !/^\d{6}$/.test(orderForm.pincode) ? '2px solid #e74c3c' : '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="6-digit pincode"
                />
                {orderForm.pincode && !/^\d{6}$/.test(orderForm.pincode) && (
                  <p style={{ color: '#e74c3c', fontSize: '12px', marginTop: '4px' }}>❌ Pincode must be exactly 6 digits</p>
                )}
                {orderForm.pincode && /^\d{6}$/.test(orderForm.pincode) && (
                  <p style={{ color: '#27ae60', fontSize: '12px', marginTop: '4px' }}>✅ Valid pincode</p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px', color: '#2c3e50' }}>Special Notes</label>
                <textarea
                  value={orderForm.notes || ''}
                  onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    minHeight: '60px',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                  placeholder="Any special requirements?"
                />
              </div>

              {/* Total */}
              <div style={{ background: '#e8f4f8', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                <p style={{ margin: '0 0 5px 0', fontSize: '13px', color: '#666' }}>Total Amount</p>
                <p style={{ margin: 0, fontSize: '22px', fontWeight: 'bold', color: '#2c3e50' }}>₹{(selectedProductForOrder.price * parseInt(orderForm.quantity || 1)).toFixed(2)}</p>
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="submit"
                  disabled={orderLoading}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: orderLoading ? '#95a5a6' : 'linear-gradient(135deg, #27ae60 0%, #229954 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: orderLoading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    opacity: orderLoading ? 0.7 : 1,
                    transition: 'all 0.3s ease'
                  }}
                >{orderLoading ? '⏳ Placing Order...' : '✅ Place Order'}</button>
                <button
                  type="button"
                  onClick={() => setShowOrderForm(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: '#ecf0f1',
                    color: '#2c3e50',
                    border: '1px solid #bdc3c7',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedback && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#2c3e50' }}>📝 Send Feedback</h2>
              <button
                onClick={() => setShowFeedback(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666'
                }}
              >×</button>
            </div>

            {feedbackSubmitted ? (
              <div style={{
                background: '#d4edda',
                border: '1px solid #c3e6cb',
                color: '#155724',
                padding: '15px',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                ✅ Thank you! Your feedback has been received.
              </div>
            ) : (
              <form onSubmit={handleFeedback} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {/* Feedback Type */}
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px', color: '#2c3e50' }}>
                    Feedback Type
                  </label>
                  <select
                    value={feedbackForm.type}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, type: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="general">General Feedback</option>
                    <option value="bug">Bug Report</option>
                    <option value="feature">Feature Request</option>
                    <option value="complaint">Complaint</option>
                    <option value="suggestion">Suggestion</option>
                  </select>
                </div>

                {/* Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px', color: '#2c3e50' }}>
                    Name
                  </label>
                  <input
                    type="text"
                    required
                    value={feedbackForm.name}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                    placeholder="Your name"
                  />
                </div>

                {/* Email */}
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px', color: '#2c3e50' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={feedbackForm.email}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, email: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                    placeholder="your@email.com"
                  />
                </div>

                {/* Rating */}
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px', color: '#2c3e50' }}>
                    Rating: {feedbackForm.rating} ⭐
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={feedbackForm.rating}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, rating: e.target.value })}
                    style={{
                      width: '100%',
                      cursor: 'pointer'
                    }}
                  />
                </div>

                {/* Message */}
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px', color: '#2c3e50' }}>
                    Message
                  </label>
                  <textarea
                    required
                    value={feedbackForm.message}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, message: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px',
                      minHeight: '120px',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                      resize: 'vertical'
                    }}
                    placeholder="Please share your feedback here..."
                  />
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="submit"
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: 'linear-gradient(135deg, #27ae60 0%, #229954 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 'bold'
                    }}
                  >✉️ Submit Feedback</button>
                  <button
                    type="button"
                    onClick={() => setShowFeedback(false)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: '#ecf0f1',
                      color: '#2c3e50',
                      border: '1px solid #bdc3c7',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 'bold'
                    }}
                  >Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default Home;
