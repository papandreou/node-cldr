/*
 * Replace - with _ and convert to lower case: en-GB => en_gb
 */
module.exports = function normalizeLocaleId(localeId) {
  return localeId && localeId.replace(/-/g, '_').toLowerCase();
};
