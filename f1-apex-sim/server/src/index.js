import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createGatewayRuntime } from './app.js';
import { getPublicConfig, loadConfig } from './config.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(serverRoot, '.env'), quiet: true });

const config = loadConfig();
const runtime = createGatewayRuntime(config);

const shutdown = async (signal) => {
  process.stdout.write(`\n${signal}: stopping PITWALL live gateway...\n`);
  await runtime.stop();
  process.exit(0);
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

try {
  const address = await runtime.start();
  const publicConfig = getPublicConfig(config);
  process.stdout.write([
    `PITWALL live gateway listening on port ${address.port}`,
    `OpenF1 sponsor credentials: ${publicConfig.liveCredentialsConfigured ? 'configured' : 'not configured (historical fallback)'}`,
    `OpenF1 transport: ${publicConfig.mqttTransport}`,
  ].join('\n') + '\n');
} catch (error) {
  process.stderr.write(`Unable to start PITWALL live gateway: ${error.message}\n`);
  process.exit(1);
}
