export interface UserState {
    step: string;
    chatId?: number;
    previousStep?: string;
    lastBotMessageId?: number;
    lastUserMessageId?: number;
    editingLinkId?: string;
    editingProxyId?: string;
    tempData?: any;
}

export interface ParsedProxy {
    ipAddress: string;
    port: string;
    username?: string;
    password?: string;
}

export interface Proxy {
    id: string;
    ipAddress: string;
    port: string;
    username?: string;
    password?: string;
    type: ProxyType;
    isActive: boolean;
    lastUsed?: Date;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
}

export enum ProxyType {
    HTTP = "HTTP",
    HTTPS = "HTTPS",
    SOCKS5 = "SOCKS5",
}

export interface GooglePlayAppResult {
    packageName: string;
    appName?: string;
    isAvailable: boolean;
    errorMessage?: string;
}

export interface CheckOptions {
    useProxy: boolean;
    notifyResult: boolean;
}
