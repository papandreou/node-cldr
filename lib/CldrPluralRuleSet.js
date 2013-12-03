var CldrPluralRule = require('./CldrPluralRule');

function CldrPluralRuleSet() {
    this.cldrPluralRuleByCount = {};
}

CldrPluralRuleSet.prototype = {
    addRule: function (cldrPluralRule, count) {
        if (typeof cldrPluralRule === 'string') {
            cldrPluralRule = cldrPluralRule.replace(/\s*@(?:decimal|integer).*$/, '');
            // Some count="other" nodes in CLDR 24+ consist purely of sample text.
            // Don't add those.
            if (cldrPluralRule.length === 0) {
                return;
            }
            cldrPluralRule = new CldrPluralRule(cldrPluralRule);
        }
        this.cldrPluralRuleByCount[count] = cldrPluralRule;
    },

    toJavaScriptFunctionBodyAst: function () {
        var statementAsts = [],
            isUsedByTerm = {};
        Object.keys(this.cldrPluralRuleByCount).forEach(function (count) {
            var cldrPluralRule = this.cldrPluralRuleByCount[count];
            cldrPluralRule.updateIsUsedByTerm(isUsedByTerm);
            statementAsts.push(
                [
                    'if',
                    cldrPluralRule.toJavaScriptAst(),
                    ['return', ['string', count]]
                ]
            );
        }, this);
        statementAsts.push(['return', ['string', 'other']]);
        var varAsts = [];
        if (isUsedByTerm.i) {
            // Integer digits of n
            // i = Math.floor(Math.abs(n));
            // (Math.abs also works on string args)
            varAsts.push(['i', ['call', ['dot', ['name', 'Math'], 'floor'], [['call', ['dot', ['name', 'Math'], 'abs'], [['name', 'n']]]]]]);
        }
        if (isUsedByTerm.v) {
            // Number of visible fraction digits in n, with trailing zeros
            // v = n.toString().replace(/^[^.]*\.?/, '').length;
            varAsts.push(
                [ 'v',
                  [ 'dot',
                    [ 'call',
                      [ 'dot',
                        [ 'call', [ 'dot', [ 'name', 'n' ], 'toString' ], [] ],
                        'replace' ],
                      [ [ 'regexp', '^[^.]*\\.?', '' ], [ 'string', '' ] ] ],
                    'length' ] ]
            );
        }
        if (isUsedByTerm.w) {
            // Number of visible fraction digits in n, without trailing zeros
            // w = n.toString().replace(/^[^.]*\.?|0+$/g, '').length;
            varAsts.push(
                [ 'w',
                  [ 'dot',
                    [ 'call',
                      [ 'dot',
                        [ 'call', [ 'dot', [ 'name', 'n' ], 'toString' ], [] ],
                        'replace' ],
                      [ [ 'regexp', '^[^.]*\\.?|0+$', 'g' ], [ 'string', '' ] ] ],
                    'length' ] ]
            );
        }
        if (isUsedByTerm.f) {
            // Visible fraction digits in n, with trailing zeros
            // f = parseInt(n.toString().replace(/^[^.]*\.?/, ''), 10);
            varAsts.push(
                [ 'f',
                  [ 'call',
                    [ 'name', 'parseInt' ],
                    [ [ 'call',
                        [ 'dot',
                          [ 'call', [ 'dot', [ 'name', 'n' ], 'toString' ], [] ],
                          'replace' ],
                        [ [ 'regexp', '^[^.]*\\.?', '' ], [ 'string', '' ] ] ],
                      [ 'num', 10 ] ] ] ]
            );
        }
        if (isUsedByTerm.t) {
            // Visible fraction digits in n, without trailing zeros
            // t = parseInt(n.toString().replace(/^[^.]*\.?|0+$/g, ''), 10);
            varAsts.push(
                [ 't',
                  [ 'call',
                    [ 'name', 'parseInt' ],
                    [ [ 'call',
                        [ 'dot',
                          [ 'call', [ 'dot', [ 'name', 'n' ], 'toString' ], [] ],
                          'replace' ],
                        [ [ 'regexp', '^[^.]*\\.?|0+$', 'g' ], [ 'string', '' ] ] ],
                      [ 'num', 10 ] ] ] ]
            );
        }

        if (Object.keys(isUsedByTerm).length !== 0) {
            statementAsts.unshift(
                // if (typeof n === 'string') n = parseInt(n, 10);
                [ 'if',
                      [ 'binary',
                        '===',
                        [ 'unary-prefix', 'typeof', [ 'name', 'n' ] ],
                        [ 'string', 'string' ] ],
                      [ 'stat',
                        [ 'assign',
                          true,
                          [ 'name', 'n' ],
                          [ 'call',
                            [ 'name', 'parseInt' ],
                            [ [ 'name', 'n' ], [ 'num', 10 ] ] ] ] ],
                      undefined ]
            );
        }

        if (varAsts.length > 0) {
            statementAsts.unshift(['var', varAsts]);
        }
        return statementAsts;
    }
};

module.exports = CldrPluralRuleSet;
