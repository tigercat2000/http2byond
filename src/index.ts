import { Socket, createConnection } from 'net'

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
}

function _sendTopic(socket: Socket, _topic: string): Promise<TopicReturnType> {
  const topic = _topic[0] !== "?" ?
                    "?" + _topic :
                    _topic

  return new Promise((resolve, reject) => {
    function errorHandler(reason: string) {
      return function(originalError?: Error) {
        /*reject(new Error(reason, {
          cause: originalError
        }))*/
        originalError ?
          reject(new Error(reason + "\n Caused by: " + originalError)) :
          reject(new Error(reason))
        socket.destroy()
      }
    }

    socket.on("error", errorHandler("Socket errored"))
    socket.on("timeout", errorHandler("Connection timeout"))

    let byte = 0
    //type(2) + length(2)
    const headerBuffer = Buffer.alloc(4)
    let bodyBuffer: Buffer;

    function processResponse() {
      const type = bodyBuffer[0];
      switch (type) {
        case 0x00: {
          return resolve(null)
        }
        case 0x2a: {
          return resolve(bodyBuffer.readFloatLE(1))
        }
        case 0x06: {
          return resolve(bodyBuffer.subarray(0, -1).toString("utf-8"))
        }
      }
    }


    socket.on("data", data => {
      //Still waiting on a complete header
      if(byte < 4) {
        const copiedBytes = data.copy(headerBuffer)
        data = data.subarray(copiedBytes)
        byte += copiedBytes

        //Got the full header!
        if(byte >= 4) {
          bodyBuffer = Buffer.alloc(headerBuffer.readUint16BE(2))
        //Sucks to be you, maybe you'll get a full header later?
        } else {
          return
        }
      }

      //We either just finished reading the header and got more to read, or we just got another body packet
      if (data.length) {
        const copiedBytes = data.copy(bodyBuffer)
        byte += copiedBytes
      }

      //expected buffer length + the header length
      const fullLength = 4 + bodyBuffer.length

      //We got too many bytes!
      if(byte > fullLength) {
        errorHandler("Data is larger than expected")
        return
      }

      //No more data to read
      if(byte === fullLength) {
        socket.end()
        processResponse()
      }
    })

    socket.on("ready", () => {
      const topicBuffer = Buffer.from(topic)
      //type(2) + length(2) + padding(5) + msg(n) + terminator(1)
      const dataBuffer = Buffer.alloc(2 + 2 + 5 + topicBuffer.length + 1)
      let ptr;

      //Packet type 0x0083
      dataBuffer[0] = 0x00
      dataBuffer[1] = 0x83

      //Write length of buffer
      //padding(5) + msg(n) + terminator(1)
      dataBuffer.writeUInt16BE(5 + topicBuffer.length + 1, 2)

      //Write padding
      dataBuffer[4] = 0x00
      dataBuffer[5] = 0x00
      dataBuffer[6] = 0x00
      dataBuffer[7] = 0x00
      dataBuffer[8] = 0x00

      //We're done with the header, we need to write the null terminated string to the 8th byte.
      ptr = 9;
      topicBuffer.copy(dataBuffer, ptr)
      ptr += topicBuffer.length
      dataBuffer[ptr] = 0x00

      socket.write(dataBuffer)

    })
  })
}

export function sendTopic(config: SingleRunConfiguration): Promise<TopicReturnType> {
  const socket = createConnection({
    family: 4,
    host: config.host,
    port: config.port,
    timeout: config.timeout
  })
  return _sendTopic(socket, config.topic)
}

export function createTopicConnection(config: SocketConfig): TopicConnection {
  const socket = createConnection({
    family: 4,
    host: config.host,
    port: config.port
  })
  return {
    send: topic => {
      if (socket.destroyed) {
        return Promise.reject(new Error("Socket is destroyed"))
      }

      return _sendTopic(socket, topic)
    },
    destroy: () => {
      socket.destroy()
    }
  }
}