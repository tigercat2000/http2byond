import { deprecate } from 'util'
import { ShimForm } from './types'
import { sendTopic } from './http2byond'

/**
 * @deprecated Use {@link #sendTopic} and {@link #createTopicConnection} instead
 */
class ShimTopicConnection {
  private timeout?: number;

  constructor(config?: {
    timeout?: number
  }) {
    this.timeout = config?.timeout ?? 2000;
  }

  run(config: ShimForm) {
    return sendTopic({
      host: config.ip,
      port: config.port,
      topic: config.topic,
      timeout: this.timeout
    });
  }
}
export default deprecate(ShimTopicConnection, "The API for http2byond has changed. Please see updated documentation to see how to use the new sendTopic() and createTopicConnection() functions");