import { useNavigate, useParams, Navigate } from "react-router-dom";
import { useScheduleDraft } from "@/contexts/ScheduleDraftContext";
import Card from "@/components/common/Card";

export default function ScheduleResultsStep() {
    const { catalogId } = useParams<{ catalogId: string }>();
    const { draft } = useScheduleDraft();
    const navigate = useNavigate();

    // Route guard to prevent accessing results without selecting courses
    if (draft.selectedCourses.length === 0) {
        return <Navigate to={`/catalogs/${catalogId}/build`} replace />;
    }

    function handleBack() {
        navigate(`/catalogs/${catalogId}/build`);
    }

    return (
        <div className="grid grid-cols-[288px_1fr_280px] gap-[15px] h-full">
            <aside className="bg-surface rounded-[10px] p-4">
                <h2 className="text-sm font-semibold text-background/60 uppercase tracking-wide mb-3">
                    Filters
                </h2>
                <p className="text-sm text-background/80">
                    Catalog: {draft.catalogId}
                </p>
            </aside>
            <main className="bg-surface rounded-[10px] grid grid-cols-2 grid-rows-6 p-[10px] gap-[10px]">
                <Card />
                <Card />
                <Card />
                <Card />
                <Card />
            </main>
            <aside className="bg-surface rounded-[10px] p-4 flex flex-col gap-4">
                <h2 className="text-sm font-semibold text-background/60 uppercase tracking-wide mb-1">
                    Details
                </h2>
                <div className="mt-auto">
                    <button
                        type="button"
                        onClick={handleBack}
                        className="w-full px-4 py-2 border border-background/20 text-background rounded-md font-semibold hover:bg-background/5 transition-colors"
                    >
                        ← Back to Builder
                    </button>
                </div>
            </aside>
        </div>
    );
}
