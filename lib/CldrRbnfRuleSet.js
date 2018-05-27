var _ = require('underscore');

function CldrRbnfRuleSet(config) {
    _.extend(this, config);
    this.ruleByValue = {};
}

CldrRbnfRuleSet.getSafeRendererName = function (rendererName) {
    return (
        ('render-' + rendererName)
            .replace(/[^\w-]/g, '-')
            .replace(/[-_]+([0-9a-z])/gi, function ($0, ch) {
                return ch.toUpperCase();
            })
            .replace('GREEKNUMERALMAJUSCULES', 'GreekNumeralMajuscules')
    );
};

CldrRbnfRuleSet.prototype = {
    toFunctionAst: function () {
        var that = this,
            isSeenByRuleSetType = {};

        function ruleToExpressionAst(rule) {
            var expressionAsts = [],
                rbnf = rule.rbnf;

            // "If a rule body begins with an apostrophe, the apostrophe is ignored, but all text after it becomes
            // significant (this is how you can have a rule's rule text begin with whitespace)."
            // -- http://www.icu-project.org/apiref/icu4c/classRuleBasedNumberFormat.html
            rbnf = rbnf.replace(/^'/, '');

            rule.radix = rule.radix || 10;

            function getDivisor() {
                var divisor = 1;
                while (10 * divisor <= parseInt(rule.value, 10)) { // Inefficient, but won't suffer from Math.log rounding errors
                    divisor *= 10;
                }
                return divisor;
            }

            // Replace is used for tokenization, the return value isn't used:
            rbnf.replace(/(?:([\<\>\=])(?:(%%?[\w\-]+)|([#,0.]+))?\1)|(?:\[([^\]]+)\])|([\x7f-\uffff:'\.\s\w\d\-]+|(?:\$\((cardinal|ordinal),([^\)]+)\)))/gi, function ($0, specialChar, otherFormat, decimalFormat, optional, literal, cardinalOrOrdinal, dollarRule) {
                // The meanings of the substitution token characters are as follows:
                if (dollarRule) {
                    var callAst = ['call', ['function', null, [ 'n' ], cardinalOrOrdinal === 'cardinal' ? that.cardinalPluralRuleAst : that.ordinalPluralRuleAst], [ [ 'name', 'n' ] ] ];
                    var objAst = ['object', [] ];
                    dollarRule.split('}').forEach(function (fragment) {
                        var pluralCaseAndValue = fragment.split('{');
                        if (pluralCaseAndValue.length === 2) {
                            objAst[1].push([pluralCaseAndValue[0], ['string', pluralCaseAndValue[1]]]);
                        }
                    });
                    expressionAsts.push(['sub', objAst, callAst]);
                } else if (specialChar) {
                    var expr;
                    if (specialChar === '<') { // <<
                        if (/^\d+$/.test(rule.value)) {
                            // In normal rule: Divide the number by the rule's divisor and format the quotient
                            expr = ['call', ['dot', ['name', 'Math'], 'floor'], [['binary', '/', ['name', 'n'], ['num', getDivisor()]]]];
                        } else if (rule.value === '-x') {
                            throw new Error('<< not allowed in negative number rule');
                        } else {
                            // In fraction or master rule: Isolate the number's integral part and format it.
                            expr = ['call', ['dot', ['name', 'Math'], 'floor'], [['name', 'n']]];
                        }
                    } else if (specialChar === '>') { // >>
                        if (/\./.test(rule.value)) {
                            // Fraction or master rule => parseInt(String(n).replace(/\d*\./, ''), 10)
                            expr = ['call', ['name', 'parseInt'], [['call', ['dot', ['call', ['name', 'String'], [['name', 'n']]], 'replace'], [['regexp', '\\d*\\.', ''], ['string', '']]], ['num', 10]]];
                        } else if (rule.value === '-x') {
                            expr = ['unary-prefix', '-', ['name', 'n']];
                        } else {
                            expr = ['binary', '%', ['name', 'n'], ['num', getDivisor()]];
                        }
                    } else if (specialChar === '=') { // ==
                        expr = ['name', 'n'];
                    }
                    // FIXME: >>> not supported

                    // The substitution descriptor (i.e., the text between the token characters) may take one of three forms:
                    if (otherFormat) {
                        // A rule set name:
                        // Perform the mathematical operation on the number, and format the result using the named rule set.
                        var otherFormatName = CldrRbnfRuleSet.getSafeRendererName(otherFormat);
                        isSeenByRuleSetType[otherFormatName] = true;
                        // Turn into this.<otherFormatName>(<expr>)
                        expressionAsts.push(['call', ['dot', ['name', 'this'], otherFormatName], [expr]]);
                    } else if (decimalFormat) {
                        // A DecimalFormat pattern:
                        // Perform the mathematical operation on the number, and format the result using a DecimalFormat
                        // with the specified pattern. The pattern must begin with 0 or #.
                        expressionAsts.push(['call', ['dot', ['name', 'this'], 'renderNumber'], [expr, ['string', decimalFormat]]]);
                    } else {
                        // Nothing:
                        if (specialChar === '>') {
                            // If you omit the substitution descriptor in a >> substitution in a fraction rule, format the result one digit at a time using the rule set containing the current rule.
                            expressionAsts.push(['call', ['dot', ['name', 'this'], that.type], [expr]]);
                        } else if (specialChar === '<') {
                            // If you omit the substitution descriptor in a << substitution in a rule in a fraction rule set, format the result using the default rule set for this renderer.
                            // FIXME: Should be the default rule set for this renderer!
                            expressionAsts.push(['call', ['dot', ['name', 'this'], that.type], [expr]]);
                        } else {
                            throw new Error('== not supported!');
                        }
                    }
                } else if (optional) { // [ ... ]
                    var optionalRuleExpressionAst = ruleToExpressionAst({radix: rule.radix, rbnf: optional, value: rule.value});
                    expressionAsts.push(['conditional', ['binary', '===', ['name', 'n'], ['num', parseInt(rule.value, 10)]], ['string', ''], optionalRuleExpressionAst]);
                } else if (literal) {
                    expressionAsts.push(['string', literal]);
                } else {
                    throw new Error('Unknown token in ' + rule.rbnf);
                }
            });
            if (expressionAsts.length === 0) {
                expressionAsts = [['string', '']];
            }
            var expressionAst = expressionAsts.shift();
            while (expressionAsts.length > 0) {
                expressionAst = ['binary', '+', expressionAst, expressionAsts.shift()];
            }
            return expressionAst;
        }

        function conditionToStatementAst(conditionAst, rule) {
            return ['if', conditionAst, ['return', ruleToExpressionAst(rule)], null];
        }

        var statementAsts = [];
        if (this.ruleByValue['x.0'] || this.ruleByValue['x.x']) {
            // var isFractional = n !== Math.floor(n);
            statementAsts.push(['var', [['isFractional', ['binary', '!==', ['name', 'n'], ['call', ['dot', ['name', 'Math'], 'floor'], [['name', 'n']]]]]]]);
        }
        if (this.ruleByValue['x.0']) {
            statementAsts.push(conditionToStatementAst(['name', 'isFractional'], this.ruleByValue['x.0']));
        }
        if (this.ruleByValue['-x']) {
            statementAsts.push(conditionToStatementAst(['binary', '<', ['name', 'n'], ['num', 0]], this.ruleByValue['-x']));
        }
        if (this.ruleByValue['x.x']) {
            statementAsts.push(conditionToStatementAst(['binary', '&&', ['name', 'isFractional'], ['binary', '>', ['name', 'n'], ['num', 1]]], this.ruleByValue['x.x']));
        }
        if (this.ruleByValue['0.x']) {
            statementAsts.push(conditionToStatementAst(['binary', '&&', ['binary', '>', ['name', 'n'], ['num', 0]], ['binary', '<', ['name', 'n'], ['num', 1]]], this.ruleByValue['0.x']));
        }

        Object.keys(this.ruleByValue).filter(function (value) {
            return /^\d+$/.test(value);
        }).map(function (value) {
            return parseInt(value, 10);
        }).sort(function (a, b) {
            return b - a;
        }).forEach(function (numericalValue) {
            statementAsts.push(conditionToStatementAst(['binary', '>=', ['name', 'n'], ['num', numericalValue]], this.ruleByValue[numericalValue]));
        }, this);

        return {functionAst: ['function', null, ['n'], statementAsts], dependencies: Object.keys(isSeenByRuleSetType)};
    }
};

module.exports = CldrRbnfRuleSet;
