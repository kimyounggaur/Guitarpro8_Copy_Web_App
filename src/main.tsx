import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import "./ui/styles/index.css";
import { applyE2eTestMode, applyVisualTestModeMarker } from "./test/testMode";

applyVisualTestModeMarker();
void applyE2eTestMode();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
