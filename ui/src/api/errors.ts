export class ApiError extends Error {
    readonly status: number | undefined;
    readonly code: string | undefined;

    constructor(
        message: string,
        options: { status?: number; code?: string } = {},
    ) {
        super(message);
        this.name = "ApiError";
        this.status = options.status;
        this.code = options.code;
    }
}
