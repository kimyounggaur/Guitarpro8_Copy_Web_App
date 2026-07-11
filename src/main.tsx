import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import "./ui/styles/index.css";
import { applyVisualTestModeMarker } from "./test/testMode";

applyVisualTestModeMarker();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
