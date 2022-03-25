export interface SocketConfig {
    host: string;
    port: number;
}
export interface SingleRunConfiguration extends SocketConfig {
    topic: string;
    timeout?: number;
}
export declare type TopicReturnType = string | number | null;
export interface TopicConnection {
    send: (topic: string) => Promise<TopicReturnType>;
    destroy: () => void;
    queueLength: number;
    destroyed: boolean;
}
export interface ShimForm {
    ip: string;
    port: number;
    topic: string;
}
