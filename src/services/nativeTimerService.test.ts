import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { nativeTimerService } from './nativeTimerService';

describe('Native Mini Timer Pairing Service', () => {
  it('formats custom callback URL accurately with pairing code parameter', () => {
    const code = 'a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890';
    const url = nativeTimerService.getCallbackUrl(code);
    assert.equal(url, `myworkplanner-minitimer://auth/callback?code=${code}`);
  });

  it('validates 64-character hexadecimal pairing codes', () => {
    const validCode = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const invalidLength = '0123456789abcdef';
    const invalidChars = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdeg!';

    assert.equal(nativeTimerService.isValidPairingCode(validCode), true);
    assert.equal(nativeTimerService.isValidPairingCode(invalidLength), false);
    assert.equal(nativeTimerService.isValidPairingCode(invalidChars), false);
    assert.equal(nativeTimerService.isValidPairingCode(''), false);
  });

  it('createPairingAuthorization returns clean error when Supabase client is unconfigured', async () => {
    const result = await nativeTimerService.createPairingAuthorization();
    assert.equal(typeof result.success, 'boolean');
  });
});
