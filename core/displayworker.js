var canvas;
var ctx;

self.addEventListener('message', function(event) {
    if (event.data.hasOwnProperty('canvas')) {
        canvas = event.data.canvas;
        ctx = canvas.getContext("2d");
    }
    if (event.data.hasOwnProperty('drawFrame')) {
        let rect = event.data.drawFrame;
        ctx.drawImage(rect.img, rect.x, rect.y, rect.w, rect.h);
        // Send data back for garbage collection
        postMessage({close: event.data.drawFrame.img});
    }
    if (event.data.hasOwnProperty('blitBuf')) {
        let rect = event.data.blitBuf;
        let data = new Uint8ClampedArray(rect.data,
                                         rect.data.length + rect.offset,
                                         rect.width * rect.height * 4);
        let img = new ImageData(data, rect.width, rect.height);
        ctx.putImageData(img, rect.x, rect.y);
        // Send data back for garbage collection
        postMessage({freemem: event.data.blitBuf.data});
    }
    if (event.data.hasOwnProperty('fill')) {
        let rect = event.data.fill;
        let color = rect.color;
        let style = 'rgb(' + color[0] + ',' + color[1] + ',' + color[2] + ')';
        ctx.fillStyle = style;
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
    if (event.data.hasOwnProperty('copy')) {
        let rect = event.data.copy;
        ctx.mozImageSmoothingEnabled = false;
        ctx.webkitImageSmoothingEnabled = false;
        ctx.msImageSmoothingEnabled = false;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(canvas,
                      rect.oldX, rect.oldY, rect.w, rect.h,
                      rect.newX, rect.newY, rect.w, rect.h);
    }
});

