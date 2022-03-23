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
}
export declare function sendTopic(config: SingleRunConfiguration): Promise<TopicReturnType>;
export declare function createTopicConnection(config: SocketConfig): TopicConnection;
