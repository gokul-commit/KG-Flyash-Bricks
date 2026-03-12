import React, { useState } from 'react';
import { chatbotQuery } from '../api';

export default function Chatbot(){
  const [msgs, setMsgs] = useState([{from:'bot', text:'Welcome to KG Flyash! How can I help you today?'}]);
  const [t, setT] = useState('');
  const [loading, setLoading] = useState(false);

  async function send(){
    const txt = t.trim();
    if(!txt) return;
    
    setMsgs(prev=>[...prev, {from:'user', text:txt}]);
    setT('');
    setLoading(true);
    
    try {
      const response = await chatbotQuery(txt);
      setMsgs(prev=>[...prev, {from:'bot', text: response.data.answer}]);
    } catch(e) {
      setMsgs(prev=>[...prev, {from:'bot', text: 'Sorry, I couldn\'t process that. Please try again.'}]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{position:'fixed', right:20, bottom:20, width:350, background:'#fff', boxShadow:'0 8px 24px rgba(0,0,0,.12)', borderRadius:8, display:'flex', flexDirection:'column', height:500}}>
      <div style={{background:'#667eea', color:'#fff', padding:12, borderRadius:'8px 8px 0 0', fontWeight:'bold'}}>💬 KG Flyash Assistant</div>
      <div style={{flex:1, overflowY:'auto', padding:12, display:'flex', flexDirection:'column', gap:8}}>
        {msgs.map((m,i)=> (
          <div key={i} style={{textAlign: m.from==='bot'? 'left':'right', display:'flex', justifyContent:m.from==='bot'? 'flex-start':'flex-end'}}>
            <div style={{maxWidth:'80%', padding:'8px 12px', borderRadius:8, background:m.from==='bot'?'#f0f0f0':'#667eea', color:m.from==='bot'?'#333':'white', fontSize:'13px'}}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && <div style={{fontSize:'13px', color:'#999'}}>Bot is thinking...</div>}
      </div>
      <div style={{borderTop:'1px solid #eee', padding:8, display:'flex', gap:8}}>
        <input 
          type='text' 
          placeholder='Ask a question...' 
          value={t} 
          onChange={e=>setT(e.target.value)}
          onKeyPress={e=>e.key==='Enter' && send()}
          style={{flex:1, padding:'8px', border:'1px solid #ddd', borderRadius:4, fontSize:'12px'}}
          disabled={loading}
        />
        <button onClick={send} disabled={loading} style={{padding:'8px 12px', background:'#667eea', color:'#fff', border:'none', borderRadius:4, cursor:'pointer', fontWeight:'bold', fontSize:'12px'}}>Send</button>
      </div>
    </div>
  );
}
      <div style={{padding:8, display:'flex', gap:8}}>
        <input value={t} onChange={e=>setT(e.target.value)} placeholder="Ask something" />
        <button onClick={send} className="btn">Ask</button>
      </div>
    </div>
  );
}

