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

    const helperVariables = [];
    const operandConstants = [];

    // For `c` and `e` operands, a temporary variable is needed to store the
    // RegExp match results. See `cldrPluralRuleTermFunctionByName.js`.
    ['c', 'e'].forEach((term) => {
      if (isUsedByTerm[term]) {
        helperVariables.push({
          type: 'VariableDeclarator',
          id: {
            type: 'Identifier',
            name: '_tmpPlural',
          },
        });
      }
    });

    // Based on the list of characters which are valid operands in the plural syntax.
    // See: http://unicode.org/reports/tr35/tr35-numbers.html#Plural_rules_syntax
    ['i', 'v', 'w', 'f', 't', 'c', 'e'].forEach((term) => {
      if (isUsedByTerm[term]) {
        operandConstants.push({
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

    if (Object.keys(isUsedByTerm).length !== 0) {
      statementAsts.unshift({
        // if (typeof n === 'string') n = parseInt(n, 10);
        type: 'IfStatement',
        test: {
          type: 'BinaryExpression',
          operator: '===',
          left: {
            type: 'UnaryExpression',
            operator: 'typeof',
            prefix: true,
            argument: {
              type: 'Identifier',
              name: 'n',
            },
          },
          right: {
            type: 'Literal',
            value: 'string',
          },
        },
        consequent: {
          type: 'ExpressionStatement',
          expression: {
            type: 'AssignmentExpression',
            operator: '=',
            left: {
              type: 'Identifier',
              name: 'n',
            },
            right: {
              type: 'CallExpression',
              callee: {
                type: 'Identifier',
                name: 'parseInt',
              },
              arguments: [
                {
                  type: 'Identifier',
                  name: 'n',
                },
                {
                  type: 'Literal',
                  value: 10,
                },
              ],
            },
          },
        },
      });
    }

    if (operandConstants.length > 0) {
      statementAsts.unshift({
        type: 'VariableDeclaration',
        kind: 'const',
        declarations: operandConstants,
      });
    }

    if (helperVariables.length > 0) {
      statementAsts.unshift({
        type: 'VariableDeclaration',
        // Helper variables are supposed to be mutable.
        kind: 'let',
        declarations: helperVariables,
      });
    }

    return statementAsts;
  },
};

module.exports = CldrPluralRuleSet;
