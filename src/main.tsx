import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { SettingsPage } from "./pages/SettingsPage";
import { KeywordManagerPage } from "./pages/KeywordManagerPage";
import "./index.css";
import { getCurrentWindow } from "@tauri-apps/api/window";

// 창 라벨 기반 라우팅 (hash 라우팅 폴백 포함)
const windowLabel = getCurrentWindow().label;
const hash = window.location.hash.split('?')[0];

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {windowLabel === 'settings' || hash === '#settings' ? <SettingsPage /> : 
     windowLabel === 'keywords' || hash === '#keywords' ? <KeywordManagerPage /> : 
     <App />}
  </React.StrictMode>,
);
