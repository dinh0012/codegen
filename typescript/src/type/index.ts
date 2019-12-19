

export type Option = {
    swagger: any
    isES6: boolean
    moduleName: string
    className: string
    imports: string
    template?: any
    lint?: boolean
    mustache?: boolean
    esnext?: boolean
    beautify?: boolean
    format?: string
}
export type Header = {
    name: string[] | string
    value: string[] | string
}
export type Method = {
    path: string
    methodName: string
    className: string
    method: string
    isGET: boolean
    isPOST: boolean
    summary: string
    parameters: any[]
    headers: any[]
    lowerMethod?: string
    capitalizeTag?: string
    externalDocs?: string
    isSecureToken?: boolean
    isSecureApiKey?: boolean
    isSecureBasic?: boolean
    isSecure?: boolean

}
export type Definition = {
    name: string,
    description: string,
    tsType: any,
}
export type Data = {
    isNode: boolean
    isES6: boolean
    description: string
    moduleName: string
    className: string
    domain: string
    methods: Method[]
    definitions?: Definition[]
    imports?: string
    isSecure?: boolean
    isSecureToken?: boolean
    isSecureApiKey?: boolean
    isSecureBasic?: boolean
}


export type TypeSpec = {
    description: string;
    isEnum: boolean;
    tsType?: string;
    target?: string;
    name?: string;
    isAtomic?: boolean;
    isObject?: boolean;
    isArray?: boolean;
    isRef?: boolean;
    optional?: boolean;
    elementType?: TypeSpec;
    properties?: any[];
}
