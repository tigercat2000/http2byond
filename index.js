/** @module http2byond */

// Dependencies.
const net = require('net');
const jspack = require('jspack');

/**
 * Callback required as the second argument to http2byond.
 *
 * @callback requestCallback
 * @param {string|number} body - UTF-8 string or number returned from the byond server.
 * @param {Error} err
 */

/**
 * Async communication with BYOND gameservers.
 * @param {Object} form - Settings object.
 * @param {string} form.ip - IP Address to communicate with.
 * @param {string} form.port - Port to use with the IP Address. Must match the port the game server is running on.
 * @param {string} form.topic - URL parameters to send to the gameserver. Must start with `?`.
 * @param {requestCallback} cb - Callback that handles the response.
 */
module.exports = function (form, cb) {
	try {
		var parameters = form.topic;
		if (parameters.charAt(0) !== "?") {
			parameters = "?" + parameters;
		}

		// Converts a string to buffer-compatible hex data.
		function string_to_charcodes (str) {
			var retArray = []
			for (var i = 0; i < str.length; i++) {
				retArray.push(str.charCodeAt(i));
			}
			return retArray;
		}

		// Custom packet creation- BYOND expects special packets, this is based off /tg/'s PHP scripts containing a reverse engineered packet format.
		var query = [0x00, 0x83];

		// Use an unsigned short for the "expected data length" portion of the packet.
		var pack = jspack.jspack.Pack("H", [parameters.length + 6]);
		query = query.concat(pack);

		// Padding between header and actual data.
		query = query.concat([0x00, 0x00, 0x00, 0x00, 0x00]);
		// Convert data into charcodes and add it to the array
		query = query.concat(string_to_charcodes(parameters));
		query.push(0x00);

		// Convert our new hex string into an actual buffer.
		var querybuff = Buffer.from(query);

		/* Networking section */
		/* Now that we have our data in a binary buffer, start sending and recieving data. */ 

		// Uses a normal net.Socket to send the custom packets.
		var socket = new net.Socket({
			readable: true,
			writable: true
		});

		// Timeout handler. Removed upon successful connection.
		var tHandler = function () {
			cb(undefined, new Error("Connection failed."));
			socket.destroy();
		};

		// Timeout after two seconds of inactivity, the game server is either extremely laggy or isn't up.
		socket.setTimeout(2000);
		// Add the event handler.
		socket.on("timeout", tHandler);

		// Error handler. If an error happens in the socket API, it'll be given back to us here.
		var eHandler = function (err) {
			cb(undefined, err);
			socket.destroy();
		};

		// Add the error handler.
		socket.on("error", eHandler);

		// Establish the connection to the server.
		socket.connect({
			port: form.port,
			host: form.ip,
			family: 4 // Use IPv4.
		});

		socket.on("connect", function () { // Socket successfully opened to the server. Ready to send and recieve data.
			// The timeout handler will interfere later, as the game server never sends an END packet.
			// So, we just wait for it to time out to ensure we have all the data.
			socket.removeListener("timeout", tHandler);

			// Send the custom buffer data over the socket.
			socket.write(querybuff);

			// Function decodes the returned data once it's fully assembled.
			function decode_buffer(dbuff) {
				// Confirm the return packet is in the BYOND format.
				if (dbuff[0] == 0x00 && dbuff[1] == 0x83) {
					// Start parsing the output.
					var sizearray = [dbuff[2], dbuff[3]];  // Array size of the type identifier and content.
					var sizebytes = jspack.jspack.Unpack("H", sizearray); // It's packed in an unsigned short format, so unpack it as an unsigned short.
					var size = sizebytes[0] - 1; // Byte size of the string/floating-point (minus the identifier byte).

					if (dbuff[4] == 0x2a) { // 4-byte big-endian floating point data.
						var unpackarray = [dbuff[5], dbuff[6], dbuff[7], dbuff[8]];
						var unpackint = jspack.jspack.Unpack("<f", unpackarray); // 4 possible bytes, add them up and unpack as a big-endian (non-network) float
						return unpackint[0];
					} else if (dbuff[4] = 0x06) { // ASCII String.
						var unpackString = "";
						var index = 5; // Buffer index to start searching from.

						while (size > 0) {
							size--;
							unpackString += String.fromCharCode(dbuff[index]);
							index++;
						}

						return unpackString;
					}

					// Something went wrong, the packet contains no apparent data. Error as "no data returned".
					cb(undefined, new Error("No data returned."));
					return null;
				}
			}

			// Recieve data in the form of a buffer.
			var assembledBuffer;
			socket.on("data", function (rbuff) {
				if (assembledBuffer) {
					assembledBuffer = Buffer.concat([assembledBuffer, rbuff]);
				} else {
					assembledBuffer = rbuff;
				}
			});

			// Since BYOND doesn't send END packets, wait for timeout before trying to parse the returned data.
			socket.on("timeout", function () {
				// Decode the assembled data.
				var recieved_data = decode_buffer(assembledBuffer);
				// The catch will deal with any errors from decode_buffer, but it could fail without erroring, so, make sure there's any data first.
				if (recieved_data) {
					cb(recieved_data);
				}

				// Assume the socket is done sending data, and close the connection.
				socket.end();
			});
		});
	} catch (error) {
		cb(undefined, error)
	}
};