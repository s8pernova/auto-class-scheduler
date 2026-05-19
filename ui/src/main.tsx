import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { FilterProvider } from "./contexts/FavoritesContext";
import { ScheduleFilterProvider } from "./contexts/ScheduleFilterContext";
import App from "./App";
import "./App.css";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <BrowserRouter>
            <FilterProvider>
                <ScheduleFilterProvider>
                    <App />
                </ScheduleFilterProvider>
            </FilterProvider>
        </BrowserRouter>
    </StrictMode>
);
