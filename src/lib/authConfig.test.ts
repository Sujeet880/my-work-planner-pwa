import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEmailFormat, validateTaskInput } from './timeMath';
import { getClientEnvConfig } from './env';
import { getSupabaseBrowserClient, isSupabaseClientReady, testSupabaseConnection } from './supabaseClient';

test('validateEmailFormat validates authentic email inputs and rejects invalid ones', () => {
  // Valid emails
  assert.equal(validateEmailFormat('owner@myworkplanner.com'), null);
  assert.equal(validateEmailFormat('user.name+tag@sub.domain.co'), null);

  // Invalid emails
  assert.notEqual(validateEmailFormat(''), null);
  assert.notEqual(validateEmailFormat('   '), null);
  assert.notEqual(validateEmailFormat('no-at-sign.com'), null);
  assert.notEqual(validateEmailFormat('@missing-username.com'), null);
  assert.notEqual(validateEmailFormat('user@.missing-host'), null);
  assert.notEqual(validateEmailFormat('user@domain'), null);
  assert.notEqual(validateEmailFormat('spaces in@domain.com'), null);
});

test('getClientEnvConfig identifies missing Supabase variables cleanly in Milestone 0', () => {
  const config = getClientEnvConfig();
  assert.equal(typeof config.isSupabaseConfigured, 'boolean');
  assert.ok(Array.isArray(config.missingClientVars));

  if (!config.isSupabaseConfigured) {
    assert.ok(
      config.missingClientVars.includes('VITE_SUPABASE_URL') ||
        config.missingClientVars.includes('VITE_SUPABASE_PUBLISHABLE_KEY')
    );
  }
});

test('getSupabaseBrowserClient returns null without throwing when unconfigured', () => {
  const ready = isSupabaseClientReady();
  const client = getSupabaseBrowserClient();

  if (!ready) {
    assert.equal(client, null);
  } else {
    assert.ok(client !== null);
  }
});

test('testSupabaseConnection handles unconfigured state cleanly without throwing', async () => {
  const res = await testSupabaseConnection();
  assert.equal(typeof res.ok, 'boolean');
  assert.equal(typeof res.message, 'string');
});

test('Database business rule: start time cannot exist without scheduled date', () => {
  const errors = validateTaskInput({
    title: 'Valid title',
    scheduledDate: '',
    scheduledStartTime: '09:30',
    plannedDurationMinutes: '',
  });
  assert.ok(errors.scheduledStartTime?.includes('Scheduled start time requires a scheduled date'));
});

test('Database business rule: removing scheduled date clears start time dependency', () => {
  const errors = validateTaskInput({
    title: 'Inbox Task',
    scheduledDate: '',
    scheduledStartTime: '',
    plannedDurationMinutes: '',
  });
  assert.equal(Object.keys(errors).length, 0);
});
