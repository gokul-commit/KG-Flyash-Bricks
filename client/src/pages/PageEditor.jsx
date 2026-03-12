import React, { useState, useEffect } from 'react';
import api, { uploadImage, getProducts, getNews, getCertificates, createProduct, updateProduct, deleteProduct, createNews, updateNews, deleteNews, createCertificate, updateCertificate, deleteCertificate, getBaseUrl } from '../api';

function PageEditor({ user, onLogout }) {
  const [currentTab, setCurrentTab] = useState('products');
  const [items, setItems] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(false);
  const [seoMode, setSeoMode] = useState(false);
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('');

  useEffect(() => {
    loadItems();
  }, [currentTab]);

  const loadItems = async () => {
    try {
      setLoading(true);
      let response = { data: [] };
      if (currentTab === 'products') response = await getProducts('published');
      else if (currentTab === 'news') response = await getNews();
      else if (currentTab === 'certificates') response = await getCertificates();
      
      // Normalize image URLs for mobile compatibility
      const base = getBaseUrl();
      const normalizedItems = (Array.isArray(response.data) ? response.data : []).map(item => ({
        ...item,
        image: item.image ? normalizeImageUrl(item.image, base) : item.image
      }));
      
      setItems(normalizedItems);
    } catch (e) {
      console.error('Error loading items:', e);
      setItems([]);
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

  const startEdit = (item) => {
    setEditingItem({
      ...item,
      richContent: item.content || item.desc || '',
      image: item.image || '',
      seo: item.seo || { title: '', description: '', keywords: '' }
    });
    setShowEditor(true);
    setPreview(false);
  };

  const startNew = () => {
    setEditingItem({
      richContent: '',
      image: '',
      seo: { title: '', description: '', keywords: '' },
      draftOnly: true
    });
    setShowEditor(true);
    setPreview(false);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const image = event.target.result;
        const result = await uploadImage(image, file.name);
        // Prefer full url from server (result.data.url). If server returned only filename, construct the URL using base URL.
        let imageUrl = result?.data?.url;
        if (!imageUrl && result?.data?.filename) {
          imageUrl = `${getBaseUrl()}/uploads/${result.data.filename}`;
        }
        setEditingItem({ ...editingItem, image: imageUrl || '' });
      } catch (error) {
        console.error('Upload error:', error);
        alert('Image upload failed');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveItem = async () => {
    if (!editingItem.richContent) {
      alert('Content is required');
      return;
    }

    try {
      setLoading(true);
      const isProduct = currentTab === 'products';
      const isNews = currentTab === 'news';
      const isCert = currentTab === 'certificates';

      if (isProduct) {
        const productData = {
          name: editingItem.name || '',
          desc: editingItem.richContent,
          description: editingItem.richContent,
          category: editingItem.category || 'General',
          price: parseFloat(editingItem.price) || 0,
          stock: parseInt(editingItem.stock) || 0,
          image: editingItem.image || '',
          status: editingItem.draftOnly ? 'draft' : 'published',
          seoMetadata: editingItem.seo || {}
        };

        if (editingItem.id) {
          await updateProduct(editingItem.id, productData);
        } else {
          await createProduct(productData);
        }
      } else if (isNews) {
        const newsData = {
          title: editingItem.title || '',
          content: editingItem.richContent,
          status: editingItem.draftOnly ? 'draft' : 'published',
          seoMetadata: editingItem.seo || {}
        };

        if (editingItem.id) {
          await updateNews(editingItem.id, newsData);
        } else {
          await createNews(newsData);
        }
      } else if (isCert) {
        const certData = {
          name: editingItem.name || editingItem.title || '',
          description: editingItem.richContent,
          image: editingItem.image || '',
          status: editingItem.draftOnly ? 'draft' : 'published',
          seoMetadata: editingItem.seo || {}
        };

        if (editingItem.id) {
          await updateCertificate(editingItem.id, certData);
        } else {
          await createCertificate(certData);
        }
      }

      setShowEditor(false);
      setEditingItem(null);
      await loadItems();
      alert('Item saved successfully!');
    } catch (e) {
      console.error('Save error:', e);
      alert('Error saving: ' + (e.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (id) => {
    if (!window.confirm('Delete this item?')) return;
    try {
      setLoading(true);
      if (currentTab === 'products') {
        await deleteProduct(id);
      } else if (currentTab === 'news') {
        await deleteNews(id);
      } else if (currentTab === 'certificates') {
        await deleteCertificate(id);
      }
      await loadItems();
      alert('Item deleted successfully!');
    } catch (e) {
      console.error('Delete error:', e);
      alert('Error deleting: ' + (e.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f5f5' }}>
      {/* Sidebar */}
      <div style={{ width: '250px', background: '#2c3e50', color: 'white', padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
        <h2 style={{ marginTop: 0 }}>Page Editor</h2>
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '12px', opacity: 0.7 }}>Admin User</p>
          <p style={{ margin: '0', fontSize: '14px', fontWeight: 'bold' }}>{user.username}</p>
        </div>

        <div style={{ marginBottom: '30px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <h4 style={{ fontSize: '12px', textTransform: 'uppercase', opacity: 0.7, margin: '0 0 15px 0' }}>Edit Pages</h4>
          {['products', 'news', 'certificates'].map(tab => (
            <button
              key={tab}
              onClick={() => setCurrentTab(tab)}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 15px',
                marginBottom: '8px',
                background: currentTab === tab ? '#3498db' : 'transparent',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '14px'
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <button
          onClick={onLogout}
          style={{
            width: '100%',
            padding: '10px 15px',
            background: '#e74c3c',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Logout
        </button>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '30px' }}>
        <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', padding: '30px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
            <h1 style={{ margin: '0', fontSize: '28px', color: '#2c3e50' }}>
              {currentTab.charAt(0).toUpperCase() + currentTab.slice(1)} Editor
            </h1>
            <button
              onClick={startNew}
              style={{
                padding: '10px 20px',
                background: '#27ae60',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              + New {currentTab.slice(0, -1)}
            </button>
          </div>

          {/* Item List */}
          {!showEditor ? (
            <div>
              {loading ? (
                <p>Loading...</p>
              ) : items.length === 0 ? (
                <p style={{ color: '#666', textAlign: 'center', padding: '40px' }}>No items yet</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                  {items.map(item => (
                    <div key={item.id} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '15px', background: '#fafafa' }}>
                      {item.image && <img src={item.image} alt="" style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '4px', marginBottom: '10px' }} />}
                      <h3 style={{ margin: '10px 0', fontSize: '16px' }}>{item.name || item.title}</h3>
                      <p style={{ margin: '0 0 10px 0', color: '#666', fontSize: '13px' }}>{item.desc || item.content || ''}</p>
                      <p style={{ margin: '0 0 10px 0', fontSize: '12px' }}>
                        <span style={{ background: item.status === 'published' ? '#27ae60' : '#f39c12', color: 'white', padding: '2px 8px', borderRadius: '3px' }}>
                          {item.status || 'published'}
                        </span>
                      </p>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          onClick={() => startEdit(item)}
                          style={{
                            flex: 1,
                            padding: '8px',
                            background: '#3498db',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          style={{
                            flex: 1,
                            padding: '8px',
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
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Editor Mode */
            <div>
              {preview ? (
                <div style={{ marginBottom: '20px' }}>
                  <h2>Preview</h2>
                  {editingItem.image && <img src={editingItem.image} alt="preview" style={{ maxWidth: '400px', marginBottom: '20px', borderRadius: '4px' }} />}
                  <h3>{editingItem.name || editingItem.title}</h3>
                  <div style={{ background: '#f9f9f9', padding: '15px', borderRadius: '4px', marginBottom: '20px', lineHeight: '1.6' }}>
                    {editingItem.richContent}
                  </div>
                  {editingItem.seo?.title && (
                    <div style={{ background: '#e8f4f8', padding: '15px', borderRadius: '4px', marginBottom: '20px', fontSize: '13px' }}>
                      <strong>SEO Title:</strong> {editingItem.seo.title}<br />
                      <strong>SEO Description:</strong> {editingItem.seo.description}<br />
                      <strong>Keywords:</strong> {editingItem.seo.keywords}
                    </div>
                  )}
                  <button onClick={() => setPreview(false)} style={{ padding: '10px 20px', background: '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    Back to Editing
                  </button>
                </div>
              ) : (
                <form>
                  {/* Title */}
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}>Title / Name</label>
                    <input
                      type="text"
                      value={editingItem.name || editingItem.title || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, [currentTab === 'products' ? 'name' : 'title']: e.target.value })}
                      style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* Image Upload */}
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}>Image</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      style={{ marginBottom: '10px' }}
                    />
                    {editingItem.image && (
                      <img src={editingItem.image} alt="preview" style={{ maxWidth: '200px', borderRadius: '4px' }} />
                    )}
                  </div>

                  {/* Rich Text Content */}
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}>Content</label>
                    <textarea
                      value={editingItem.richContent}
                      onChange={(e) => setEditingItem({ ...editingItem, richContent: e.target.value })}
                      style={{
                        width: '100%',
                        minHeight: '200px',
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '14px',
                        fontFamily: 'monospace',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Additional Fields for Products */}
                  {currentTab === 'products' && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}>Price</label>
                          <input
                            type="number"
                            value={editingItem.price || ''}
                            onChange={(e) => setEditingItem({ ...editingItem, price: parseFloat(e.target.value) })}
                            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}>Stock</label>
                          <input
                            type="number"
                            value={editingItem.stock || ''}
                            onChange={(e) => setEditingItem({ ...editingItem, stock: parseInt(e.target.value) })}
                            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* SEO Settings */}
                  <div style={{ background: '#f9f9f9', padding: '15px', borderRadius: '4px', marginBottom: '20px' }}>
                    <button
                      type="button"
                      onClick={() => setSeoMode(!seoMode)}
                      style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#2c3e50',
                        paddingLeft: 0
                      }}
                    >
                      {seoMode ? '▼' : '▶'} SEO Settings
                    </button>

                    {seoMode && (
                      <div style={{ marginTop: '15px' }}>
                        <div style={{ marginBottom: '10px' }}>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '3px' }}>Meta Title</label>
                          <input
                            type="text"
                            maxLength="60"
                            value={editingItem.seo?.title || ''}
                            onChange={(e) => setEditingItem({ ...editingItem, seo: { ...editingItem.seo, title: e.target.value } })}
                            placeholder="60 chars"
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '3px' }}>Meta Description</label>
                          <input
                            type="text"
                            maxLength="160"
                            value={editingItem.seo?.description || ''}
                            onChange={(e) => setEditingItem({ ...editingItem, seo: { ...editingItem.seo, description: e.target.value } })}
                            placeholder="160 chars"
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '3px' }}>Keywords</label>
                          <input
                            type="text"
                            value={editingItem.seo?.keywords || ''}
                            onChange={(e) => setEditingItem({ ...editingItem, seo: { ...editingItem.seo, keywords: e.target.value } })}
                            placeholder="keyword1, keyword2, keyword3"
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Scheduling */}
                  <div style={{ background: '#f9f9f9', padding: '15px', borderRadius: '4px', marginBottom: '20px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={scheduleMode}
                        onChange={(e) => setScheduleMode(e.target.checked)}
                        style={{ marginRight: '10px' }}
                      />
                      <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Schedule Publishing</span>
                    </label>

                    {scheduleMode && (
                      <div style={{ marginTop: '10px' }}>
                        <input
                          type="datetime-local"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Status and Actions */}
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={editingItem.draftOnly}
                        onChange={(e) => setEditingItem({ ...editingItem, draftOnly: e.target.checked })}
                        style={{ marginRight: '10px' }}
                      />
                      <span style={{ fontSize: '13px' }}>Save as Draft</span>
                    </label>
                  </div>

                  {/* Buttons */}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setPreview(true)}
                      style={{
                        padding: '10px 20px',
                        background: '#9b59b6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveItem}
                      disabled={loading}
                      style={{
                        padding: '10px 20px',
                        background: '#27ae60',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        opacity: loading ? 0.6 : 1
                      }}
                    >
                      {loading ? 'Saving...' : 'Save & Publish'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEditor(false)}
                      style={{
                        padding: '10px 20px',
                        background: '#95a5a6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PageEditor;
