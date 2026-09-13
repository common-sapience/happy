/**
 * The subcommands the desktop shell runs (DESK-08, DESK-12, DESK-21).
 *
 * They are the effectful half of `desktopHandoff.ts` and
 * `@/modules/credentials/platformCredentials`: the decisions there are pure and
 * tested, the file and network work is here.
 */

import axios from 'axios';
import { randomBytes, randomUUID } from 'node:crypto';
import tweetnacl from 'tweetnacl';

import { decodeBase64, encodeBase64 } from '@/api/encryption';
import { configuration } from '@/configuration';
import {
  describePlatformCredentials,
  updateEngineCredentials,
} from '@/modules/credentials/engineCredentials';
import {
  decidePlatformCredentials,
  mergePlatformCredentials,
  readPlatformCredentialRequest,
} from '@/modules/credentials/platformCredentials';
import { readCredentials, readSettings, updateSettings, writeCredentials } from '@/persistence';
import { logger } from '@/ui/logger';
import { credentialsFromSealedResponse } from '@/utils/authorizedLogin';
import { delay } from '@/utils/time';
import { relayRefusalMessage } from './autostart';
import {
  type AuthRequestState,
  LOGIN_TOKEN_ENVIRONMENT_VARIABLE,
  awaitLoginApproval,
  checkLoginToken,
  decideRelayHandoff,
  handoffLine,
  loginRequestUrl,
} from './desktopHandoff';

/** One second apart for three minutes: long enough for a controller to answer, short enough to end. */
const APPROVAL_ATTEMPTS = 180;

function reply(payload: Record<string, unknown>): void {
  console.log(handoffLine(payload));
}

export async function runSetRelay(args: string[]): Promise<void> {
  const argument = args[0];
  const validity = decideRelayHandoff(argument, null);
  if (validity.action === 'refuse') {
    reply({ handoff: 'relay', status: 'refused', reason: validity.reason });
    console.error(
      validity.reason === 'missing'
        ? `${argument === undefined ? 'No' : 'An empty'} relay address was passed; nothing was written.`
        : 'That is not an HTTP relay address; nothing was written.',
    );
    process.exitCode = 1;
    return;
  }

  // The same locked read-modify-write every other writer of this file uses, so a
  // heartbeat or a permission switch cannot lose the address, or lose to it.
  let changed = false;
  await updateSettings((current) => {
    const decision = decideRelayHandoff(argument, current.serverUrl);
    if (decision.action !== 'write') {
      return current;
    }
    changed = true;
    return { ...current, serverUrl: decision.url };
  });

  reply({ handoff: 'relay', status: changed ? 'updated' : 'unchanged', url: validity.url });
}

