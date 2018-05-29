# http2byond

A communication layer between node.js and BYOND game servers.

### Installation
`npm install --save http2byond`

### [Documentation](https://tigercat2000.github.io/http2byond/http2byond.html)

### Example
```javascript
const http2byond = require("./index.js");
let connection = new http2byond({
	timeout: 2000
});

var form = {
	ip: "localhost",
	port: "6666",
	topic: "?status"
};

connection.run(form).then((body) => {
	console.log(body);
}, (err) => {
	console.error("ERR", err);
});
```