/** @module http2byond */

// Dependencies.
const net = require('net');
const jspack = require('jspack');

/**
 * Object used for http2byond settings.
 * @typedef {Object} infoForm
 * @property {string} ip - IP Address to communicate with.
 * @property {string} port - Port to use with the IP Address. Must match the port the game server is running on.
 * @property {string} topic - URL parameters to send to the gameserver. Must start with `?`.
 */

/**
 * Callback required as the second argument to http2byond.
 *
 * @callback requestCallback
 * @param {string|number} body - UTF-8 string or number returned from the byond server.
 * @param {Error} err
 */

/**
 * Async communication with the BYOND server.
 * @param {infoForm} form - Settings object.
 * @param {requestCallback} cb - Callback that handles the response.
 */
module.exports = function (form, cb) {
	try {
		var parameters = form.topic;
		if (parameters.charAt(0) !== "?") {
			parameters = "?" + parameters;
		}

		// Converts a string to buffer-compatible hex data.
		function string_to_hex (str) {
			var newstr = "";
			for (var i = 0; i < str.length; i++) {
				var charcode = str.charCodeAt(i);
				newstr += charcode.toString(16);
			}
			return newstr;
		}

		// jspack returns an array of ascii values encoded in decimal. Have to convert them to hex for the buffer.
		function sanitize_jspack (pack) {
			var rarray = [];
			for (var i = 0; i < pack.length; i++) {
				var hexNum = pack[i].toString(16); // Convert number to hex.
				if (hexNum.length < 2) {
					// jspack does not pad decimal numbers, so we have to do it by hand for the packet bytes.
					hexNum.length < 1 ? hexNum = "00" : hexNum += "0";
				}
				rarray.push(hexNum);
			}
			return rarray;
		}

		// Custom packet creation- BYOND expects special packets, this is based off /tg/'s PHP scripts containing a reverse engineered packet format.
		// It's easier to make an array of 2-bit hex strings and convert it into a buffer later than make a dynamically sized buffer.
		var query = ["00", "83"];

		// Use an unsigned short for the "expected data length" portion of the packet.
		var pack = jspack.jspack.Pack("H", [parameters.length + 6]);
		query = query.concat(sanitize_jspack(pack));

		// Padding between header and actual data.
		query = query.concat(["00", "00", "00", "00", "00"]);
		// Convert data into hex and add it to the array
		query.push(string_to_hex(parameters));
		query.push("00");

		// Now that all of the bits are nicely sorted in an array, scrunch them together in a big hex string for the buffer input.
		query = query.join("");

		// Convert our new hex string into an actual buffer.
		var querybuff = Buffer.from(query, "hex");

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