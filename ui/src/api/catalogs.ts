import { apiFetch } from "@/api/http";

interface CreateCatalogPayload {
    name: string;
    description?: string | null;
    source_type?: string;
    school_name?: string | null;
    term_name?: string | null;
}

export interface CatalogResponse {
    id: string;
    name: string;
    description: string | null;
    source_type: string;
    school_name: string | null;
    term_name: string | null;
    status: string;
    row_count: number;
    source_metadata: Record<string, unknown>;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    last_imported_at: string | null;
}

export interface CatalogSectionMeetingInput {
    days: string;
    startTime: string;
    endTime: string;
    sortOrder?: number;
}

export interface CatalogSectionInput {
    courseName: string;
    crn?: string | null;
    instructorName?: string | null;
    sortOrder?: number;
    sourceMetadata?: Record<string, unknown>;
    meetings: CatalogSectionMeetingInput[];
}

export interface CatalogSectionsReplaceRequest {
    sections: CatalogSectionInput[];
}

export interface CatalogSectionMeetingResponse {
    id: string;
    sectionId: string;
    days: string;
    startTime: string;
    endTime: string;
    sortOrder: number;
}

export interface CatalogSectionResponse {
    id: string;
    catalogId: string;
    courseName: string;
    crn: string | null;
    instructorName: string | null;
    sortOrder: number;
    sourceMetadata: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
    meetings: CatalogSectionMeetingResponse[];
}

export async function createCatalog(
    payload: CreateCatalogPayload,
): Promise<CatalogResponse> {
    return apiFetch("/catalogs", "Failed to create catalog", {
        method: "POST",
        auth: true,
        json: payload,
    });
}

export async function getCatalog(catalogId: string): Promise<CatalogResponse> {
    return apiFetch(
        `/catalogs/${encodeURIComponent(catalogId)}`,
        "Failed to fetch catalog",
        { auth: true },
    );
}

export async function getCatalogSections(
    catalogId: string,
): Promise<CatalogSectionResponse[]> {
    return apiFetch(
        `/catalogs/${encodeURIComponent(catalogId)}/sections`,
        "Failed to fetch catalog sections",
        { auth: true },
    );
}

export async function replaceCatalogSections(
    catalogId: string,
    payload: CatalogSectionsReplaceRequest,
): Promise<CatalogSectionResponse[]> {
    return apiFetch(
        `/catalogs/${encodeURIComponent(catalogId)}/sections`,
        "Failed to save catalog sections",
        {
            method: "PUT",
            auth: true,
            json: payload,
        },
    );
}
