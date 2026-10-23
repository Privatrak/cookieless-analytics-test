/**
 * A self-signed certificate for the local HTTPS server.
 *
 *   npm run setup   (or: node src/commands/make-cert.ts)
 */
import { execFileSync } from 'node:child_process';
import { CERT_FILE, KEY_FILE, SITE_HOST } from '../config.ts';

execFileSync('openssl', [
  'req',
  '-x509',
  '-newkey',
  'rsa:2048',
  '-nodes',
  '-keyout',
  KEY_FILE,
  '-out',
  CERT_FILE,
  '-days',
  '30',
  '-subj',
  `/CN=${SITE_HOST}`,
]);
console.log(`Wrote ${KEY_FILE} and ${CERT_FILE}`);
