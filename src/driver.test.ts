import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BoltDriver } from './driver';

describe('BoltDriver - Local Neo4j Connection', () => {
	let driver: BoltDriver;

	beforeAll(async () => {
		// Use environment variables or defaults for credentials
		const username = process.env.NEO4J_USERNAME || 'neo4j';
		const password = process.env.NEO4J_PASSWORD || 'neo4j';

		driver = new BoltDriver('bolt://localhost:7687', {
			username,
			password,
		});

		try {
			await driver.connect();
		} catch (error) {
			console.error(
				'Failed to connect to Neo4j. Make sure Neo4j is running on localhost:7687',
			);
			if (error instanceof Error && error.message.includes('Authentication')) {
				console.error('Authentication failed. Set NEO4J_USERNAME and NEO4J_PASSWORD environment variables.');
			}
			throw error;
		}
	});

	afterAll(async () => {
		try {
			await driver.close();
		} catch {
			// Ignore close errors
		}
	});

	it('should connect to Neo4j successfully', async () => {
		// Connection is tested in beforeAll, if we get here it succeeded
		expect(driver).toBeDefined();
	});
});

