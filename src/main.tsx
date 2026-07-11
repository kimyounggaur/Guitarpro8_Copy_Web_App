import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import "./App.css";
import "./test/visual/screenshot.css";
import { applyVisualTestModeMarker } from "./test/testMode";

applyVisualTestModeMarker();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