export async function runLoginRequest(): Promise<void> {
  const tokenCheck = checkLoginToken(process.env[LOGIN_TOKEN_ENVIRONMENT_VARIABLE]);
  if (!tokenCheck.ok) {
    reply({ handoff: 'login', status: 'refused', reason: `token-${tokenCheck.reason}` });
    console.error(`This subcommand is for the desktop shell, which passes ${LOGIN_TOKEN_ENVIRONMENT_VARIABLE}.`);
    process.exitCode = 1;
    return;
  }
  const token = tokenCheck.token;

  const refusal = relayRefusalMessage(configuration.relayUrl, configuration.settingsFile);
  if (refusal) {
    reply({ handoff: 'login', status: 'refused', token, reason: 'no-relay' });
    console.error(refusal);
    process.exitCode = 1;
    return;
  }
  const relayUrl = configuration.relayUrl!;

  if (await readCredentials()) {
    reply({ handoff: 'login', status: 'already-authenticated', token });
    return;
  }

  const keypair = tweetnacl.box.keyPair.fromSecretKey(new Uint8Array(randomBytes(32)));
  const request = async (publicKey: Uint8Array): Promise<AuthRequestState> => {
    const response = await axios.post(`${relayUrl}/v1/auth/request`, {
      publicKey: encodeBase64(publicKey),
      supportsV2: true,
    }, {
      headers: { 'X-Happy-Client': `cli/${configuration.currentCliVersion}` },
    });
    return response.data as AuthRequestState;
  };

  try {
    await request(keypair.publicKey);
  } catch (error) {
    logger.debug('[HANDOFF] could not publish the login request', error);
    reply({ handoff: 'login', status: 'refused', token, reason: 'relay-unreachable' });
    console.error('Could not publish a login request to the relay.');
    process.exitCode = 1;
    return;
  }

  reply({
    handoff: 'login',
    status: 'awaiting-approval',
    token,
    url: loginRequestUrl(keypair.publicKey),
  });

  const approval = await awaitLoginApproval({
    publicKey: keypair.publicKey,
    request,
    attempts: APPROVAL_ATTEMPTS,
    sleep: async (ms) => { await delay(ms); },
  });
  if (approval.status !== 'authorized') {
    reply({ handoff: 'login', status: approval.status, token });
    console.error(`The login request was not approved: ${approval.status}.`);
    process.exitCode = 1;
    return;
  }

  const credentials = credentialsFromSealedResponse({
    sealed: decodeBase64(approval.response),
    token: approval.token,
    ephemeralSecretKey: keypair.secretKey,
    machineKey: new Uint8Array(randomBytes(32)),
  });
  if (!credentials) {
    reply({ handoff: 'login', status: 'refused', token, reason: 'undecryptable' });
    console.error('The approval could not be read; this computer stays logged out.');
    process.exitCode = 1;
    return;
  }

  await writeCredentials(credentials);
  // A fresh account means a fresh machine: the identity this daemon registers
  // under must not be the one a previous account knew.
  await updateSettings((current) => ({ ...current, machineId: randomUUID() }));

  reply({ handoff: 'login', status: 'authenticated', token });
}


/**
 * The model gateway this computer holds (HOST-09, DESK-12).
 *
 * The request arrives as one JSON object on stdin, never in argv: the platform
 * API key is one of its fields and an argument is readable in any process list.
 * A request naming no field is a legitimate read — it reports the configured
 * state and writes nothing, which is how the account page learns what this
 * computer holds before offering to change it.
 *
 * The reply names which fields are set and never what they are set to. The
 * running daemon does not have to be restarted: a session reads this store when
 * it spawns its engine, so the next agent started here gets the new gateway.
 */
export async function runSetPlatformCredentials(stdin: NodeJS.ReadableStream): Promise<void> {
  const request = readPlatformCredentialRequest(await collectStdin(stdin));
  if (request.action === 'refuse') {
    reply({ handoff: 'platform-credentials', status: 'refused', reason: request.reason });
    console.error('That request could not be read; nothing was written.');
    process.exitCode = 1;
    return;
  }

  const decision = decidePlatformCredentials(request.body);
  if (decision.action === 'refuse') {
    reply({
      handoff: 'platform-credentials',
      status: 'refused',
      reason: decision.reason,
      field: decision.field ?? undefined,
    });
    console.error('That model gateway value was refused; nothing was written.');
    process.exitCode = 1;
    return;
  }

  const changed = Object.keys(decision.values);
  const stored = await updateEngineCredentials((current) => mergePlatformCredentials(current, decision.values));
  const settings = await readSettings();

  reply({
    handoff: 'platform-credentials',
    status: changed.length === 0 ? 'unchanged' : 'updated',
    changed,
    set: describePlatformCredentials(stored),
    machineId: settings?.machineId,
  });
}

/**
 * A desktop shell writes one short line; anything larger is not this shell, so it
 * is refused rather than buffered without bound.
 */
const MAX_REQUEST_BYTES = 64 * 1024;

async function collectStdin(stdin: NodeJS.ReadableStream): Promise<string | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stdin) {
    const buffer = Buffer.from(chunk as Buffer | string);
    size += buffer.byteLength;
    if (size > MAX_REQUEST_BYTES) {
      return null;
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}
