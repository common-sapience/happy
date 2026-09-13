import { randomBytes } from 'node:crypto';
import tweetnacl from 'tweetnacl';
import { describe, expect, it } from 'vitest';

import { credentialsFromSealedResponse } from './authorizedLogin';

/** How a controller seals an answer: ephemeral public key + nonce + box. */
function seal(payload: Uint8Array, recipientPublicKey: Uint8Array): Uint8Array {
  const ephemeral = tweetnacl.box.keyPair();
  const nonce = new Uint8Array(randomBytes(tweetnacl.box.nonceLength));
  const box = tweetnacl.box(payload, nonce, recipientPublicKey, ephemeral.secretKey);
  const bundle = new Uint8Array(32 + nonce.length + box.length);
  bundle.set(ephemeral.publicKey, 0);
  bundle.set(nonce, 32);
  bundle.set(box, 32 + nonce.length);
  return bundle;
}

const machineKey = new Uint8Array(32).fill(9);

describe('credentials from an approved login', () => {
  it('reads an account secret sent the old way', () => {
    const keypair = tweetnacl.box.keyPair();
    const secret = new Uint8Array(randomBytes(32));
    const credentials = credentialsFromSealedResponse({
      sealed: seal(secret, keypair.publicKey),
      token: 'relay-token',
      ephemeralSecretKey: keypair.secretKey,
      machineKey,
    });
    expect(credentials).toEqual({
      token: 'relay-token',
      encryption: { type: 'legacy', secret },
    });
  });

  it('reads a data key and keeps this computer\'s own key beside it', () => {
    const keypair = tweetnacl.box.keyPair();
    const accountPublicKey = new Uint8Array(randomBytes(32));
    const payload = new Uint8Array(33);
    payload[0] = 0;
    payload.set(accountPublicKey, 1);
    const credentials = credentialsFromSealedResponse({
      sealed: seal(payload, keypair.publicKey),
      token: 'relay-token',
      ephemeralSecretKey: keypair.secretKey,
      machineKey,
    });
    expect(credentials).toEqual({
      token: 'relay-token',
      encryption: { type: 'dataKey', publicKey: accountPublicKey, machineKey },
    });
  });

  it('yields nothing for an answer sealed against somebody else', () => {
    const mine = tweetnacl.box.keyPair();
    const theirs = tweetnacl.box.keyPair();
    expect(credentialsFromSealedResponse({
      sealed: seal(new Uint8Array(randomBytes(32)), theirs.publicKey),
      token: 'relay-token',
      ephemeralSecretKey: mine.secretKey,
      machineKey,
    })).toBeNull();
  });

  it('yields nothing for a bundle too short to hold one', () => {
    const keypair = tweetnacl.box.keyPair();
    expect(credentialsFromSealedResponse({
      sealed: new Uint8Array(40),
      token: 'relay-token',
      ephemeralSecretKey: keypair.secretKey,
      machineKey,
    })).toBeNull();
  });

  it('yields nothing for a payload that is not an account key', () => {
    const keypair = tweetnacl.box.keyPair();
    const tagged = new Uint8Array(33);
    tagged[0] = 1;
    expect(credentialsFromSealedResponse({
      sealed: seal(tagged, keypair.publicKey),
      token: 'relay-token',
      ephemeralSecretKey: keypair.secretKey,
      machineKey,
    })).toBeNull();
    expect(credentialsFromSealedResponse({
      sealed: seal(new Uint8Array(8), keypair.publicKey),
      token: 'relay-token',
      ephemeralSecretKey: keypair.secretKey,
      machineKey,
    })).toBeNull();
  });
});
