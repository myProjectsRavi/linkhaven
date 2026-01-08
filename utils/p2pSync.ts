/**
 * P2P Air-Gap Sync - WebRTC Direct Device Sync
 * 
 * CONCEPT: Sync between phone and laptop WITHOUT any cloud server
 * 
 * MECHANISM:
 * 1. Device A generates WebRTC offer, encodes as QR code
 * 2. Device B scans QR, parses offer, generates answer QR
 * 3. Device A scans answer QR, connection established
 * 4. Encrypted IndexedDB data streams directly device-to-device
 * 
 * TECHNICAL DETAILS:
 * - Uses RTCDataChannel for binary data transfer
 * - DTLS encryption (built into WebRTC)
 * - Requires STUN server for NAT traversal (Google's free STUN servers)
 * - NO TURN server needed for most cases (direct P2P)
 * 
 * PRIVACY:
 * - No data touches any server
 * - Only STUN server sees IP addresses (normal for WebRTC)
 * - Encrypted vault data transferred as AES-256-GCM ciphertext
 * 
 * LIMITATIONS:
 * - Both devices must be on same network OR have working NAT traversal
 * - QR scanning requires camera permission
 * - Large datasets may take a few seconds to transfer
 * 
 * ZERO COST - Uses free Google STUN servers
 */

// STUN servers for NAT traversal (free, public)
const STUN_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
];

// Chunk size for data transfer (16KB optimal for WebRTC)
const CHUNK_SIZE = 16384;

// Signaling data (exchanged via QR codes)
export interface SignalingData {
    type: 'offer' | 'answer';
    sdp: string;
    iceCandidates: RTCIceCandidateInit[];
}

// Sync session state
export interface P2PSyncSession {
    peerConnection: RTCPeerConnection;
    dataChannel: RTCDataChannel | null;
    isInitiator: boolean;
    status: 'initializing' | 'waiting-for-answer' | 'connecting' | 'connected' | 'transferring' | 'complete' | 'error';
    error?: string;
    transferProgress?: number;
}

// Events emitted during sync
export type P2PSyncEvent =
    | { type: 'status-change'; status: P2PSyncSession['status'] }
    | { type: 'offer-ready'; offer: SignalingData }
    | { type: 'connected' }
    | { type: 'data-received'; data: Uint8Array }
    | { type: 'progress'; percent: number }
    | { type: 'complete' }
    | { type: 'error'; error: string };

export type P2PSyncEventHandler = (event: P2PSyncEvent) => void;

/**
 * Create a new P2P sync session as the initiator (Device A)
 * Generates offer that should be displayed as QR code
 */
export async function createP2PSession(
    onEvent: P2PSyncEventHandler
): Promise<{ session: P2PSyncSession; offer: SignalingData }> {
    const peerConnection = new RTCPeerConnection({
        iceServers: STUN_SERVERS
    });

    const session: P2PSyncSession = {
        peerConnection,
        dataChannel: null,
        isInitiator: true,
        status: 'initializing'
    };

    // Collect ICE candidates
    const iceCandidates: RTCIceCandidateInit[] = [];

    return new Promise((resolve, reject) => {
        // Create data channel (must be done before offer)
        const dataChannel = peerConnection.createDataChannel('sync', {
            ordered: true
        });

        session.dataChannel = dataChannel;

        // Handle data channel events
        dataChannel.onopen = () => {
            session.status = 'connected';
            onEvent({ type: 'status-change', status: 'connected' });
            onEvent({ type: 'connected' });
        };

        dataChannel.onmessage = (event) => {
            if (event.data instanceof ArrayBuffer) {
                onEvent({ type: 'data-received', data: new Uint8Array(event.data) });
            }
        };

        dataChannel.onerror = (error) => {
            session.status = 'error';
            session.error = String(error);
            onEvent({ type: 'error', error: session.error });
        };

        // Collect ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                iceCandidates.push(event.candidate.toJSON());
            }
        };

        // Wait for ICE gathering to complete
        peerConnection.onicegatheringstatechange = () => {
            if (peerConnection.iceGatheringState === 'complete') {
                const offer: SignalingData = {
                    type: 'offer',
                    sdp: peerConnection.localDescription?.sdp || '',
                    iceCandidates
                };

                session.status = 'waiting-for-answer';
                onEvent({ type: 'status-change', status: 'waiting-for-answer' });
                onEvent({ type: 'offer-ready', offer });

                resolve({ session, offer });
            }
        };

        // Create offer
        peerConnection.createOffer()
            .then(offer => peerConnection.setLocalDescription(offer))
            .catch(error => {
                session.status = 'error';
                session.error = error.message;
                reject(error);
            });
    });
}

/**
 * Join an existing P2P session (Device B)
 * Takes the scanned offer and returns an answer to display as QR
 */
