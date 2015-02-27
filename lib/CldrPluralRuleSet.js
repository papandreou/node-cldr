var CldrPluralRule = require('./CldrPluralRule'),
    cldrPluralRuleTermFunctionByName = require('./cldrPluralRuleTermFunctionByName'),
    uglifyJs = require('uglify-js');

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

        ['i', 'v', 'w', 'f', 't'].forEach(function (term) {
            if (isUsedByTerm[term]) {
                varAsts.push([term, uglifyJs.parser.parse(cldrPluralRuleTermFunctionByName[term].toString())[1][0][3][0][1]]);
            }
        });

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
