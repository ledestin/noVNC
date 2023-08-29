var path;
var canvas;
var ctx;

async function run() {
  self.addEventListener('message', async function(evt) {
    if (evt.data.path) {
      path = evt.data.path;
      canvas = evt.data.canvas;
      ctx = canvas.getContext('2d', {willReadFrequently:true}); 
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
        imageDecoder.close();
        canvas.width = evt.data.width;
        canvas.height = evt.data.height;
        ctx.drawImage(result.image, 0, 0);
        let imageData = ctx.getImageData(0,0,canvas.width,canvas.height);
        let buff = imageData.data.buffer;
        self.postMessage({
          result: 0,
          width: evt.data.width,
          height: evt.data.height,
          x: evt.data.x,
          y: evt.data.y,
          frame_id: evt.data.frame_id,
          videoframe: buff
        }, [buff]);
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
