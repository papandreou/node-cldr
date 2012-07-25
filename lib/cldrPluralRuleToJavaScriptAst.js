var fs = require('fs'),
    Path = require('path'),
    PEG = require('pegjs'),
    parser = PEG.buildParser(fs.readFileSync(Path.resolve(__dirname, 'cldrPluralRule.pegjs'), 'utf-8'));

module.exports = function (cldrPluralRule) {
    return parser.parse(cldrPluralRule);
};
