import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { applyProductionMetadata } from './config/production';
import './index.css';

applyProductionMetadata();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
