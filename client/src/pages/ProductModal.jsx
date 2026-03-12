import React from 'react';

export default function ProductModal({ p, onClose }){
  return (
    <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000}}>
      <div style={{background: 'white', borderRadius: '8px', padding: '30px', maxWidth: '500px', width: '90%', maxHeight: '80vh', overflowY: 'auto', position: 'relative'}}>
        <button onClick={onClose} style={{position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer'}}>✕</button>
        {p.image && <img src={p.image} alt={p.name} style={{width: '100%', height: '250px', objectFit: 'cover', borderRadius: '8px', marginBottom: '20px'}} />}
        <h2 style={{color: '#2c3e50', marginBottom: '15px'}}>{p.name}</h2>
        <p style={{color: '#666', marginBottom: '15px'}}>{p.desc}</p>
        <p style={{fontSize: '20px', fontWeight: 'bold', color: '#e74c3c', marginBottom: '10px'}}>Price: ₹{p.price}</p>
        <p style={{color: '#27ae60', marginBottom: '20px'}}>Stock Available: {p.stock}</p>
        {p.features && (
          <div style={{marginBottom: '20px'}}>
            <h4 style={{color: '#2c3e50', marginBottom: '10px'}}>Features:</h4>
            <ul style={{color: '#666'}}>
              {p.features.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          </div>
        )}
        <button style={{width: '100%', padding: '12px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px'}}>Add to Enquiry</button>
      </div>
    </div>
  );
}
