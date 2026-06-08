import {
    createCatalogApiV1CatalogsPost,
    getCatalogApiV1CatalogsCatalogIdGet,
    getSharedCatalogApiV1CatalogsSharedShareSlugGet,
    listCatalogSectionsApiV1CatalogsCatalogIdSectionsGet,
    publishCatalogApiV1CatalogsCatalogIdPublishPost,
    replaceCatalogSectionsApiV1CatalogsCatalogIdSectionsPut,
    forkCatalogApiV1CatalogsCatalogIdForkPost,
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
    CatalogForkRequest,
    ForkCatalogApiV1CatalogsCatalogIdForkPostResponse,
    GetSharedCatalogApiV1CatalogsSharedShareSlugGetResponse,
    PublishCatalogApiV1CatalogsCatalogIdPublishPostResponse,
} from "@/api/generated";
import {
    getAccessToken,
    getRequiredAccessToken,
    unwrapApiResult,
} from "@/api/http";

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
            auth: getRequiredAccessToken,
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
            auth: getRequiredAccessToken,
            body: payload,
            path: { catalog_id: catalogId },
        }),
        "Failed to save catalog sections",
    );
}

export async function getSharedCatalog(
    shareSlug: string,
): Promise<GetSharedCatalogApiV1CatalogsSharedShareSlugGetResponse> {
    return unwrapApiResult(
        await getSharedCatalogApiV1CatalogsSharedShareSlugGet({
            path: { share_slug: shareSlug },
        }),
        "Failed to fetch shared catalog",
    );
}

export async function publishCatalog(
    catalogId: string,
): Promise<PublishCatalogApiV1CatalogsCatalogIdPublishPostResponse> {
    return unwrapApiResult(
        await publishCatalogApiV1CatalogsCatalogIdPublishPost({
            auth: getRequiredAccessToken,
            path: { catalog_id: catalogId },
        }),
        "Failed to publish catalog",
    );
}

export async function forkCatalog(
    catalogId: string,
    payload: CatalogForkRequest | null = null,
): Promise<ForkCatalogApiV1CatalogsCatalogIdForkPostResponse> {
    return unwrapApiResult(
        await forkCatalogApiV1CatalogsCatalogIdForkPost({
            auth: getRequiredAccessToken,
            path: { catalog_id: catalogId },
            body: payload,
        }),
        "Failed to fork catalog",
    );
}
