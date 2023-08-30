const RELAY_NAME = "fido";

const PACKETS = {
  CREDENTIALS_CREATE_REQUEST: 0,
  CREDENTIALS_VERIFY_REQUEST: 1,
};

const formatDate = (date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

const createCredentials = async () => {
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);

  const userName = `admin@kasm.local | ${formatDate(new Date())}`;
  const userId = new Uint8Array(16);
  crypto.getRandomValues(userId);

  try {
    return navigator.credentials.create({
      publicKey: {
        challenge: challenge,
        rp: {
          name: "Kasm Yubikey",
          id: window.location.hostname,
        },
        user: {
          id: userId,
          name: userName,
          displayName: userName,
        },
        pubKeyCredParams: [
          {
            type: "public-key",
            alg: -7, // ES256
          },
          {
            type: "public-key",
            alg: -257, // RS256
          },
        ],
        timeout: 60000,
        excludeCredentials: [],
        attestation: "direct",
        authenticatorSelection: {
          requireResidentKey: false,
          residentKey: "discouraged",
          userVerification: "discouraged"
        },
      },
    });
  } catch (err) {
    console.error("Error creating credentials", err);
  }
};

const verifyCredentials = async (credentialId) => {
  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    
    return navigator.credentials.get({
      publicKey: {
        challenge: challenge,
        timeout: 60000,
        rpId: window.location.hostname,
        allowCredentials: [
          {
            type: "public-key",
            id: credentialId
          }
        ],
        userVerification: "discouraged"
      },
    });
  } catch (err) {
    console.error("Error verifying credentials", err);
  }
};

export default (rfb) => {
  const processRelayData = async (payload) => {
    const array = Array.from(payload);
    const buffer = new Uint8Array(array).buffer;
    const packetData = new DataView(buffer);
    const packetId = packetData.getUint32(0, false);

    switch (packetId) {
      case PACKETS.CREDENTIALS_CREATE_REQUEST:
        {
          const credential = await createCredentials();
          
          const encodedCredential = MessagePack.encode({
            ts: +new Date(),
            id: new Uint8Array(credential.rawId),
            rawId: credential.id,
          });
          rfb.sendUnixRelayData(RELAY_NAME, new Uint8Array(encodedCredential));
        }
        break;

      case PACKETS.CREDENTIALS_VERIFY_REQUEST:
        {
          const payload = MessagePack.decode(buffer.slice(4));
          const credential = await verifyCredentials(payload.id);
          const encodedCredential = MessagePack.encode({
            ts: +new Date(),
            id: new Uint8Array(credential.rawId),
            rawId: credential.id,
            user: new Uint8Array(credential.response.userHandle)
          });
          rfb.sendUnixRelayData(RELAY_NAME, new Uint8Array(encodedCredential));
        }
        break;
    }
  };

  rfb.subscribeUnixRelay(RELAY_NAME, processRelayData);
};
