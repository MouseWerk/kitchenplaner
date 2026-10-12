import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/app.css";
import "./styles/view3d.css";
import { App } from "./App";
import { applySettings } from "./lib/settings";
import { useStore } from "./store/store";
import { newProject } from "./model/project";

applySettings();
// The first project is created after the language is known, so its name is translated.
useStore.getState().load(newProject(), null);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
