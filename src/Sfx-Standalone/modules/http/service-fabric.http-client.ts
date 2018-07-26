//-----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License file under the project root for license information.
//-----------------------------------------------------------------------------

import {
    IHttpClient,
    IHttpResponse,
    IRequestOptions,
    IHttpClientBuilder,
    ServerCertValidator,
    ResponseAsyncHandler,
    IServiceFabricHttpClient,
    RequestAsyncProcessor
} from "sfx.http";

import { IModuleManager } from "sfx.module-manager";
import { HttpProtocols } from "./common";
import { ICertificateInfo } from "sfx.cert";
import { IAsyncHandlerConstructor } from "sfx.common";
import { WebContents } from "electron";

type HttpClientType = "node" | "electron";

class HttpClient implements IServiceFabricHttpClient {
    public get defaultRequestOptions(): Promise<IRequestOptions> {
        return this._defaultRequestOptions;
    }

    private _httpClient: IHttpClient;

    private _defaultRequestOptions: Promise<IRequestOptions>;

    private readonly webContents: WebContents;

    private readonly moduleManager: IModuleManager;

    private readonly requestProcessorConstructors: Array<IAsyncHandlerConstructor<RequestAsyncProcessor>>;

    private readonly responseHandlerConstructors: Array<IAsyncHandlerConstructor<ResponseAsyncHandler>>;

    private httpClientType: HttpClientType;

    constructor(moduleManager: IModuleManager, webContents?: WebContents) {
        if (!moduleManager) {
            throw new Error("moduleManager must be provided.");
        }

        this.httpClientType = "node";
        this.webContents = webContents;
    }

    public async handleResponseAsync(constructor: IAsyncHandlerConstructor<ResponseAsyncHandler>): Promise<IServiceFabricHttpClient> {
        if (!Function.isFunction(constructor)) {
            throw new Error("constructor must be provided.");
        }

        this.responseHandlerConstructors.push(constructor);
        this._httpClient = undefined;

        return this;
    }

    public async handleRequestAsync(constructor: IAsyncHandlerConstructor<RequestAsyncProcessor>): Promise<IServiceFabricHttpClient> {
        if (!Function.isFunction(constructor)) {
            throw new Error("constructor must be provided.");
        }

        this.requestProcessorConstructors.push(constructor);
        this._httpClient = undefined;

        return this;
    }

    public async updateDefaultRequestOptionsAsync(options: IRequestOptions): Promise<void> {
        await this.getHttpClientAsync()
            .then((client) => client.updateDefaultRequestOptionsAsync(options));

        this._defaultRequestOptions = Promise.resolve(options);
    }

    public deleteAsync(url: string): Promise<IHttpResponse> {
        return this.getHttpClientAsync()
            .then((client) => client.deleteAsync(url));
    }

    public getAsync(url: string): Promise<IHttpResponse> {
        return this.getHttpClientAsync()
            .then((client) => client.getAsync(url));
    }

    public patchAsync(url: string, data: any): Promise<IHttpResponse> {
        return this.getHttpClientAsync()
            .then((client) => client.patchAsync(url, data));
    }

    public postAsync(url: string, data: any): Promise<IHttpResponse> {
        return this.getHttpClientAsync()
            .then((client) => client.postAsync(url, data));
    }

    public putAsync(url: string, data: any): Promise<IHttpResponse> {
        return this.getHttpClientAsync()
            .then((client) => client.putAsync(url, data));
    }

    public requestAsync(requestOptions: IRequestOptions, data: any): Promise<IHttpResponse> {
        return this.getHttpClientAsync()
            .then((client) => client.requestAsync(requestOptions, data));
    }

    private async getHttpClientAsync(): Promise<IHttpClient> {
        if (!this._httpClient) {
            this._httpClient = await this.buildHttpClientAsync();
        }

        return this._httpClient;
    }

    private getNodeHttpClientBuilderAsync(): Promise<IHttpClientBuilder> {
        return this.moduleManager.getComponentAsync("http.node-client-builder", this.serverCertValidator);
    }

    private getElectronHttpClientBuilderAsync(): Promise<IHttpClientBuilder> {
        return this.moduleManager.getComponentAsync("http.electron-client-builder", this.serverCertValidator);
    }

    private async buildHttpClientAsync(httpClientType?: HttpClientType): Promise<IHttpClient> {
        if (!httpClientType) {
            httpClientType = this.httpClientType;
        }

        const builder = httpClientType === "electron" ? await this.getNodeHttpClientBuilderAsync() : await this.getElectronHttpClientBuilderAsync();

        /**** Request processors ****/
        await builder.handleRequestAsync(await this.moduleManager.getComponentAsync("http.request-handlers.handle-json"));

        for (const constructor of this.requestProcessorConstructors) {
            await builder.handleRequestAsync(constructor);
        }

        /**** Response handlers ****/
        await builder.handleResponseAsync(await this.moduleManager.getComponentAsync("http.response-handlers.handle-redirection"));
        await builder.handleResponseAsync(this.buildWindowsAuthHandler);
        await builder.handleResponseAsync(this.buildCertAuthHandler);
        await builder.handleResponseAsync(this.buildAadAuthHandler);
        await builder.handleResponseAsync(await this.moduleManager.getComponentAsync("http.response-handlers.handle-json"));

        for (const constructor of this.responseHandlerConstructors) {
            await builder.handleResponseAsync(constructor);
        }

        return await builder.buildAsync(HttpProtocols.any);
    }

    private readonly buildCertAuthHandler: IAsyncHandlerConstructor<ResponseAsyncHandler> =
        (nextHandler: ResponseAsyncHandler): Promise<ResponseAsyncHandler> => {

            const handleAuthCertConstructor = await this.moduleManager.getComponentAsync("http.response-handlers.handle-auth-cert", this.selectCert);

            return (client: IHttpClient, log: ILog, requestOptions: IRequestOptions, requestData: any, response: IHttpResponse): Promise<any> => {
                if (statusCode === 403
                    && 0 === "Client certificate required".localeCompare(await response.statusMessage, undefined, { sensitivity: "accent" })
                    && this.httpClientType === "node") {
                        return handleAuthCert()
                    }
            };
        }

    private readonly buildAadAuthHandler: IAsyncHandlerConstructor<ResponseAsyncHandler> =
        (nextHandler: ResponseAsyncHandler): Promise<ResponseAsyncHandler> => {

        }

    private readonly buildWindowsAuthHandler: IAsyncHandlerConstructor<ResponseAsyncHandler> =
        (nextHandler: ResponseAsyncHandler): Promise<ResponseAsyncHandler> => {

        }

    private readonly serverCertValidator: ServerCertValidator =
        (serverName: string, cert: ICertificateInfo): Error | void => {
            return null;
        }
}

export async function createAsync(moduleManager: IModuleManager, webContents?: WebContents): Promise<IServiceFabricHttpClient> {
    return new HttpClient(moduleManager, webContents);
}
