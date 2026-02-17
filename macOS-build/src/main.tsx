import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { SettingsPage } from "./pages/SettingsPage";
import { KeywordManagerPage } from "./pages/KeywordManagerPage";
import "./index.css";

// 해시 라우팅으로 페이지 선택 (쿼리 파라미터 제거)
const hash = window.location.hash.split('?')[0];

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {hash === '#settings' ? <SettingsPage /> : 
     hash === '#keywords' ? <KeywordManagerPage /> : 
     <App />}
  </React.StrictMode>,
);
