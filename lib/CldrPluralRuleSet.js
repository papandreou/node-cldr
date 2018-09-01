var CldrPluralRule = require('./CldrPluralRule');

var cldrPluralRuleTermFunctionByName = require('./cldrPluralRuleTermFunctionByName');

var esprima = require('esprima');

function CldrPluralRuleSet() {
  this.cldrPluralRuleByCount = {};
}

CldrPluralRuleSet.prototype = {
  addRule: function(cldrPluralRule, count) {
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
  availablePluralClasses: function() {
    let pluralClasses = Object.keys(this.cldrPluralRuleByCount);
    pluralClasses.push('other');
    return pluralClasses;
  },

  toJavaScriptFunctionBodyAst: function() {
    var statementAsts = [];

    var isUsedByTerm = {};
    Object.keys(this.cldrPluralRuleByCount).forEach(function(count) {
      var cldrPluralRule = this.cldrPluralRuleByCount[count];
      cldrPluralRule.updateIsUsedByTerm(isUsedByTerm);
      statementAsts.push({
        type: 'IfStatement',
        test: cldrPluralRule.toJavaScriptAst(),
        consequent: {
          type: 'ReturnStatement',
          argument: {
            type: 'Literal',
            value: count
          }
        }
      });
    }, this);
    statementAsts.push({
      type: 'ReturnStatement',
      argument: {
        type: 'Literal',
        value: 'other'
      }
    });
    var varAsts = [];

    ['i', 'v', 'w', 'f', 't'].forEach(function(term) {
      if (isUsedByTerm[term]) {
        varAsts.push({
          type: 'VariableDeclarator',
          id: {
            type: 'Identifier',
            name: term
          },
          init: esprima.parse(cldrPluralRuleTermFunctionByName[term].toString())
            .body[0].body.body[0].argument
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
              name: 'n'
            }
          },
          right: {
            type: 'Literal',
            value: 'string'
          }
        },
        consequent: {
          type: 'ExpressionStatement',
          expression: {
            type: 'AssignmentExpression',
            operator: '=',
            left: {
              type: 'Identifier',
              name: 'n'
            },
            right: {
              type: 'CallExpression',
              callee: {
                type: 'Identifier',
                name: 'parseInt'
              },
              arguments: [
                {
                  type: 'Identifier',
                  name: 'n'
                },
                {
                  type: 'Literal',
                  value: 10
                }
              ]
            }
          }
        }
      });
    }

    if (varAsts.length > 0) {
      statementAsts.unshift({
        type: 'VariableDeclaration',
        kind: 'var',
        declarations: varAsts
      });
    }
    return statementAsts;
  }
};

module.exports = CldrPluralRuleSet;
