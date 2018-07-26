//-----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License file under the project root for license information.
//-----------------------------------------------------------------------------

declare module "sfx.http" {
    import { IAsyncHandlerConstructor, IDisposable } from "sfx.common";

    export interface IServiceFabricHttpClient extends IHttpClient, IDisposable {
        handleResponseAsync(constructor: IAsyncHandlerConstructor<ResponseAsyncHandler>): Promise<IServiceFabricHttpClient>;
        handleRequestAsync(constructor: IAsyncHandlerConstructor<RequestAsyncProcessor>): Promise<IServiceFabricHttpClient>;
    }
}
