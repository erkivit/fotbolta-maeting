import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import Landing from "./Landing.jsx";

// Einföld beining: /sunnudagsbolti sýnir appið, allt annað sýnir bara myndina.
const path = window.location.pathname.replace(/\/+$/, "") || "/";
const Component = path === "/sunnudagsbolti" ? App : Landing;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Component />
  </React.StrictMode>
);
