import { apiFetch } from "@/api/http";

export interface FavoriteResponse {
    scheduleId: number;
    favoritedAt: string;
    catalogId?: string | null;
    message: string;
}

export interface FavoriteGeneratedSchedulePayload {
    catalogId: string;
    catalogSectionIds: string[];
}

export async function getFavorites(): Promise<number[]> {
    return apiFetch("/favorites", "Failed to fetch favorites", {
        auth: true,
    });
}

export async function favoriteGeneratedSchedule(
    payload: FavoriteGeneratedSchedulePayload,
): Promise<FavoriteResponse> {
    return apiFetch("/favorites", "Failed to favorite schedule", {
        method: "POST",
        auth: true,
        json: payload,
    });
}

export async function unfavoriteSchedule(
    scheduleId: number | string,
): Promise<{ schedule_id: number | string; message: string }> {
    return apiFetch(
        `/favorites/${scheduleId}`,
        `Failed to unfavorite schedule ${scheduleId}`,
        {
            method: "DELETE",
            auth: true,
        },
    );
}
