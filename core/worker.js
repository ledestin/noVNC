var ports = [];
self.onconnect = function broker(e) {
    var port = e.ports[0];
    port.onmessage = function(e) {
        // Register display channel by it's ID
        if (e.data.hasOwnProperty('register')) {
            ports.push(port);
        }
        // Broker a rect
        if (e.data.hasOwnProperty('rect')) {
            let rect = e.data.rect;
            let screen = e.data.screenLocationIndex;
            ports[screen].postMessage({
                eventType: 'rect',
                rect: {
                    'type': 'vid',
                    'img': rect.img,
                    'x': rect.x,
                    'y': rect.y,
                    'width': rect.width,
                    'height': rect.height,
                    'frame_id': rect.frame_id,
                    'screenLocations': rect.screenLocations,
                    'vidType': rect.vidType
                },
                screenLocationIndex: screen
            }, [rect.img]);
        }
    }
}
