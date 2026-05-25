import { Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import {
    authRoutes,
    fallbackRoutes,
    CatalogCreatePage,
    CatalogWizardShell,
    ScheduleRequestStep,
    InstructorRatings,
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

                {/* Wizard routes */}
                <Route element={<WizardLayout />}>
                    <Route
                        path="/catalogs/new"
                        element={<CatalogCreatePage />}
                    />
                    <Route
                        path="/catalogs/:catalogId"
                        element={<CatalogWizardShell />}
                    >
                        <Route
                            index
                            element={<Navigate to="build" replace />}
                        />
                        <Route path="build" element={<ScheduleRequestStep />} />
                        <Route
                            path="instructors"
                            element={<InstructorRatings />}
                        />
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
