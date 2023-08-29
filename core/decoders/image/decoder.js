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
        let imageDecoder = new ImageDecoder({
            data: evt.data.image,
            type: "image/" + evt.data.format
        });
        let result = await imageDecoder.decode();
        if (!arr) {
          arr = new Uint8Array(evt.data.sabR);
        }
        imageDecoder.close();
        self.postMessage({
          result: 0,
          width: evt.data.width,
          height: evt.data.height,
          x: evt.data.x,
          y: evt.data.y,
          frame_id: evt.data.frame_id,
          videoframe: result.image
        }, [result.image]);
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
