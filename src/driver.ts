import { HANDSHAKE, VERSIONS } from './handshake';
import { mergeUint8Arrays } from './util/helpers';
import { BoltConnection } from './connection';
import {
	createHelloMessage,
	createRunMessage,
	createPullMessage,
	createBeginMessage,
	createCommitMessage,
	createRollbackMessage,
	createGoodbyeMessage,
	createResetMessage,
	type AuthConfig,
} from './message';

export interface DriverConfig extends Partial<AuthConfig> {
	/** defaults to 'neo4j' */
	username?: string;
	/** defaults to 'neo4j' */
	password?: string;
}

export interface QueryResult {
	/** Column names returned by the query */
	keys: string[];
	/** Each record as a plain object keyed by column name */
	records: Record<string, unknown>[];
	/** Summary metadata returned by the server after PULL */
	summary: Record<string, unknown>;
}

function parseUrl(url: string): { scheme: string; host: string; port: number } {
	const match = url.match(/^(bolt(?:\+wss?)?):\/\/([^:/]+)(?::(\d+))?/);
	if (!match) throw new Error(`Invalid Bolt URL: ${url}`);
	return {
		scheme: match[1],
		host: match[2],
		port: match[3] ? Number.parseInt(match[3], 10) : 7687,
	};
}

export class BoltDriver {
	private connection: BoltConnection;
	private connected = false;
	private config: Required<AuthConfig>;

	/**
	 * Create a new driver instance.
	 *
	 * @param url  A Bolt connection URL.
	 *   - `bolt://host[:port]`       — TCP (default port 7687)
	 *   - `bolt+ws://host[:port]`    — WebSocket
	 *   - `bolt+wss://host[:port]`   — WebSocket over TLS
	 * @param config  Authentication and connection options.
	 *
	 * @example
	 * const driver = new BoltDriver('bolt://localhost:7687', {
	 *   username: 'neo4j',
	 *   password: 'password',
	 * });
	 * await driver.connect();
	 * const result = await driver.run('MATCH (n) RETURN n LIMIT 5');
	 * await driver.close();
	 */
	constructor(url: string, config: DriverConfig = {}) {
		const { scheme, host, port } = parseUrl(url);
		this.config = {
			username: config.username ?? 'neo4j',
			password: config.password ?? 'neo4j',
		};

		if (scheme === 'bolt') {
			this.connection = BoltConnection.tcp(host, port);
		} else if (scheme === 'bolt+ws' || scheme === 'bolt+wss') {
			const wsUrl = url.replace(/^bolt\+/, '');
			this.connection = BoltConnection.webSocket(wsUrl);
		} else {
			throw new Error(`Unsupported scheme: ${scheme}`);
		}
	}

	/**
	 * Open the connection and authenticate with the server.
	 * Must be called before any queries are run.
	 */
	async connect(): Promise<void> {
		await this.connection.connect();

		// Bolt handshake: magic preamble + version proposals
		await this.connection.rawSend(mergeUint8Arrays(HANDSHAKE, VERSIONS));

		// Server responds with 4 bytes indicating the selected version
		const versionBytes = await this.connection.rawReceive(4);
		const major = versionBytes[3];

		if (major === 0) {
			this.connection.close();
			throw new Error('Neo4j server does not support any offered Bolt version');
		}

		// Authenticate
		await this.connection.send(createHelloMessage(this.config));
		const hello = await this.connection.receiveOne();

		if (hello.type === 'FAILURE') {
			this.connection.close();
			const msg = (hello.data as Record<string, unknown>).message ?? 'unknown';
			throw new Error(`Authentication failed: ${msg}`);
		}

		this.connected = true;
	}

	/**
	 * Run a Cypher query and return all results.
	 *
	 * @param query  The Cypher query string.
	 * @param params  Optional query parameters.
	 */
	async run(
		query: string,
		params: Record<string, unknown> = {},
	): Promise<QueryResult> {
		this.assertConnected();

		// Pipeline RUN + PULL so both go out in one round-trip
		await this.connection.send(createRunMessage(query, params));
		await this.connection.send(createPullMessage());

		// First response: SUCCESS (with `fields`) or FAILURE for the RUN
		const runResponse = await this.connection.receiveOne();
		if (runResponse.type === 'FAILURE') {
			await this.reset();
			const msg =
				(runResponse.data as Record<string, unknown>).message ?? 'unknown';
			throw new Error(`Query error: ${msg}`);
		}

		const keys =
			((runResponse.data as Record<string, unknown>).fields as string[]) ?? [];
		const records: Record<string, unknown>[] = [];
		let summary: Record<string, unknown> = {};

		// Subsequent responses: zero or more RECORDs, then SUCCESS/FAILURE for PULL
		while (true) {
			const msg = await this.connection.receiveOne();
			if (msg.type === 'RECORD') {
				const values = msg.data as unknown[];
				records.push(Object.fromEntries(keys.map((k, i) => [k, values[i]])));
			} else if (msg.type === 'SUCCESS') {
				summary = msg.data as Record<string, unknown>;
				break;
			} else if (msg.type === 'FAILURE') {
				await this.reset();
				const errMsg =
					(msg.data as Record<string, unknown>).message ?? 'unknown';
				throw new Error(`Pull error: ${errMsg}`);
			}
		}

		return { keys, records, summary };
	}

	/** Begin an explicit transaction. */
	async beginTransaction(extra: Record<string, unknown> = {}): Promise<void> {
		this.assertConnected();
		await this.connection.send(createBeginMessage(extra));
		await this.expectSuccess('BEGIN');
	}

	/** Commit the current explicit transaction. */
	async commitTransaction(): Promise<void> {
		this.assertConnected();
		await this.connection.send(createCommitMessage());
		await this.expectSuccess('COMMIT');
	}

	/** Roll back the current explicit transaction. */
	async rollbackTransaction(): Promise<void> {
		this.assertConnected();
		await this.connection.send(createRollbackMessage());
		await this.expectSuccess('ROLLBACK');
	}

	/**
	 * Close the connection gracefully, sending GOODBYE to the server first.
	 */
	async close(): Promise<void> {
		if (!this.connected) return;
		await this.connection.send(createGoodbyeMessage());
		this.connection.close();
		this.connected = false;
	}

	private async expectSuccess(op: string): Promise<void> {
		const response = await this.connection.receiveOne();
		if (response.type === 'FAILURE') {
			await this.reset();
			const msg =
				(response.data as Record<string, unknown>).message ?? 'unknown';
			throw new Error(`${op} failed: ${msg}`);
		}
	}

	/** Send RESET and drain responses until SUCCESS, recovering the connection. */
	private async reset(): Promise<void> {
		await this.connection.send(createResetMessage());
		while (true) {
			const msg = await this.connection.receiveOne();
			if (msg.type === 'SUCCESS' || msg.type === 'FAILURE') break;
		}
	}

	private assertConnected(): void {
		if (!this.connected) {
			throw new Error('Not connected. Call connect() first.');
		}
	}
}
