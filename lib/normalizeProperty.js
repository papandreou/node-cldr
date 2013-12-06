/*
 * Convert foo-bar attribute values to fooBar JavaScript keys
 */
module.exports = function normalizeProperty(str) {
	return str.replace(/-([a-z])/g, function ($0, ch) {
        return ch.toUpperCase();
    });
};
