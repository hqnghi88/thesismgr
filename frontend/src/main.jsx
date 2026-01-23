import React from 'react';
import ReactDOM from 'react-dom/client'     // used to render your React components into the real HTML DOM
import App from './App.jsx'


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
