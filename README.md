# http2byond

A communication layer between node.js and BYOND game servers.

### Installation
`npm install --save http2byond`

### [Documentation](https://tigercat2000.github.io/http2byond/http2byond.html)

### Example
```javascript
const {createTopicConnection} = require("./index.js");
let connection = createTopicConnection({
  host: "localhost",
  port: 6666
})

connection.send("status").then((body) => {
  console.log(body);
}, (err) => {
  console.error("ERR", err);
});

async function anAsyncFunction() {
  const result = connection.send("status");
}
```

OR

```javascript
const {sendTopic} = require("./index.js");

sendTopic({
  host: "localhost",
  port: 6666,
  topic: "status"
}).then((body) => {
  console.log(body);
}, (err) => {
  console.error("ERR", err);
});

async function anAsyncFunction() {
  const result = await sendTopic({
    host: "localhost",
    port: 6666,
    topic: "status"
  });
}
```