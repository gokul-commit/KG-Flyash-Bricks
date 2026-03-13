import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// Fix Leaflet marker icon paths when bundling with Vite (prevents 404s)
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

createRoot(document.getElementById('root')).render(<App />);
