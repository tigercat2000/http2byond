import { ShimForm } from './types';
/**
 * @deprecated Use {@link #sendTopic} and {@link #createTopicConnection} instead
 */
declare class ShimTopicConnection {
    private timeout?;
    constructor(config?: {
        timeout?: number;
    });
    run(config: ShimForm): Promise<import("./types").TopicReturnType>;
}
declare const _default: typeof ShimTopicConnection;
export default _default;
