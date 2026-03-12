import React, {useState} from 'react';
import ProductModal from './ProductModal';

export default function Products({ products, token, refresh, onEnquiry }){
  const [selected, setSelected] = useState(null);
  const [cart, setCart] = useState([]);

  function add(p){
    if(!cart.find(x=>x.id===p.id)) setCart(prev=>[...prev,p]);
  }
  return (
    <div>
      <div className="grid3">
        {products.map(p=>(
          <div key={p.id} className="card">
            {p.image && <img src={p.image} alt={p.name} style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '4px', marginBottom: '10px' }} />}
            <div><strong>{p.name}</strong></div>
            <div style={{color:'#6b7280'}}>{p.desc}</div>
            <div style={{marginTop:8}}>₹{p.price} | Stock: {p.stock}</div>
            <div style={{marginTop:8}}><button onClick={()=>setSelected(p)} className="btn">View</button> <button style={{marginLeft:6}} onClick={()=>add(p)}>Add to Enquiry</button></div>
          </div>
        ))}
      </div>
      <div style={{marginTop:12}} className="card">
        <div>{cart.length} products selected. <button className="btn" onClick={()=> onEnquiry(cart)}>Send Enquiry</button></div>
      </div>
      {selected && <ProductModal p={selected} onClose={()=>setSelected(null)} />}
    </div>
  );
}
