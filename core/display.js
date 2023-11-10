/*
 * KasmVNC: HTML5 VNC client
 * Copyright (C) 2020 Kasm Technologies
 * Copyright (C) 2019 The noVNC Authors
 * Licensed under MPL 2.0 (see LICENSE.txt)
 *
 * See README.md for usage and integration instructions.
 */

import * as Log from './util/logging.js';
import Base64 from "./base64.js";
import { toSigned32bit } from './util/int.js';
import { isWindows } from './util/browser.js';

export default class Display {
    constructor(target) {
        Log.Debug(">> Display.constructor");

        // Is the display full
        this._full = false;

        // the full frame buffer (logical canvas) size
        this._fbWidth = 0;
        this._fbHeight = 0;

        this._renderMs = 0;
        this._prevDrawStyle = "";
        this._target = target;
        this._canvasWorker = new Worker("core/canvas.js");
        // Parse canvas worker messages
        this._canvasWorker.onmessage = (evt) => {
            let type = evt.data.type;
            switch (type) {
                case 'full':
                    // Tell rfb to send us more
                    if (! evt.data.message) {
                        this.onflush();
                    }
                    this._full = evt.data.message;
                    break;
                case 'performance':
                    // Update performance metrics
                    this._fps = evt.data.message.fps;
                    break;
            }
        };

        if (!this._target) {
            throw new Error("Target must be set");
        }

        if (typeof this._target === 'string') {
            throw new Error('target must be a DOM element');
        }

        if (!this._target.getContext) {
            throw new Error("no getContext method");
        }

        this._offscreen = this._target.transferControlToOffscreen();

        // the visible canvas viewport (i.e. what actually gets seen)
        this._viewportLoc = { 'x': 0, 'y': 0, 'w': this._target.width, 'h': this._target.height };

        Log.Debug("User Agent: " + navigator.userAgent);
        
	// Transfer canvas to worker
	this._canvasWorker.postMessage({canvas: this._offscreen}, [this._offscreen]);

        // ===== PROPERTIES =====

        this._scale = 1.0;
        this._clipViewport = false;
        this._antiAliasing = 0;
        this._fps = 0;

        // ===== EVENT HANDLERS =====

        this.onflush = () => {  }; // A flush request has finished

        Log.Debug("<< Display.constructor");
    }

    // ===== PROPERTIES =====
    
    get antiAliasing() { return this._antiAliasing; }
    set antiAliasing(value) {
        this._antiAliasing = value;
        this._rescale(this._scale);
    }

    get scale() { return this._scale; }
    set scale(scale) {
        this._rescale(scale);
    }

    get clipViewport() { return this._clipViewport; }
    set clipViewport(viewport) {
        this._clipViewport = viewport;
        // May need to readjust the viewport dimensions
        const vp = this._viewportLoc;
        this.viewportChangeSize(vp.w, vp.h);
        this.viewportChangePos(0, 0);
    }

    get width() {
        return this._fbWidth;
    }

    get height() {
        return this._fbHeight;
    }

    get renderMs() {
        return this._renderMs;
    }
    set renderMs(val) {
        this._renderMs = val;
    }

    get fps() { return this._fps; }

    // ===== PUBLIC METHODS =====

    pending() {
        return this._full;
    }

    viewportChangePos(deltaX, deltaY) {
        const vp = this._viewportLoc;
        deltaX = Math.floor(deltaX);
        deltaY = Math.floor(deltaY);

        if (!this._clipViewport) {
            deltaX = -vp.w;  // clamped later of out of bounds
            deltaY = -vp.h;
        }

        const vx2 = vp.x + vp.w - 1;
        const vy2 = vp.y + vp.h - 1;

        // Position change

        if (deltaX < 0 && vp.x + deltaX < 0) {
            deltaX = -vp.x;
        }
        if (vx2 + deltaX >= this._fbWidth) {
            deltaX -= vx2 + deltaX - this._fbWidth + 1;
        }

        if (vp.y + deltaY < 0) {
            deltaY = -vp.y;
        }
        if (vy2 + deltaY >= this._fbHeight) {
            deltaY -= (vy2 + deltaY - this._fbHeight + 1);
        }

        if (deltaX === 0 && deltaY === 0) {
            return;
        }
        Log.Debug("viewportChange deltaX: " + deltaX + ", deltaY: " + deltaY);
    }

    viewportChangeSize(width, height) {

        if (!this._clipViewport ||
            typeof(width) === "undefined" ||
            typeof(height) === "undefined") {

            Log.Debug("Setting viewport to full display region");
            width = this._fbWidth;
            height = this._fbHeight;
        }

        width = Math.floor(width);
        height = Math.floor(height);

        if (width > this._fbWidth) {
            width = this._fbWidth;
        }
        if (height > this._fbHeight) {
            height = this._fbHeight;
        }

        const vp = this._viewportLoc;
        if (vp.w !== width || vp.h !== height) {
            vp.w = width;
            vp.h = height;

            this._canvasWorker.postMessage({
                type: 'resize',
                width: width,
                height: height
            });

            // The position might need to be updated if we've grown
            this.viewportChangePos(0, 0);

            // Update the visible size of the target canvas
            this._rescale(this._scale);
        }
    }

    absX(x) {
        if (this._scale === 0) {
            return 0;
        }
        return toSigned32bit(x / this._scale + this._viewportLoc.x);
    }

