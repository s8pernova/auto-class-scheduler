import {
    createCatalogApiV1CatalogsPost,
    getCatalogApiV1CatalogsCatalogIdGet,
    listCatalogSectionsApiV1CatalogsCatalogIdSectionsGet,
    replaceCatalogSectionsApiV1CatalogsCatalogIdSectionsPut,
} from "@/api/generated";
import type {
    CatalogCreate,
    CatalogResponse,
    CatalogSectionInput,
    CatalogSectionMeetingInput,
    CatalogSectionMeetingResponse,
    CatalogSectionResponse,
    CatalogSectionsReplaceRequest,
    CreateCatalogApiV1CatalogsPostResponse,
    GetCatalogApiV1CatalogsCatalogIdGetResponse,
    ListCatalogSectionsApiV1CatalogsCatalogIdSectionsGetResponse,
    ReplaceCatalogSectionsApiV1CatalogsCatalogIdSectionsPutResponse,
} from "@/api/generated";
import { getAccessToken, unwrapApiResult } from "@/api/http";

export type CreateCatalogPayload = CatalogCreate;

export type {
    CatalogResponse,
    CatalogSectionInput,
    CatalogSectionMeetingInput,
    CatalogSectionMeetingResponse,
    CatalogSectionResponse,
    CatalogSectionsReplaceRequest,
};

export async function createCatalog(
    payload: CatalogCreate,
): Promise<CreateCatalogApiV1CatalogsPostResponse> {
    return unwrapApiResult(
        await createCatalogApiV1CatalogsPost({
            auth: getAccessToken,
            body: payload,
        }),
        "Failed to create catalog",
    );
}

export async function getCatalog(
    catalogId: string,
): Promise<GetCatalogApiV1CatalogsCatalogIdGetResponse> {
    return unwrapApiResult(
        await getCatalogApiV1CatalogsCatalogIdGet({
            auth: getAccessToken,
            path: { catalog_id: catalogId },
        }),
        "Failed to fetch catalog",
    );
}

export async function getCatalogSections(
    catalogId: string,
): Promise<ListCatalogSectionsApiV1CatalogsCatalogIdSectionsGetResponse> {
    return unwrapApiResult(
        await listCatalogSectionsApiV1CatalogsCatalogIdSectionsGet({
            auth: getAccessToken,
            path: { catalog_id: catalogId },
        }),
        "Failed to fetch catalog sections",
    );
}

export async function replaceCatalogSections(
    catalogId: string,
    payload: CatalogSectionsReplaceRequest,
): Promise<ReplaceCatalogSectionsApiV1CatalogsCatalogIdSectionsPutResponse> {
    return unwrapApiResult(
        await replaceCatalogSectionsApiV1CatalogsCatalogIdSectionsPut({
            auth: getAccessToken,
            body: payload,
            path: { catalog_id: catalogId },
        }),
        "Failed to save catalog sections",
    );
}
