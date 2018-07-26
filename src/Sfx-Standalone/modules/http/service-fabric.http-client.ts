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
import { SelectClientCertAsyncHandler } from "sfx.http.auth";
import { ILog } from "sfx.logging";

enum HttpClientType {
    Node = "node",
    Electron = "electron"
}

class HttpClient implements IServiceFabricHttpClient {
    public get defaultRequestOptions(): Promise<IRequestOptions> {
        return this._defaultRequestOptions;
    }

    private _httpClient: IHttpClient;

    private _httpClientType: HttpClientType;

    private _defaultRequestOptions: Promise<IRequestOptions>;

    private readonly webContents: WebContents;

    private readonly moduleManager: IModuleManager;

    private readonly requestProcessorConstructors: Array<IAsyncHandlerConstructor<RequestAsyncProcessor>>;

    private readonly responseHandlerConstructors: Array<IAsyncHandlerConstructor<ResponseAsyncHandler>>;

    constructor(moduleManager: IModuleManager, webContents?: WebContents) {
        if (!moduleManager) {
            throw new Error("moduleManager must be provided.");
        }

        this.webContents = webContents;
        this.setHttpClientType(HttpClientType.Node);
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

    private getHttpClientType(): HttpClientType {
        return this._httpClientType;
    }

    private setHttpClientType(type: HttpClientType): void {
        if (this._httpClientType !== type) {
            this._httpClientType = type;
            this._httpClient = undefined;
        }
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
            httpClientType = this.getHttpClientType();
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

        const client = await builder.buildAsync(HttpProtocols.any);

        await client.updateDefaultRequestOptionsAsync(await this.defaultRequestOptions);

        return client;
    }

    private readonly selectCert: SelectClientCertAsyncHandler =
        (url: string, certInfos: Array<ICertificateInfo>): Promise<ICertificate | ICertificateInfo> => {

        }

    private readonly buildCertAuthHandler: IAsyncHandlerConstructor<ResponseAsyncHandler> =
        async (nextHandler: ResponseAsyncHandler): Promise<ResponseAsyncHandler> => {

            const handleAuthCertAsyncConstructor = await this.moduleManager.getComponentAsync("http.response-handlers.handle-auth-cert", this.selectCert);
            const handleAuthCert = await handleAuthCertAsyncConstructor(nextHandler);

            return async (client: IHttpClient, log: ILog, requestOptions: IRequestOptions, requestData: any, response: IHttpResponse): Promise<any> => {
                const statusCode = await response.statusCode;

                if (HttpClientType.Node === this.getHttpClientType()) {
                    return await handleAuthCert(client, log, requestOptions, requestData, response);
                }

                if (statusCode === 403
                    && 0 === "Client certificate required".localeCompare(await response.statusMessage, undefined, { sensitivity: "accent" })) {

                    this.setHttpClientType(HttpClientType.Node);

                    return this.getHttpClientAsync().then((client) => client.requestAsync(requestOptions, requestData));
                }

                if (Function.isFunction(nextHandler)) {
                    return await nextHandler(client, log, requestOptions, requestData, response);
                }

                return response;
            };
        }

    private readonly buildAadAuthHandler: IAsyncHandlerConstructor<ResponseAsyncHandler> =
        async (nextHandler: ResponseAsyncHandler): Promise<ResponseAsyncHandler> => {
            return async (client: IHttpClient, log: ILog, requestOptions: IRequestOptions, requestData: any, response: IHttpResponse): Promise<any> => {
                const statusCode = await response.statusCode;

                if (statusCode === 401 || statusCode === 403) {
                    
                }
            };
        }

    private readonly buildWindowsAuthHandler: IAsyncHandlerConstructor<ResponseAsyncHandler> =
        async (nextHandler: ResponseAsyncHandler): Promise<ResponseAsyncHandler> => {
            const WinAuthChallengeHeader = "WWW-Authenticate";
            const ChallengeType_Ntlm = "NTLM";
            const ChallengeType_Negotiate = "Negotiate";

            return async (client: IHttpClient, log: ILog, requestOptions: IRequestOptions, requestData: any, response: IHttpResponse): Promise<any> => {
                const statusCode = await response.statusCode;
                const headers = await response.headers;

                if (statusCode === 401
                    && (headers[WinAuthChallengeHeader] === ChallengeType_Ntlm
                        || headers[WinAuthChallengeHeader] === ChallengeType_Negotiate)) {

                    if (HttpClientType.Node === this.getHttpClientType()) {

                        this.setHttpClientType(HttpClientType.Electron);

                        return this.getHttpClientAsync().then((client) => client.requestAsync(requestOptions, requestData));
                    }
                }

                if (Function.isFunction(nextHandler)) {
                    return await nextHandler(client, log, requestOptions, requestData, response);
                }

                return response;
            };
        }

    private readonly serverCertValidator: ServerCertValidator =
        (serverName: string, cert: ICertificateInfo): Error | void => {
            return null;
        }
}

export async function createAsync(moduleManager: IModuleManager, webContents?: WebContents): Promise<IServiceFabricHttpClient> {
    return new HttpClient(moduleManager, webContents);
}
