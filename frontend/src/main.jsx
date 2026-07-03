/**
 * Application entry point.
 * React mounts the <App> component into the <div id="root"> in index.html.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App";
import "./index.css"; // Tailwind base styles

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

// GoogleOAuthProvider is only mounted when a real client ID is configured.
// When VITE_GOOGLE_CLIENT_ID is absent, the provider is never mounted and
// GoogleLoginButton (which calls useGoogleLogin) is never rendered — no crash.
const root = GOOGLE_CLIENT_ID ? (
  <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <App />
  </GoogleOAuthProvider>
) : (
  <App />
);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>{root}</React.StrictMode>
);
