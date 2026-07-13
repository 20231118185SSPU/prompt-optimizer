'use strict';

const MODEL_FAILURE_TYPES = Object.freeze([
  'empty_output',
  'invalid_json',
  'schema_mismatch',
  'cli_exit_nonzero',
  'credential_error'
]);

const MODEL_FAILURES = new Set(MODEL_FAILURE_TYPES);

function failureOwner(failureType) {
  return MODEL_FAILURES.has(failureType) ? 'model' : 'runner';
}

module.exports = { MODEL_FAILURE_TYPES, MODEL_FAILURES, failureOwner };
