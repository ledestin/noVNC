var arr;
var path;

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
        let length = evt.data.length;
        let data = new Uint8Array(evt.data.sab.slice(0, length));
        let imageDecoder = new ImageDecoder({
            data: data,
            type: "image/" + evt.data.format,
        });
        let result = await imageDecoder.decode();
        if (!arr) {
          arr = new Uint8Array(evt.data.sabR);
        }
        let buffer = new Uint8Array(result.image.allocationSize());
        let copy = await result.image.copyTo(buffer);
        let lengthR = buffer.length;
        arr.set(buffer);
        imageDecoder.close();
        self.postMessage({
          result: 0,
          length: lengthR,
          width: evt.data.width,
          height: evt.data.height,
          x: evt.data.x,
          y: evt.data.y,
          frame_id: evt.data.frame_id
        });
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
