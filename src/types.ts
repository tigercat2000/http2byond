export interface SocketConfig {
  //Domain name or IP to connect to
  host: string;
  //Port to connect to
  port: number;
}

export interface SingleRunConfiguration extends SocketConfig {
  //URL params to send to BYOND
  topic: string;
  //Time to wait before aborting connection
  timeout?: number;
}

export type TopicReturnType = string | number | null

export interface TopicConnection {
  send: (topic: string) => Promise<TopicReturnType>
  destroy: () => void
  queueLength: number
  destroyed: boolean
}


export interface ShimForm {
  ip: string;
  port: number;
  topic: string;
}