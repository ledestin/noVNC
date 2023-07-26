const PACKET_START = 0;
const PACKET_CHUNK = 1;
const PACKET_END = 2;

const printDocument = async (data) => {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    document.body.appendChild(iframe);

    iframe.onload = () => {
        setTimeout(() => {
            iframe.focus();
            iframe.contentWindow.print();
        }, 1);
    };

    const blob = new Blob([new Uint8Array(data)], { type: "application/pdf" });
    iframe.src = URL.createObjectURL(blob);
}

export default (rfb) => {
    let documentSize = 0;
    let downloadedSize = 0;
    let documentData = [];

    rfb.onUnixRelayData = (name, payload) => {
        const array = Array.from(payload);
        const buffer = new Uint8Array(array).buffer;
        const packetData = new DataView(buffer);
        const packetId = packetData.getUint32(0, false);

        switch (packetId) {
            case PACKET_START:
                documentSize = packetData.getUint32(4, false);
                downloadedSize = 0;
                console.log(`Downloading document for printing (${documentSize}B)`);
                break;
            
            case PACKET_CHUNK:
                let chunkSize = packetData.getUint32(4, false);
                let chunkData = new Uint8Array(buffer, 8);
                downloadedSize += chunkSize;
                documentData.push(...chunkData);
                console.log(`Downloading document for printing (${downloadedSize}/${documentSize}B)`);
                break;
            
            case PACKET_END:
                console.log(`Downloaded document for printing (${downloadedSize}/${documentSize}B)`);
                printDocument(documentData);
                downloadedSize = 0;
                documentSize = 0;
                break;

            default:
                console.error(`Unknown packet id: ${packetId}`);
                break;
        }
    }
  
    rfb.subscribeUnixRelay("printer");
}