import { Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { appRoutes, fallbackRoutes } from "@/routes/appRoutes";
import Loading from "@/components/common/Loading";
import Layout from "@/components/layouts/Default";

function App() {
    return (
        <Suspense fallback={<Loading />}>
            <Routes>
                {appRoutes.map((route) => (
                    <Route element={<Layout />}>
                        <Route
                            key={route.path}
                            path={route.path}
                            element={<route.Component />}
                        />
                    </Route>
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
    );
}

export default App;
