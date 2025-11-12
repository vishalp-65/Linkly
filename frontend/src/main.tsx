import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import BackendHealthCheck from './components/BackendHealthCheck.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BackendHealthCheck>
      <App />
    </BackendHealthCheck>
  </StrictMode>
);
