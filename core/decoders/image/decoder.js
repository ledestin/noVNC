var path;

var base64Pad = '=';
var decoder = new TextDecoder();
var encoder = new TextEncoder();
var alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
var encodeLookup = Object.fromEntries(Array.from(alphabet).map((a, i) => [i, a.charCodeAt(0)]));

function encode(bytes) {
    let m = bytes.length;
    let k = m % 3;
    let n = Math.floor(m / 3) * 4 + (k && k + 1);
    let N = Math.ceil(m / 3) * 4;
    let encoded = new Uint8Array(N);

    for (let i = 0, j = 0; j < m; i += 4, j += 3) {
        let y = (bytes[j] << 16) + (bytes[j + 1] << 8) + (bytes[j + 2] | 0);
        encoded[i] = encodeLookup[y >> 18];
        encoded[i + 1] = encodeLookup[(y >> 12) & 0x3f];
        encoded[i + 2] = encodeLookup[(y >> 6) & 0x3f];
        encoded[i + 3] = encodeLookup[y & 0x3f];
    }

    let base64 = decoder.decode(new Uint8Array(encoded.buffer, 0, n));
    if (k === 1) base64 += '==';
    if (k === 2) base64 += '=';
    return base64;
}

var toBinaryTable = [
    -1,-1,-1,-1, -1,-1,-1,-1, -1,-1,-1,-1, -1,-1,-1,-1,
    -1,-1,-1,-1, -1,-1,-1,-1, -1,-1,-1,-1, -1,-1,-1,-1,
    -1,-1,-1,-1, -1,-1,-1,-1, -1,-1,-1,62, -1,-1,-1,63,
    52,53,54,55, 56,57,58,59, 60,61,-1,-1, -1, 0,-1,-1,
    -1, 0, 1, 2,  3, 4, 5, 6,  7, 8, 9,10, 11,12,13,14,
    15,16,17,18, 19,20,21,22, 23,24,25,-1, -1,-1,-1,-1,
    -1,26,27,28, 29,30,31,32, 33,34,35,36, 37,38,39,40,
    41,42,43,44, 45,46,47,48, 49,50,51,-1, -1,-1,-1,-1
];

function decode(data, offset = 0) {
    let dataLength = data.indexOf('=') - offset;
    if (dataLength < 0) { dataLength = data.length - offset; }

    /* Every four characters is 3 resulting numbers */
    const resultLength = (dataLength >> 2) * 3 + Math.floor((dataLength % 4) / 1.5);
    const result = new Array(resultLength);

    // Convert one by one.

    let leftbits = 0; // number of bits decoded, but yet to be appended
    let leftdata = 0; // bits decoded, but yet to be appended
    for (let idx = 0, i = offset; i < data.length; i++) {
        const c = toBinaryTable[data.charCodeAt(i) & 0x7f];
        const padding = (data.charAt(i) === base64Pad);
        // Skip illegal characters and whitespace
        if (c === -1) {
            console.log("Illegal character code " + data.charCodeAt(i) + " at position " + i);
            continue;
        }

        // Collect data into leftdata, update bitcount
        leftdata = (leftdata << 6) | c;
        leftbits += 6;

        // If we have 8 or more bits, append 8 bits to the result
        if (leftbits >= 8) {
            leftbits -= 8;
            // Append if not padding.
            if (!padding) {
                result[idx++] = (leftdata >> leftbits) & 0xff;
            }
            leftdata &= (1 << leftbits) - 1;
        }
    }

    // If there are any bits left, the base64 string was corrupted
    if (leftbits) {
        const err = new Error('Corrupted base64 string');
        err.name = 'Base64-Error';
        throw err;
    }

    return result;
}

async function run() {
  self.addEventListener('message', async function(evt) {
    if (evt.data.path) {
      path = evt.data.path;
      //Send message that worker is ready
      self.postMessage({
        result: 1
      })
    } else {
      try {
        let base64 = encode(new Uint8Array(evt.data.image));
        let imageData = encoder.encode(base64).buffer;
        self.postMessage({
          result: 0,
          width: evt.data.width,
          height: evt.data.height,
          x: evt.data.x,
          y: evt.data.y,
          format: evt.data.format,
          frame_id: evt.data.frame_id,
          base64: imageData
        }, [imageData]);
      } catch (err) {
        self.postMessage({
          result: 2,
          error: err
        });
      }
    }
  }, false);
}

run();
