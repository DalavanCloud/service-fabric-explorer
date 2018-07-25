//-----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License file under the project root for license information.
//-----------------------------------------------------------------------------

import { IHttpClient, ServerCertValidator } from "sfx.http";
import { ILog } from "sfx.logging";
import { ICertificateLoader } from "sfx.cert";

import { HttpClient } from "./node.http-client";
import { HttpClientBuilderBase } from "./http-client-builder-base";
import { handleJsonAsync as handleJsonRequestAsync } from "./request-handlers/handle-json";
import { handleJsonAsync as handleJsonResponseAsync } from "./response-handlers/handle-json";
import { handleRedirectionAsync as handleRedirectionResponseAsync } from "./response-handlers/handle-redirection";

export function buildHttpClientAsync(
    log: ILog,
    certLoader: ICertificateLoader,
    protocol: string,
    serverCertValidator?: ServerCertValidator)
    : Promise<IHttpClient> {
    return Promise.resolve(new HttpClientBuilder(log, certLoader, serverCertValidator))
        // Request handlers
        .then(builder => builder.handleRequestAsync(handleJsonRequestAsync))

        // Response handlers
        .then(builder => builder.handleResponseAsync(handleRedirectionResponseAsync))
        .then(builder => builder.handleResponseAsync(handleJsonResponseAsync))
        .then(builder => builder.buildAsync(protocol));
}

export class HttpClientBuilder extends HttpClientBuilderBase {
    private readonly certLoader: ICertificateLoader;

    private readonly serverCertValidator: ServerCertValidator;

    constructor(
        log: ILog,
        certLoader: ICertificateLoader,
        serverCertValidator?: ServerCertValidator) {

        super(log);

        this.certLoader = certLoader;
        this.serverCertValidator = serverCertValidator;
    }

    public async buildAsync(protocol: string): Promise<IHttpClient> {
        return new HttpClient(
            this.log,
            this.certLoader,
            protocol,
            this.serverCertValidator,
            await this.requestHandlerBuilder.buildAsync(),
            await this.responseHandlerBuilder.buildAsync());
    }
}
