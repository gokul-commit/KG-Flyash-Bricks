(async ()=>{
  const hosts = ['127.0.0.1','localhost','0.0.0.0','::1'];
  const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

  for(const h of hosts){
    const API = `http://${h}:4000/api`;
    try{
      console.log('\nTrying host:', h);
      console.log('Logging in as admin...');
      const loginRes = await fetch(`${API}/auth/admin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin' }),
      });
      if(!loginRes.ok) throw new Error(`Login failed: ${loginRes.status}`);
      const loginData = await loginRes.json();
      const token = loginData.token;
      console.log('Got token:', !!token);

      console.log('Uploading sample image...');
      const uploadRes = await fetch(`${API}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ image: dataUrl, filename: 'test.png' })
      });
      if(!uploadRes.ok){
        const txt = await uploadRes.text();
        throw new Error(`Upload failed: ${uploadRes.status} ${txt}`);
      }
      const uploadData = await uploadRes.json();
      console.log('Upload response:', uploadData);

      if(uploadData && uploadData.url){
        console.log('Verifying uploaded URL...');
        const fileRes = await fetch(uploadData.url);
        if(!fileRes.ok) throw new Error(`Fetching uploaded file failed: ${fileRes.status}`);
        const buf = await fileRes.arrayBuffer();
        console.log('Fetched uploaded file, size (bytes):', buf.byteLength);
        process.exit(0);
      } else {
        console.error('Upload did not return a URL');
      }
    }catch(e){
      console.error('Host', h, 'failed:', e.message || e, e.stack ? '\n'+e.stack : '');
      // try next host
    }
  }
  console.error('\nAll hosts failed. Please ensure server is running and accessible on port 4000.');
  process.exit(1);
})();