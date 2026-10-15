import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/app.css";
import "./styles/catalog.css";
import "./styles/view3d.css";
import "./styles/room-edit.css";
import "./styles/plan-edit.css";
import "./styles/tools.css";
import "./styles/plan-set.css";
import "./styles/update.css";
import { App } from "./App";
import { applySettings } from "./lib/settings";
import { useStore } from "./store/store";
import { newProject } from "./model/project";
import { startAutosave } from "./lib/autosave";

applySettings();
// The first project is created after the language is known, so its name is translated.
useStore.getState().load(newProject(), null);
// Backups of unsaved changes from here on (lib/autosave.ts).
startAutosave();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
