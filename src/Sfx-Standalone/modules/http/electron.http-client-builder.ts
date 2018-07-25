//-----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License file under the project root for license information.
//-----------------------------------------------------------------------------

import { IHttpClient, ServerCertValidator } from "sfx.http";
import { ILog } from "sfx.logging";

import { HttpClient } from "./electron.http-client";
import { HttpClientBuilderBase } from "./http-client-builder-base";
import { handleJsonAsync as handleJsonRequestAsync } from "./request-handlers/handle-json";
import { handleJsonAsync as handleJsonResponseAsync } from "./response-handlers/handle-json";
import { handleRedirectionAsync as handleRedirectionResponseAsync } from "./response-handlers/handle-redirection";

export function buildHttpClientAsync(
    log: ILog,
    protocol: string,
    serverCertValidator?: ServerCertValidator)
    : Promise<IHttpClient> {
    return Promise.resolve(new HttpClientBuilder(log, serverCertValidator))
        // Request handlers
        .then(builder => builder.handleRequestAsync(handleJsonRequestAsync))

        // Response handlers
        .then(builder => builder.handleResponseAsync(handleRedirectionResponseAsync))
        .then(builder => builder.handleResponseAsync(handleJsonResponseAsync))
        .then(builder => builder.buildAsync(protocol));
}

export class HttpClientBuilder extends HttpClientBuilderBase {
    private readonly serverCertValidator: ServerCertValidator;

    constructor(log: ILog, serverCertValidator: ServerCertValidator) {
        super(log);

        this.serverCertValidator = serverCertValidator;
    }

    public async buildAsync(protocol: string): Promise<IHttpClient> {
        return new HttpClient(
            this.log,
            protocol,
            this.serverCertValidator,
            await this.requestHandlerBuilder.buildAsync(),
            await this.responseHandlerBuilder.buildAsync());
    }
}
