import { createConnection, Socket } from 'net'
import { SingleRunConfiguration, SocketConfig, TopicConnection, TopicReturnType } from './types'

/**
 * @internal
 */
export function _sendTopic(socket: Socket, _topic: string): Promise<TopicReturnType> {
  const topic = _topic[0] !== "?" ?
                    "?" + _topic :
                    _topic

  return new Promise((resolve, reject) => {
    //Get rid of all listeners to prepare the socket to be reused
    socket.removeAllListeners()

    function errorHandler(reason: string) {
      return function(originalError?: Error) {
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
        processResponse()
      }
    })

    function sendRequest() {
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
    }

    //@ts-expect-error https://github.com/DefinitelyTyped/DefinitelyTyped/pull/59397 lib definitions are missing a property
    //Send the request either as soon as the socket is ready or immediatly if its already ready
    if(socket.readyState === "open") {
      sendRequest()
    } else {
      socket.once("ready", sendRequest)
    }
  })
}

export function sendTopic(config: SingleRunConfiguration): Promise<TopicReturnType> {
  const socket = createConnection({
    family: 4,
    host: config.host,
    port: config.port,
    timeout: config.timeout
  })
  return _sendTopic(socket, config.topic).then(val => {
    socket.end()
    return val
  })
}

export function createTopicConnection(config: SocketConfig): TopicConnection {
  const socket = createConnection({
    family: 4,
    host: config.host,
    port: config.port
  })
  const queue: Array<[query: string, resolve: (value: TopicReturnType) => void, reject: (reason?: any) => void]> = []
  let busy = false

  function runNextTopic<T>(value: T) {
    const next = queue.shift()
    if(!next) {
      busy = false
      socket.setTimeout(0)
      return value
    }
    const [topic, resolve, reject] = next;
    _sendTopic(socket, topic).then(runNextTopic).then(resolve).catch(reject)

    return value
  }

  return {
    send: topic => {
      if (socket.destroyed) {
        return Promise.reject(new Error("Socket is destroyed"))
      }
      //Immediate
      if(!busy) {
        busy = true
        socket.setTimeout(config.timeout ?? 10000)
        return _sendTopic(socket, topic).then(runNextTopic)
      }

      return new Promise((resolve, reject) => {
        queue.push([topic, resolve, reject])
      })
    },
    destroy: () => {
      socket.destroy()
    },
    get queueLength() {
      //Busy means we are processing a query right now
      return queue.length + Number(busy)
    },
    get destroyed() {
      return socket.destroyed
    }
  }
}