import { supabase } from "@/clients/supabaseClient";

type ApiResult<T> =
    | {
          data: T;
          error: undefined;
          response: Response;
      }
    | {
          data: undefined;
          error: unknown;
          response?: Response;
      };

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function formatApiErrorDetail(detail: unknown): string | null {
    if (typeof detail === "string") {
        return detail;
    }

    if (!Array.isArray(detail)) {
        return null;
    }

    const messages = detail
        .map((item) => {
            if (typeof item === "string") {
                return item;
            }
            if (!isRecord(item) || typeof item.msg !== "string") {
                return null;
            }

            const location = Array.isArray(item.loc)
                ? item.loc
                      .filter(
                          (part) =>
                              typeof part === "string" ||
                              typeof part === "number",
                      )
                      .join(".")
                : "";

            return location ? `${location}: ${item.msg}` : item.msg;
        })
        .filter((message): message is string => Boolean(message));

    return messages.length > 0 ? messages.join("; ") : null;
}

export async function buildApiErrorMessage(
    response: Response | undefined,
    fallback: string,
    body?: unknown,
): Promise<string> {
    const detail = isRecord(body) ? formatApiErrorDetail(body.detail) : null;

    if (detail) {
        return `${fallback}: ${detail}`;
    }

    if (typeof body === "string" && body.trim()) {
        return `${fallback}: ${body}`;
    }

    if (body instanceof Error && body.message) {
        return `${fallback}: ${body.message}`;
    }

    if (isRecord(body) && typeof body.message === "string") {
        return `${fallback}: ${body.message}`;
    }

    return response?.statusText ? `${fallback}: ${response.statusText}` : fallback;
}

export async function getAccessToken(): Promise<string | undefined> {
    const {
        data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token;
}

export async function unwrapApiResult<T>(
    result: ApiResult<T>,
    fallback: string,
): Promise<T> {
    if (result.error === undefined) {
        return result.data as T;
    }

    throw new Error(
        await buildApiErrorMessage(result.response, fallback, result.error),
    );
}
