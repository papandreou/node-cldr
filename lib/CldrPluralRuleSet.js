const CldrPluralRule = require('./CldrPluralRule');

const cldrPluralRuleTermFunctionByName = require('./cldrPluralRuleTermFunctionByName');

const esprima = require('esprima');

function CldrPluralRuleSet() {
  this.cldrPluralRuleByCount = {};
}

CldrPluralRuleSet.prototype = {
  addRule(cldrPluralRule, count) {
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

  /**
   * @returns {Array} of all plural classes including "other" in set.
   */
  availablePluralClasses() {
    const pluralClasses = Object.keys(this.cldrPluralRuleByCount);
    pluralClasses.push('other');
    return pluralClasses;
  },

  toJavaScriptFunctionBodyAst() {
    const statementAsts = [];

    const isUsedByTerm = {};
    Object.keys(this.cldrPluralRuleByCount).forEach(function (count) {
      const cldrPluralRule = this.cldrPluralRuleByCount[count];
      cldrPluralRule.updateIsUsedByTerm(isUsedByTerm);
      statementAsts.push({
        type: 'IfStatement',
        test: cldrPluralRule.toJavaScriptAst(),
        consequent: {
          type: 'ReturnStatement',
          argument: {
            type: 'Literal',
            value: count,
          },
        },
      });
    }, this);
    statementAsts.push({
      type: 'ReturnStatement',
      argument: {
        type: 'Literal',
        value: 'other',
      },
    });

    const varAsts = [];

    // Based on the list of characters which are valid operands in the plural syntax.
    // See: http://unicode.org/reports/tr35/tr35-numbers.html#Plural_rules_syntax
    ['n', 'i', 'v', 'w', 'f', 't', 'c', 'e'].forEach((term) => {
      // the `n` operand variable is always generated as it's used later to ensure
      // that a valid number has been specified to the plural function.
      if (term === 'n' || isUsedByTerm[term]) {
        varAsts.push({
          type: 'VariableDeclarator',
          id: {
            type: 'Identifier',
            name: term,
          },
          init: esprima.parse(cldrPluralRuleTermFunctionByName[term].toString())
            .body[0].body.body[0].argument,
        });
      }
    });

    statementAsts.unshift({
      // if (isNaN(n)) throw Error('n is not a number');
      type: 'IfStatement',
      test: {
        type: 'CallExpression',
        callee: {
          type: 'Identifier',
          name: 'isNaN',
        },
        arguments: [
          {
            type: 'Identifier',
            name: 'n',
          },
        ],
      },
      consequent: {
        type: 'ThrowStatement',
        argument: {
          type: 'CallExpression',
          callee: {
            type: 'Identifier',
            name: 'Error',
          },
          arguments: [
            {
              type: 'Literal',
              value: 'n is not a number',
            },
          ],
        },
      },
    });

    if (varAsts.length > 0) {
      statementAsts.unshift({
        type: 'VariableDeclaration',
        kind: 'const',
        declarations: varAsts,
      });
    }
    return statementAsts;
  },
};

module.exports = CldrPluralRuleSet;