    absY(y) {
        if (this._scale === 0) {
            return 0;
        }
        return toSigned32bit(y / this._scale + this._viewportLoc.y);
    }

    resize(width, height) {
        this._prevDrawStyle = "";

        this._fbWidth = width;
        this._fbHeight = height;

        this._canvasWorker.postMessage({
            type: 'resize',
            width: width,
            height: height
        });

        // Readjust the viewport as it may be incorrectly sized
        // and positioned
        const vp = this._viewportLoc;
        this.viewportChangeSize(vp.w, vp.h);
        this.viewportChangePos(0, 0);
    }

    fillRect(x, y, width, height, color, frame_id, fromQueue) {
        this._canvasWorker.postMessage({
            type: 'fill',
            x: x,
            y: y,
            width: width,
            height: height,
            color: color,
            frame_id: frame_id
        });
    }

    copyImage(oldX, oldY, newX, newY, w, h, frame_id, fromQueue) {
        this._canvasWorker.postMessage({
            type: 'copy',
            x: x,
            y: y,
            w: w,
            h: h,
            oldX: oldX,
            oldY: oldY,
            newX: newX,
            newY: newY,
            frame_id: frame_id
        });
    }

    imageRect(x, y, width, height, mime, arr, frame_id) {
        /* The internal logic cannot handle empty images, so bail early */
        if ((width === 0) || (height === 0)) {
            return;
        }
        this._canvasWorker.postMessage({
            type: 'img',
            x: x,
            y: y,
            mime: mime,
            buffer: arr,
            frame_id: frame_id
        }, [arr])
        arr = null;
    }

    decodedRect(x, y, width, height, videoFrame, frame_id) {
        this._canvasWorker.postMessage({
            type: 'videoframe',
            x: x,
            y: y,
            width: width,
            height: height,
            video_frame: videoFrame,
            frame_id: frame_id
        }, [videoFrame]);
    }

    transparentRect(x, y, width, height, img, frame_id) {
        /* The internal logic cannot handle empty images, so bail early */
        if ((width === 0) || (height === 0)) {
            return;
        }

        var rect = {
            'type': 'transparent',
            'img': null,
            'x': x,
            'y': y,
            'width': width,
            'height': height,
            'frame_id': frame_id
        }

        let imageBmpPromise = createImageBitmap(img);
        imageBmpPromise.then( function(img) {
            rect.img = img;
            rect.img.complete = true;
        }.bind(rect) );

        this._asyncRenderQPush(rect);
    }

    blitImage(x, y, width, height, arr, offset, frame_id, fromQueue) {
        let buffer = arr.buffer;
        this._canvasWorker.postMessage({
            type: 'put',
            x: x,
            y: y,
            width: width,
            height: height,
            buffer: buffer,
            offset: offset,
            byteOffset: arr.byteOffset,
            frame_id: frame_id
        }, [buffer]);
    }

    blitImageQ(x, y, width, height, arr, offset, frame_id, fromQueue) {
        this._canvasWorker.postMessage({
            type: 'put',
            x: x,
            y: y,
            width: width,
            height: height,
            buffer: arr,
            offset: offset,
            byteOffset: arr.byteOffset,
            frame_id: frame_id
        }, [arr]);
    }

    autoscale(containerWidth, containerHeight, scaleRatio=0) {

        if (containerWidth === 0 || containerHeight === 0) {
            scaleRatio = 0;

        } else if (scaleRatio === 0) {

            const vp = this._viewportLoc;
            const targetAspectRatio = containerWidth / containerHeight;
            const fbAspectRatio = vp.w / vp.h;

            if (fbAspectRatio >= targetAspectRatio) {
                scaleRatio = containerWidth / vp.w;
            } else {
                scaleRatio = containerHeight / vp.h;
            }
        }

        this._rescale(scaleRatio);
    }

    // ===== PRIVATE METHODS =====

    _rescale(factor) {
        this._scale = factor;
        const vp = this._viewportLoc;

        // NB(directxman12): If you set the width directly, or set the
        //                   style width to a number, the canvas is cleared.
        //                   However, if you set the style width to a string
        //                   ('NNNpx'), the canvas is scaled without clearing.
        const width = factor * vp.w + 'px';
        const height = factor * vp.h + 'px';

        if ((this._target.style.width !== width) ||
            (this._target.style.height !== height)) {
            this._target.style.width = width;
            this._target.style.height = height;
        }

        Log.Info('Pixel Ratio: ' + window.devicePixelRatio + ', VNC Scale: ' + factor + 'VNC Res: ' + vp.w + 'x' + vp.h);

        var pixR = Math.abs(Math.ceil(window.devicePixelRatio));
        var isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;

        if (this.antiAliasing === 2 || (this.antiAliasing === 0 && factor === 1 && this._target.style.imageRendering !== 'pixelated' && pixR === window.devicePixelRatio && vp.w > 0)) {
            this._target.style.imageRendering = ((!isFirefox) ? 'pixelated' : 'crisp-edges' );
            Log.Debug('Smoothing disabled');
        } else if (this.antiAliasing === 1 || (this.antiAliasing === 0 && factor !== 1 && this._target.style.imageRendering !== 'auto')) {
            this._target.style.imageRendering = 'auto'; //auto is really smooth (blurry) using trilinear of linear
            Log.Debug('Smoothing enabled');
        }
    }

}
