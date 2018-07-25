//-----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// Licensed under the MIT License. See License file under the project root for license information.
//-----------------------------------------------------------------------------

import { IModuleLoadingPolicy, IModuleManager, IModuleInfo } from "sfx.module-manager";

import * as utils from "../utilities/utils";

export class DefaultModuleLoadingPolicy implements IModuleLoadingPolicy {
    public async shouldLoadAsync(moduleManager: IModuleManager, nameOrInfo: string | IModuleInfo): Promise<boolean> {
        
        if (!utils.isNullOrUndefined(nameOrInfo) && String.isString((<IModuleInfo>nameOrInfo).hostVersion)) {
            return moduleManager.hostVersion === (<IModuleInfo>nameOrInfo).hostVersion;
        }

        return true;
    }
}
