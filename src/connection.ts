import { createConnection, type Socket } from 'node:net';
import { mergeUint8Arrays } from './util/helpers';
import { parseResponse, type BoltMessage } from './message';

interface Transport {
	connect(): Promise<void>;
	write(data: Uint8Array): Promise<void>;
	onData(handler: (chunk: Uint8Array) => void): void;
	close(): void;
}

class TcpTransport implements Transport {
	private socket?: Socket;

	constructor(
		private host: string,
		private port: number,
	) {}

	connect(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.socket = createConnection(
				{ host: this.host, port: this.port },
				resolve,
			);
			this.socket.once('error', reject);
		});
	}

	write(data: Uint8Array): Promise<void> {
		return new Promise((resolve, reject) => {
			this.socket?.write(data, (err: Error | null) =>
				err ? reject(err) : resolve(),
			);
		});
	}

	onData(handler: (chunk: Uint8Array) => void): void {
		this.socket?.on('data', handler);
	}

	close(): void {
		this.socket?.destroy();
	}
}

class WebSocketTransport implements Transport {
	private ws?: WebSocket;

	constructor(private url: string) {}

	connect(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.ws = new WebSocket(this.url, 'bolt');
			this.ws.binaryType = 'arraybuffer';
			this.ws.onopen = () => resolve();
			this.ws.onerror = () =>
				reject(new Error(`WebSocket connection failed: ${this.url}`));
		});
	}

	write(data: Uint8Array): Promise<void> {
		this.ws?.send(data);
		return Promise.resolve();
	}

	onData(handler: (chunk: Uint8Array) => void): void {
		if (this.ws) {
			this.ws.onmessage = (e) => handler(new Uint8Array(e.data as ArrayBuffer));
		}
	}

	close(): void {
		this.ws?.close();
	}
}

export class BoltConnection {
	private buffer: Uint8Array = new Uint8Array(0);
	private messageQueue: BoltMessage[] = [];
	private messageResolvers: Array<(msg: BoltMessage) => void> = [];

	// Separate buffer/resolver queue used only during the raw handshake phase
	private rawBuffer: Uint8Array = new Uint8Array(0);
	private rawResolvers: Array<{
		n: number;
		resolve: (data: Uint8Array) => void;
	}> = [];

	constructor(private transport: Transport) {}

	static tcp(host: string, port = 7687): BoltConnection {
		return new BoltConnection(new TcpTransport(host, port));
	}

	static webSocket(url: string): BoltConnection {
		return new BoltConnection(new WebSocketTransport(url));
	}

	async connect(): Promise<void> {
		await this.transport.connect();
		this.transport.onData((chunk) => this.handleData(chunk));
	}

	private handleData(chunk: Uint8Array): void {
		if (this.rawResolvers.length > 0) {
			this.rawBuffer = mergeUint8Arrays(this.rawBuffer, chunk);
			this.drainRawResolvers();
			// If raw resolvers are now exhausted, remaining bytes are Bolt messages
			if (this.rawResolvers.length === 0 && this.rawBuffer.length > 0) {
				this.buffer = mergeUint8Arrays(this.buffer, this.rawBuffer);
				this.rawBuffer = new Uint8Array(0);
				this.processBuffer();
			}
			return;
		}
		this.buffer = mergeUint8Arrays(this.buffer, chunk);
		this.processBuffer();
	}

	private drainRawResolvers(): void {
		while (this.rawResolvers.length > 0) {
			const { n, resolve } = this.rawResolvers[0];
			if (this.rawBuffer.length < n) break;
			this.rawResolvers.shift();
			resolve(this.rawBuffer.slice(0, n));
			this.rawBuffer = this.rawBuffer.slice(n);
		}
	}

	private processBuffer(): void {
		while (true) {
			const result = this.tryExtractMessage();
			if (!result) break;
			const { raw, consumed } = result;
			this.buffer = this.buffer.slice(consumed);
			const parsed = parseResponse(raw);
			if (this.messageResolvers.length > 0) {
				this.messageResolvers.shift()?.(parsed);
			} else {
				this.messageQueue.push(parsed);
			}
		}
	}

	/**
	 * Attempts to extract one complete Bolt message (terminated by a 0x00 0x00
	 * end-of-message chunk) from the internal buffer. Returns null if there is
	 * not yet enough data for a complete message.
	 */
	private tryExtractMessage(): { raw: Uint8Array; consumed: number } | null {
		const parts: Uint8Array[] = [];
		let offset = 0;
		while (offset + 2 <= this.buffer.length) {
			const size = (this.buffer[offset] << 8) | this.buffer[offset + 1];
			offset += 2;
			if (size === 0) {
				return { raw: mergeUint8Arrays(...parts), consumed: offset };
			}
			if (offset + size > this.buffer.length) {
				return null; // incomplete chunk, wait for more data
			}
			parts.push(this.buffer.slice(offset, offset + size));
			offset += size;
		}
		return null;
	}

	/** Receive exactly `n` raw bytes. Used only for the initial handshake. */
	rawReceive(n: number): Promise<Uint8Array> {
		if (this.rawBuffer.length >= n) {
			const data = this.rawBuffer.slice(0, n);
			this.rawBuffer = this.rawBuffer.slice(n);
			return Promise.resolve(data);
		}
		return new Promise((resolve) => {
			this.rawResolvers.push({ n, resolve });
		});
	}

	async rawSend(data: Uint8Array): Promise<void> {
		await this.transport.write(data);
	}

	async send(data: Uint8Array): Promise<void> {
		await this.transport.write(data);
	}

	receiveOne(): Promise<BoltMessage> {
		const queued = this.messageQueue.shift();
		if (queued) {
			return Promise.resolve(queued);
		}
		return new Promise((resolve) => {
			this.messageResolvers.push(resolve);
		});
	}

	close(): void {
		this.transport.close();
	}
}
