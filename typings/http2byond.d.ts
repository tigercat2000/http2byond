/// <reference types="node" />
import { Socket } from 'net';
import { SingleRunConfiguration, SocketConfig, TopicConnection, TopicReturnType } from './types';
/**
 * @internal
 */
export declare function _sendTopic(socket: Socket, _topic: string): Promise<TopicReturnType>;
export declare function sendTopic(config: SingleRunConfiguration): Promise<TopicReturnType>;
export declare function createTopicConnection(config: SocketConfig): TopicConnection;
