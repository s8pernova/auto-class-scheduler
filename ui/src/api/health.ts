import { apiFetch } from "@/api/http";

export async function healthCheck() {
    return apiFetch("/health", "Health check failed");
}
