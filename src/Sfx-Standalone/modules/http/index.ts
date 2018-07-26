//-----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License file under the project root for license information.
//-----------------------------------------------------------------------------
import { IModuleInfo, IModule, IModuleManager } from "sfx.module-manager";
import { ILog } from "sfx.logging";
import { ICertificateLoader, IPkiCertificateService } from "sfx.cert";

import {
    IHttpClient,
    IHttpClientBuilder,
    ServerCertValidator,
    RequestAsyncProcessor,
    ResponseAsyncHandler,
    IServiceFabricHttpClient
} from "sfx.http";

import { SelectClientCertAsyncHandler, IAadMetadata } from "sfx.http.auth";
import { WebContents } from "electron";
import { IAsyncHandlerConstructor } from "sfx.common";

import * as appUtils from "../../utilities/appUtils";

import { HttpProtocols } from "./common";

(<IModule>exports).getModuleMetadata = (components): IModuleInfo => {
    components
        .register<IServiceFabricHttpClient>({
            name: "http.http-client.service-fabric",
            version: appUtils.getAppVersion(),
            singleton: true,
            descriptor: (moduleManager: IModuleManager, webContents?: WebContents) =>
                import("./service-fabric.http-client").then((module) => module.createAsync(moduleManager, webContents)),
            deps: ["module-manager"]
        })
        .register<IHttpClient>({
            name: "http.http-client",
            version: appUtils.getAppVersion(),
            descriptor: (log: ILog, certLoader: ICertificateLoader, serverCertValidator?: ServerCertValidator): Promise<IHttpClient> =>
                import("./node.http-client-builder").then((module) => module.buildHttpClientAsync(log, certLoader, HttpProtocols.any, serverCertValidator)),
            deps: ["logging", "cert.cert-loader"]
        })
        .register<IHttpClient>({
            name: "http.https-client",
            version: appUtils.getAppVersion(),
            descriptor: (log: ILog, certLoader: ICertificateLoader, serverCertValidator?: ServerCertValidator): Promise<IHttpClient> =>
                import("./node.http-client-builder").then((module) => module.buildHttpClientAsync(log, certLoader, HttpProtocols.https, serverCertValidator)),
            deps: ["logging", "cert.cert-loader"]
        })
        .register<IHttpClient>({
            name: "http.node-http-client",
            version: appUtils.getAppVersion(),
            descriptor: (log: ILog, certLoader: ICertificateLoader, serverCertValidator?: ServerCertValidator): Promise<IHttpClient> =>
                import("./node.http-client-builder").then((module) => module.buildHttpClientAsync(log, certLoader, HttpProtocols.any, serverCertValidator)),
            deps: ["logging", "cert.cert-loader"]
        })
        .register<IHttpClient>({
            name: "http.node-https-client",
            version: appUtils.getAppVersion(),
            descriptor: (log: ILog, certLoader: ICertificateLoader, serverCertValidator?: ServerCertValidator): Promise<IHttpClient> =>
                import("./node.http-client-builder").then((module) => module.buildHttpClientAsync(log, certLoader, HttpProtocols.https, serverCertValidator)),
            deps: ["logging", "cert.cert-loader"]
        })
        .register<IHttpClient>({
            name: "http.electron-http-client",
            version: appUtils.getAppVersion(),
            descriptor: (log: ILog, serverCertValidator?: ServerCertValidator): Promise<IHttpClient> =>
                import("./electron.http-client-builder").then((module) => module.buildHttpClientAsync(log, HttpProtocols.any, serverCertValidator)),
            deps: ["logging"]
        })
        .register<IHttpClient>({
            name: "http.electron-https-client",
            version: appUtils.getAppVersion(),
            descriptor: (log: ILog, serverCertValidator?: ServerCertValidator): Promise<IHttpClient> =>
                import("./electron.http-client-builder").then((module) => module.buildHttpClientAsync(log, HttpProtocols.https, serverCertValidator)),
            deps: ["logging"]
        })
        .register<IHttpClientBuilder>({
            name: "http.node-client-builder",
            version: appUtils.getAppVersion(),
            descriptor: (log: ILog, certLoader: ICertificateLoader, serverCertValidator?: ServerCertValidator) =>
                import("./node.http-client-builder").then((module) => new module.HttpClientBuilder(log, certLoader, serverCertValidator)),
            deps: ["logging", "cert.cert-loader"]
        })
        .register<IHttpClientBuilder>({
            name: "http.electron-client-builder",
            version: appUtils.getAppVersion(),
            descriptor: (log: ILog, serverCertValidator?: ServerCertValidator) =>
                import("./electron.http-client-builder").then((module) => new module.HttpClientBuilder(log, serverCertValidator)),
            deps: ["logging"]
        })

        // Request Handlers
        .register<IAsyncHandlerConstructor<RequestAsyncProcessor>>({
            name: "http.request-handlers.handle-json",
            version: appUtils.getAppVersion(),
            descriptor: () => import("./request-handlers/handle-json").then((module) => module.handleJsonAsync)
        })

        // Response Handlers
        .register<IAsyncHandlerConstructor<ResponseAsyncHandler>>({
            name: "http.response-handlers.handle-redirection",
            version: appUtils.getAppVersion(),
            descriptor: () => import("./response-handlers/handle-redirection").then((module) => module.handleRedirectionAsync)
        })
        .register<IAsyncHandlerConstructor<ResponseAsyncHandler>>({
            name: "http.response-handlers.handle-json",
            version: appUtils.getAppVersion(),
            descriptor: () => import("./response-handlers/handle-json").then((module) => module.handleJsonAsync)
        })
        .register<IAsyncHandlerConstructor<ResponseAsyncHandler>>({
            name: "http.response-handlers.handle-auth-aad",
            version: appUtils.getAppVersion(),
            descriptor: (handlingHost: WebContents, aadMetadata: IAadMetadata) =>
                import("./response-handlers/handle-auth-aad").then((module) => module.handleAadAsync.bind(null, handlingHost, aadMetadata))
        })
        .register<IAsyncHandlerConstructor<ResponseAsyncHandler>>({
            name: "http.response-handlers.handle-auth-cert",
            version: appUtils.getAppVersion(),
            descriptor: (certLoader: ICertificateLoader, pkiCertSvc: IPkiCertificateService, selectClientCertAsyncHandler: SelectClientCertAsyncHandler) =>
                import("./response-handlers/handle-auth-cert").then((module) => module.handleCertAsync.bind(null, certLoader, pkiCertSvc, selectClientCertAsyncHandler)),
            deps: ["cert.cert-loader", "cert.pki-service"]
        });

    return {
        name: "http",
        version: appUtils.getAppVersion()
    };
};
