/**
 * Application entry point.
 * React mounts the <App> component into the <div id="root"> in index.html.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css"; // Tailwind base styles

ReactDOM.createRoot(document.getElementById("root")).render(
  // StrictMode runs each component twice in development to surface bugs early.
  // This is automatically disabled in the production build.
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
