# http2byond

A communication layer between node.js and BYOND game servers.

### Installation
`npm install --save http2byond`

### [Documentation](https://tigercat2000.github.io/http2byond/module-http2byond.html)

### Example
```javascript
var http2byond = require("http2byond");
var form = {
	ip: "localhost",
	port: "1024",
	topic:
		"?status"
}
http2byond(form, function (body, err) {
	if (err) throw err;
	console.log("Server Status:", body);
});
```