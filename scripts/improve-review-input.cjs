'use strict';
// Validate before any reservation or recursive input copy.
function validateInclude(include) {
  if (include !== undefined && (!Array.isArray(include) ||
      include.some(file => typeof file !== 'string' || !file.trim())))
    throw new Error('invalid_critique_include');
}
module.exports = { validateInclude };
