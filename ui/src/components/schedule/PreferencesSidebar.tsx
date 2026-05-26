import type { SchedulePreferences } from "@/contexts/ScheduleDraftContext";

type PreferencesSidebarProps = {
    preferences: SchedulePreferences;
    onUpdatePreferences: (patch: Partial<SchedulePreferences>) => void;
};

export function PreferencesSidebar({
    preferences,
    onUpdatePreferences,
}: PreferencesSidebarProps) {
    return (
        <aside className="bg-surface rounded-[10px] p-4">
            <div>
                <h2 className="text-sm font-semibold text-background/60 uppercase tracking-wide mb-3">
                    Selected Section
                </h2>
            </div>

            <div>
                <h2 className="text-sm font-semibold text-background/60 uppercase tracking-wide mb-3">
                    Preferences
                </h2>
                <div className="flex flex-col gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={preferences.allowFullSections || false}
                            onChange={(e) =>
                                onUpdatePreferences({
                                    allowFullSections: e.target.checked,
                                })
                            }
                        />
                        <span className="text-sm">Allow full sections</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={
                                preferences.allowRestrictedSections || false
                            }
                            onChange={(e) =>
                                onUpdatePreferences({
                                    allowRestrictedSections: e.target.checked,
                                })
                            }
                        />
                        <span className="text-sm">
                            Allow restricted sections
                        </span>
                    </label>
                </div>
            </div>
        </aside>
    );
}
