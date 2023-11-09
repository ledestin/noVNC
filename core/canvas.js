// Globals
var maxFramesQ = 3;
var canvas;
var ctx;
var oldFill;
var drawQ = {};
var putQ = {};
var copyQ = {};
var fillQ = {};
var frames = new Set();
var full = false;

// Main logic loop
function processQ() {
  // Sort frame keys into array
  let framesQ = Array.from(frames).sort();
  if (framesQ.length > maxFramesQ) {
    self.postMessage({
      type: 'full',
      message: true
    })
  } else {
    self.postMessage({
      type: 'full',
      message: false
    })
  }
  if (framesQ.length) {
    // Always process the oldest frame
    let currentFrame = framesQ[0];
    frames.delete(currentFrame);
    // Process all canvas operation types
    renderDraws(currentFrame);
    renderPuts(currentFrame);
    renderCopies(currentFrame);
    renderFills(currentFrame);
  }
  // Fire again
  requestAnimationFrame(processQ);
}
processQ();

// Render Draw operations
function renderDraws(frame) {
  if (drawQ.hasOwnProperty(frame)) {
    let arr = drawQ[frame];
    delete drawQ[frame];
    for (i = 0; i < arr.length; i++) {
      ctx.drawImage(arr[i].videoFrame, arr[i].x, arr[i].y);
      arr[i].videoFrame.close();
    }
    arr = null;
  }
}

// Render Put operations
function renderPuts(frame) {
  if (putQ.hasOwnProperty(frame)) {
    let arr = putQ[frame];
    delete putQ[frame];
    for (i = 0; i < arr.length; i++) {
      ctx.putImageData(arr[i].img, arr[i].x, arr[i].y);
    }
    arr = null;
  }
}

// Render Copy operations
function renderCopies(frame) {
  if (copyQ.hasOwnProperty(frame)) {
    let arr = copyQ[frame];
    delete copyQ[frame];
    for (i = 0; i < arr.length; i++) {
      ctx.mozImageSmoothingEnabled = false;
      ctx.webkitImageSmoothingEnabled = false;
      ctx.msImageSmoothingEnabled = false;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        canvas,
        arr[i].oldX,
        arr[i].oldY,
        arr[i].w,
        arr[i].h,
        arr[i].newX,
        arr[i].newY,
        arr[i].w,
        arr[i].h
      );
    }
  }
}

// Render Fill operations
function renderFills(frame) {
  if (fillQ.hasOwnProperty(frame)) {
    let arr = fillQ[frame];
    delete fillQ[frame];
    for (i = 0; i < arr.length; i++) {
      if (arr[i].fill !== oldFill) {
        ctx.fillStyle = arr[i].fill;
        oldFill = arr[i].fill;
      }
      ctx.fillRect(arr[i].x, arr[i].y, arr[i].w, arr[i].h);
    }
  }
}

// Listen for messages and add to process arrays
self.addEventListener('message', function(evt) {
  // Init offscreen canvas when passed
  if (evt.data.canvas) {
    canvas = evt.data.canvas;
    ctx = canvas.getContext('2d');
  } else {
    let type = evt.data.type;
    switch (type) {
      // Simple canvas resize
      case 'resize':
        canvas.width = evt.data.width;
        canvas.height = evt.data.height;
        break;
      // Add canvas color drawing to the queue
      case 'fill':
        frames.add(evt.data.frame_id)
        let color = evt.data.color;
        let fill = 'rgb(' + color[0] + ',' + color[1] + ',' + color[2] + ')';
        let fillRect = {
          fill: fill,
          x: evt.data.x,
          y: evt.data.y,
          w: evt.data.width,
          h: evt.data.height
        }
        if (! fillQ.hasOwnProperty(evt.data.frame_id)) {
          fillQ[evt.data.frame_id] = [];
        }
        fillQ[evt.data.frame_id].push(fillRect);
        break;
      // Put raw image data into the queue
      case 'put':
        frames.add(evt.data.frame_id)
        let width = evt.data.width;
        let height = evt.data.height;
        let data = new Uint8ClampedArray(evt.data.buffer,evt.data.byteOffset + evt.data.offset, width * height * 4);
        let img = new ImageData(data, width, height);
        let putRect = {
          img: img,
          x: evt.data.x,
          y: evt.data.y
        }
        if (! putQ.hasOwnProperty(evt.data.frame_id)) {
          putQ[evt.data.frame_id] = [];
        }
        putQ[evt.data.frame_id].push(putRect);
        evt = null;
        break;
      // Decode an image and add it to queue
      case 'img':
        frames.add(evt.data.frame_id)
        let imageDecoder = new ImageDecoder({
          data: evt.data.buffer,
          type: evt.data.mime
        });
        imageDecoder.decode().then(function (result){
          let drawRect = {
            videoFrame: result.image,
            x: evt.data.x,
            y: evt.data.y
          }
          if (! drawQ.hasOwnProperty(evt.data.frame_id)) {
            drawQ[evt.data.frame_id] = [];
          }
          drawQ[evt.data.frame_id].push(drawRect);
          imageDecoder.close();
          evt = null;
        });
        break;
      // Add copy operations to the queue
      case 'copy':
        frames.add(evt.data.frame_id)
        let copyRect = {
          oldX: evt.data.oldX,
          oldY: evt.data.oldY,
          w: evt.data.w,
          h: evt.data.h,
          newX: evt.data.newX,
          newY: evt.data.newY,
        }
        if (! copyQ.hasOwnProperty(evt.data.frame_id)) {
          copyQ[evt.data.frame_id] = [];
        }
        copyQ[evt.data.frame_id].push(copyRect);
        break;
    }
  }
}, false);

