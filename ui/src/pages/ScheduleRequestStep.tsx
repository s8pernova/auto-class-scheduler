import { useNavigate, useParams } from "react-router-dom";
import { useScheduleDraft } from "@/contexts/ScheduleDraftContext";

export default function ScheduleRequestStep() {
    const { catalogId } = useParams<{ catalogId: string }>();
    const { draft } = useScheduleDraft();
    const navigate = useNavigate();

    function handleGenerate() {
        navigate(`/catalogs/${catalogId}/results`);
    }

    return (
        <div className="grid grid-cols-[288px_1fr] gap-[15px] h-full">
            <aside className="bg-surface rounded-[10px] p-4">
                <h2 className="text-sm font-semibold text-background/60 uppercase tracking-wide mb-3">
                    Catalog
                </h2>
                <p className="text-sm text-background/80">
                    ID: {draft.catalogId}
                </p>
            </aside>
            <main className="bg-surface rounded-[10px] p-6 flex flex-col gap-4">
                <h1 className="text-xl font-semibold text-background">
                    Build Your Schedule
                </h1>
                <p className="text-background/60">
                    Choose your required courses, elective pools, and
                    preferences. Then generate possible schedules.
                </p>
                <div className="mt-auto flex justify-end">
                    <button
                        type="button"
                        onClick={handleGenerate}
                        className="px-5 py-2 bg-accent text-white rounded-md font-semibold hover:bg-accent/90 transition-colors"
                    >
                        Generate Schedules →
                    </button>
                </div>
            </main>
        </div>
    );
}
