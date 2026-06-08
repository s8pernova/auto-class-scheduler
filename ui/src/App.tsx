import { Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import {
    authRoutes,
    fallbackRoutes,
    CatalogCreatePage,
    CatalogFlowShell,
    CatalogWizardShell,
    SharedCatalogPage,
    ScheduleRequestStep,
    ScheduleResultsStep,
    WizardLayout,
} from "@/routes/appRoutes";
import Loading from "@/components/common/Loading";
import Layout from "@/components/layouts/Default";

function App() {
    return (
        <Suspense fallback={<Loading />}>
            <Routes>
                {/* Root redirect */}
                <Route
                    path="/"
                    element={<Navigate to="/catalogs/new" replace />}
                />

                {/* Catalog flow routes */}
                <Route element={<WizardLayout />}>
                    <Route
                        path="/c/:shareSlug"
                        element={<SharedCatalogPage />}
                    />
                    <Route
                        path="/catalogs/new"
                        element={<CatalogCreatePage />}
                    />
                    <Route
                        path="/catalogs/:catalogId"
                        element={<CatalogFlowShell />}
                    >
                        <Route
                            index
                            element={<Navigate to="build" replace />}
                        />
                        <Route element={<CatalogWizardShell />}>
                            <Route
                                path="build"
                                element={<ScheduleRequestStep />}
                            />
                            <Route
                                path="instructors"
                                element={<Navigate to="../build" replace />}
                            />
                        </Route>
                        <Route
                            path="results"
                            element={<ScheduleResultsStep />}
                        />
                    </Route>
                </Route>

                {/* Auth routes */}
                {authRoutes.map((route) => (
                    <Route element={<Layout />} key={route.path}>
                        <Route
                            path={route.path}
                            element={<route.Component />}
                        />
                    </Route>
                ))}

                {/* Fallback */}
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
