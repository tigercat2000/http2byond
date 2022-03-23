export interface SocketConfig {
    host: string;
    port: number;
}
export declare type SingleRunConfiguration = SocketConfig & {
    topic: string;
    timeout?: number;
};
export declare type TopicReturnType = string | number | null;
export interface TopicConnection {
    send: (topic: string) => Promise<TopicReturnType>;
    destroy: () => void;
}
declare function sendTopic(config: SingleRunConfiguration): Promise<TopicReturnType>;
declare function createTopicConnection(config: SocketConfig): TopicConnection;
export { sendTopic, createTopicConnection };
