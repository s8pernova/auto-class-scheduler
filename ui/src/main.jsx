import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { FilterProvider } from "./contexts/FavoritesContext.jsx";
import { ScheduleFilterProvider } from "./contexts/ScheduleFilterContext.jsx";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
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
