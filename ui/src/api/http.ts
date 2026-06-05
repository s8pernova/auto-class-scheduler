import { supabase } from "@/clients/supabaseClient";

export const BASE_URL = "/api/v1";

type ApiRequestOptions = Omit<RequestInit, "body" | "headers"> & {
    auth?: boolean;
    body?: BodyInit | null;
    headers?: HeadersInit;
    json?: unknown;
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
    response: Response,
    fallback: string,
): Promise<string> {
    try {
        const body: unknown = await response.json();
        const detail = isRecord(body)
            ? formatApiErrorDetail(body.detail)
            : null;

        if (detail) {
            return `${fallback}: ${detail}`;
        }
    } catch {
        // Fall back to the status text below when the response is not JSON.
    }

    return `${fallback}: ${response.statusText}`;
}

export async function buildAuthHeaders(): Promise<HeadersInit> {
    const {
        data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};
}

export async function apiFetch<T>(
    path: string,
    fallback: string,
    options: ApiRequestOptions = {},
): Promise<T> {
    const { auth = false, body, headers, json, ...init } = options;
    const requestHeaders = new Headers(headers);
    const requestBody = json === undefined ? body : JSON.stringify(json);

    if (json !== undefined) {
        requestHeaders.set("Content-Type", "application/json");
    }

    if (auth) {
        const authHeaders = new Headers(await buildAuthHeaders());
        authHeaders.forEach((value, key) => requestHeaders.set(key, value));
    }

    const response = await fetch(`${BASE_URL}${path}`, {
        ...init,
        body: requestBody,
        headers: requestHeaders,
    });

    if (!response.ok) {
        throw new Error(await buildApiErrorMessage(response, fallback));
    }

    return response.json();
}