export async function joinP2PSession(
    offer: SignalingData,
    onEvent: P2PSyncEventHandler
): Promise<{ session: P2PSyncSession; answer: SignalingData }> {
    const peerConnection = new RTCPeerConnection({
        iceServers: STUN_SERVERS
    });

    const session: P2PSyncSession = {
        peerConnection,
        dataChannel: null,
        isInitiator: false,
        status: 'initializing'
    };

    const iceCandidates: RTCIceCandidateInit[] = [];

    return new Promise((resolve, reject) => {
        // Handle incoming data channel
        peerConnection.ondatachannel = (event) => {
            const dataChannel = event.channel;
            session.dataChannel = dataChannel;

            dataChannel.onopen = () => {
                session.status = 'connected';
                onEvent({ type: 'status-change', status: 'connected' });
                onEvent({ type: 'connected' });
            };

            dataChannel.onmessage = (event) => {
                if (event.data instanceof ArrayBuffer) {
                    onEvent({ type: 'data-received', data: new Uint8Array(event.data) });
                }
            };
        };

        // Collect ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                iceCandidates.push(event.candidate.toJSON());
            }
        };

        // Wait for ICE gathering to complete
        peerConnection.onicegatheringstatechange = () => {
            if (peerConnection.iceGatheringState === 'complete') {
                const answer: SignalingData = {
                    type: 'answer',
                    sdp: peerConnection.localDescription?.sdp || '',
                    iceCandidates
                };

                session.status = 'connecting';
                onEvent({ type: 'status-change', status: 'connecting' });

                resolve({ session, answer });
            }
        };

        // Set remote description (the offer)
        peerConnection.setRemoteDescription({ type: 'offer', sdp: offer.sdp })
            .then(() => {
                // Add remote ICE candidates
                for (const candidate of offer.iceCandidates) {
                    peerConnection.addIceCandidate(candidate);
                }
                // Create answer
                return peerConnection.createAnswer();
            })
            .then(answer => peerConnection.setLocalDescription(answer))
            .catch(error => {
                session.status = 'error';
                session.error = error.message;
                reject(error);
            });
    });
}

/**
 * Complete the connection on Device A by processing the answer
 */
export async function completeP2PConnection(
    session: P2PSyncSession,
    answer: SignalingData,
    onEvent: P2PSyncEventHandler
): Promise<void> {
    try {
        await session.peerConnection.setRemoteDescription({ type: 'answer', sdp: answer.sdp });

        for (const candidate of answer.iceCandidates) {
            await session.peerConnection.addIceCandidate(candidate);
        }

        session.status = 'connecting';
        onEvent({ type: 'status-change', status: 'connecting' });
    } catch (error) {
        session.status = 'error';
        session.error = String(error);
        onEvent({ type: 'error', error: session.error });
        throw error;
    }
}

/**
 * Send data over the P2P connection
 * Automatically chunks large data for reliable transfer
 */
export async function sendP2PData(
    session: P2PSyncSession,
    data: Uint8Array,
    onEvent: P2PSyncEventHandler
): Promise<void> {
    if (!session.dataChannel || session.dataChannel.readyState !== 'open') {
        throw new Error('Data channel not ready');
    }

    session.status = 'transferring';
    onEvent({ type: 'status-change', status: 'transferring' });

    const totalChunks = Math.ceil(data.length / CHUNK_SIZE);

    // Send metadata first
    const metadata = JSON.stringify({
        type: 'linkhaven-sync',
        totalSize: data.length,
        totalChunks
    });
    session.dataChannel.send(new TextEncoder().encode(metadata));

    // Send chunks
    for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, data.length);
        const chunk = data.slice(start, end);

        session.dataChannel.send(chunk);

        const progress = Math.round(((i + 1) / totalChunks) * 100);
        onEvent({ type: 'progress', percent: progress });

        // Small delay to prevent buffer overflow
        if (i % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }

    session.status = 'complete';
    onEvent({ type: 'status-change', status: 'complete' });
    onEvent({ type: 'complete' });
}

/**
 * Encode signaling data for QR code (compressed)
 */
export function encodeForQR(data: SignalingData): string {
    // Minimize SDP by removing unnecessary lines
    const minimalData = {
        t: data.type === 'offer' ? 'o' : 'a',
        s: data.sdp
            .split('\n')
            .filter(line =>
                line.startsWith('v=') ||
                line.startsWith('o=') ||
                line.startsWith('s=') ||
                line.startsWith('c=') ||
                line.startsWith('t=') ||
                line.startsWith('a=group') ||
                line.startsWith('a=fingerprint') ||
                line.startsWith('a=ice-ufrag') ||
                line.startsWith('a=ice-pwd') ||
                line.startsWith('m=') ||
                line.startsWith('a=mid') ||
                line.startsWith('a=sctp-port') ||
                line.startsWith('a=setup')
            )
            .join('\n'),
        i: data.iceCandidates.slice(0, 3).map(c => c.candidate) // Only keep best candidates
    };

    return btoa(JSON.stringify(minimalData));
}

/**
 * Decode QR data back to signaling format
 */
export function decodeFromQR(encoded: string): SignalingData {
    const data = JSON.parse(atob(encoded));
    return {
        type: data.t === 'o' ? 'offer' : 'answer',
        sdp: data.s,
        iceCandidates: data.i.map((c: string) => ({ candidate: c }))
    };
}

/**
 * Close P2P session and clean up resources
 */
export function closeP2PSession(session: P2PSyncSession): void {
    session.dataChannel?.close();
    session.peerConnection.close();
}
