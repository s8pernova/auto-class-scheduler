import {
    favoriteGeneratedScheduleApiV1FavoritesPost,
    unfavoriteScheduleApiV1FavoritesScheduleIdDelete,
} from "@/api/generated";
import type {
    FavoriteGeneratedScheduleApiV1FavoritesPostResponse,
    FavoriteGeneratedScheduleRequest,
    FavoriteResponse,
    UnfavoriteScheduleApiV1FavoritesScheduleIdDeleteResponse,
} from "@/api/generated";
import { getRequiredAccessToken, unwrapApiResult } from "@/api/http";

export type FavoriteGeneratedSchedulePayload = FavoriteGeneratedScheduleRequest;

export type { FavoriteGeneratedScheduleRequest, FavoriteResponse };

export async function favoriteGeneratedSchedule(
    payload: FavoriteGeneratedSchedulePayload,
): Promise<FavoriteGeneratedScheduleApiV1FavoritesPostResponse> {
    return unwrapApiResult(
        await favoriteGeneratedScheduleApiV1FavoritesPost({
            auth: getRequiredAccessToken,
            body: payload,
        }),
        "Failed to favorite schedule",
    );
}

export async function unfavoriteSchedule(
    scheduleId: number,
): Promise<UnfavoriteScheduleApiV1FavoritesScheduleIdDeleteResponse> {
    return unwrapApiResult(
        await unfavoriteScheduleApiV1FavoritesScheduleIdDelete({
            auth: getRequiredAccessToken,
            path: { schedule_id: scheduleId },
        }),
        `Failed to unfavorite schedule ${scheduleId}`,
    );
}
