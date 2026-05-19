import { Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Loading from "@/components/Loading";
import { appRoutes, fallbackRoutes } from "@/routes/appRoutes";

function App() {
    return (
        <Suspense fallback={<Loading />}>
            <Routes>
                {appRoutes.map((route) => (
                    <Route
                        key={route.path}
                        path={route.path}
                        element={<route.Component />}
                    />
                ))}
                {fallbackRoutes.map((route) => (
                    <Route
                        key={route.path}
                        path={route.path}
                        element={<route.Component />}
                    />
                ))}
            </Routes>
        </Suspense>
    )
}

export default App;