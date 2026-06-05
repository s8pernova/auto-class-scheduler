import { healthCheckApiV1HealthGet } from "@/api/generated";
import type { HealthCheckApiV1HealthGetResponse } from "@/api/generated";
import { unwrapApiResult } from "@/api/http";

export async function healthCheck(): Promise<HealthCheckApiV1HealthGetResponse> {
    return unwrapApiResult(
        await healthCheckApiV1HealthGet(),
        "Health check failed",
    );
}
