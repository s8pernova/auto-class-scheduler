import type { ScheduleDraft } from "@/contexts/ScheduleDraftContext";
import { getScheduleLimits } from "@/api/client";

export async function validateScheduleDrafts(
    draft: ScheduleDraft,
): Promise<string[]> {
    const limits = await getScheduleLimits();
    const errors: string[] = [];

    if (draft.requirementCourses.length > limits.maxCatalogCourses) {
        errors.push(
            `Too many courses. You can add up to ${limits.maxCatalogCourses} course requirements.`,
        );
    }

    return errors;
}
