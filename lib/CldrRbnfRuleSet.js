function CldrRbnfRuleSet(config) {
  Object.assign(this, config);
  this.ruleByValue = {};
}

CldrRbnfRuleSet.getSafeRendererName = (rendererName) =>
  ('render-' + rendererName)
    .replace(/[^\w-]/g, '-')
    .replace(/[-_]+([0-9a-z])/gi, ($0, ch) => ch.toUpperCase())
    .replace('GREEKNUMERALMAJUSCULES', 'GreekNumeralMajuscules');

function applyRenderer(expr, formatName) {
  return {
    type: 'CallExpression',
    callee: {
      type: 'MemberExpression',
      object: {
        type: 'ThisExpression',
      },
      property: {
        type: 'Identifier',
        name: formatName,
      },
      computed: false,
    },
    arguments: [expr],
  };
}

CldrRbnfRuleSet.prototype = {
  toFunctionAst() {
    const that = this;

    const isSeenByRuleSetType = {};

    function ruleToExpressionAst(rule) {
      let expressionAsts = [];

      let rbnf = rule.rbnf;

      // "If a rule body begins with an apostrophe, the apostrophe is ignored, but all text after it becomes
      // significant (this is how you can have a rule's rule text begin with whitespace)."
      // -- http://www.icu-project.org/apiref/icu4c/classRuleBasedNumberFormat.html
      rbnf = rbnf.replace(/^'/, '');

      rule.radix = rule.radix || 10;

      function getDivisor() {
        let divisor = 1;
        while (10 * divisor <= parseInt(rule.value, 10)) {
          // Inefficient, but won't suffer from Math.log rounding errors
          divisor *= 10;
        }
        return divisor;
      }

      // Replace is used for tokenization, the return value isn't used:
      rbnf.replace(
        /(?:([<>=])(?:(%%?[\w-]+)|([#,0.]+))?\1)|(?:\[([^\]]+)\])|([\x7f-\uffff:'.\s\w\d-]+|(?:\$\((cardinal|ordinal),([^)]+)\)))/gi,
        function (
          $0,
          specialChar,
          otherFormat,
          decimalFormat,
          optional,
          literal,
          cardinalOrOrdinal,
          dollarRule
        ) {
          // The meanings of the substitution token characters are as follows:
          if (dollarRule) {
            const callAst = {
              type: 'CallExpression',
              callee: {
                type: 'FunctionExpression',
                id: null,
                params: [
                  {
                    type: 'Identifier',
                    // The plural functions expect the parameter to be named `val`.
                    name: 'val',
                  },
                ],
                body: {
                  type: 'BlockStatement',
                  body:
                    cardinalOrOrdinal === 'cardinal'
                      ? that.cardinalPluralRuleAst
                      : that.ordinalPluralRuleAst,
                },
              },
              arguments: [
                {
                  type: 'Identifier',
                  name: 'n',
                },
              ],
            };
            const objAst = {
              type: 'ObjectExpression',
              properties: [],
            };
            dollarRule.split('}').forEach((fragment) => {
              const pluralCaseAndValue = fragment.split('{');
              if (pluralCaseAndValue.length === 2) {
                objAst.properties.push({
                  type: 'Property',
                  key: {
                    type: 'Literal',
                    value: pluralCaseAndValue[0],
                  },
                  value: {
                    type: 'Literal',
                    value: pluralCaseAndValue[1],
                  },
                });
              }
            });
            expressionAsts.push({
              type: 'MemberExpression',
              object: objAst,
              property: callAst,
              computed: true,
            });
          } else if (specialChar) {
            let expr;
            let wrap = true;
            if (specialChar === '<') {
              // <<
              if (/^\d+$/.test(rule.value)) {
                // In normal rule: Divide the number by the rule's divisor and format the quotient
                expr = {
                  type: 'CallExpression',
                  callee: {
                    type: 'MemberExpression',
                    object: {
                      type: 'Identifier',
                      name: 'Math',
                    },
                    property: {
                      type: 'Identifier',
                      name: 'floor',
                    },
                    computed: false,
                  },
                  arguments: [
                    {
                      type: 'BinaryExpression',
                      operator: '/',
                      left: {
                        type: 'Identifier',
                        name: 'n',
                      },
                      right: {
                        type: 'Literal',
                        value: getDivisor(),
                      },
                    },
                  ],
                };
              } else if (rule.value === '-x') {
                throw new Error('<< not allowed in negative number rule');
              } else {
                // In fraction or master rule: Isolate the number's integral part and format it.
                expr = {
                  type: 'CallExpression',
                  callee: {
                    type: 'MemberExpression',
                    object: {
                      type: 'Identifier',
                      name: 'Math',
                    },
                    property: {
                      type: 'Identifier',
                      name: 'floor',
                    },
                    computed: false,
                  },
                  arguments: [
                    {
                      type: 'Identifier',
                      name: 'n',
                    },
                  ],
                };
              }
            } else if (specialChar === '>') {
              // >>
              if (/\./.test(rule.value)) {
                // Fraction or master rule => parseInt(String(n).replace(/\d*\./, ''), 10)
                wrap = false;
                expr = {
                  type: 'CallExpression',
                  callee: {
                    type: 'MemberExpression',
                    object: {
                      type: 'CallExpression',
                      callee: {
                        type: 'MemberExpression',
                        object: {
                          type: 'CallExpression',
                          callee: {
                            type: 'MemberExpression',
                            object: {
                              type: 'CallExpression',
                              callee: {
                                type: 'MemberExpression',
                                object: {
                                  type: 'CallExpression',
                                  callee: {
                                    type: 'Identifier',
                                    name: 'String',
                                  },
                                  arguments: [
                                    {
                                      type: 'Identifier',
                                      name: 'n',
                                    },
                                  ],
                                },
                                property: {
                                  type: 'Identifier',
                                  name: 'replace',
                                },
                                computed: false,
                              },
                              arguments: [
                                {
                                  type: 'Literal',
                                  value: /\d*\./,
                                },
                                {
                                  type: 'Literal',
                                  value: '',
                                },
                              ],
                            },
                            property: {
                              type: 'Identifier',
                              name: 'split',
                            },
                            computed: false,
                          },
                          arguments: [
                            {
                              type: 'Literal',
                              value: /(?:)/,
                            },
                          ],
                        },
                        property: {
                          type: 'Identifier',
                          name: 'map',
                        },
                        computed: false,
                      },
                      arguments: [
                        {
                          type: 'FunctionExpression',
                          params: [
                            {
                              type: 'Identifier',
                              name: 'digit',
                            },
                          ],
                          body: {
                            type: 'BlockStatement',
                            body: [
                              {
                                type: 'ReturnStatement',
                                argument: applyRenderer(
                                  {
                                    type: 'CallExpression',
                                    callee: {
                                      type: 'Identifier',
                                      name: 'parseInt',
                                    },
                                    arguments: [
                                      {
                                        type: 'Identifier',
                                        name: 'digit',
                                      },
                                    ],
                                  },
                                  that.type
                                ),
                              },
                            ],
                          },
                        },
                        {
                          type: 'ThisExpression',
                        },
                      ],
                    },
                    property: {
                      type: 'Identifier',
                      name: 'join',
                    },
                    computed: false,
                  },
                  arguments: [
                    {
                      type: 'Literal',
                      value: ' ',
                    },
                  ],
                };
              } else if (rule.value === '-x') {
                expr = {
                  type: 'UnaryExpression',
                  operator: '-',
                  prefix: true,
                  argument: {
                    type: 'Identifier',
                    name: 'n',
                  },
                };
              } else {
                expr = {
                  type: 'BinaryExpression',
                  operator: '%',
                  left: {
                    type: 'Identifier',
                    name: 'n',
                  },
                  right: {
                    type: 'Literal',
                    value: getDivisor(),
                  },
                };
              }
            } else if (specialChar === '=') {
              // ==
              expr = {
                type: 'Identifier',
                name: 'n',
              };
            }
            // FIXME: >>> not supported

            // The substitution descriptor (i.e., the text between the token characters) may take one of three forms:
            if (otherFormat) {
              // A rule set name:
              // Perform the mathematical operation on the number, and format the result using the named rule set.
              const otherFormatName =
                CldrRbnfRuleSet.getSafeRendererName(otherFormat);
              isSeenByRuleSetType[otherFormatName] = true;
              // Turn into this.<otherFormatName>(<expr>)
              expressionAsts.push(
                wrap ? applyRenderer(expr, otherFormatName) : expr
              );
            } else if (decimalFormat) {
              // A DecimalFormat pattern:
              // Perform the mathematical operation on the number, and format the result using a DecimalFormat
              // with the specified pattern. The pattern must begin with 0 or #.
              expressionAsts.push({
                type: 'CallExpression',
                callee: {
                  type: 'MemberExpression',
                  object: {
                    type: 'ThisExpression',
                  },
                  property: {
                    type: 'Identifier',
                    name: 'renderNumber',
                  },
                  computed: false,
                },
                arguments: [
                  expr,
                  {
                    type: 'Literal',
                    value: decimalFormat,
                  },
                ],
              });
            } else {
              // Nothing:
              if (specialChar === '>') {
                // If you omit the substitution descriptor in a >> substitution in a fraction rule, format the result one digit at a time using the rule set containing the current rule.
                expressionAsts.push(
                  wrap ? applyRenderer(expr, that.type) : expr
                );
              } else if (specialChar === '<') {
                // If you omit the substitution descriptor in a << substitution in a rule in a fraction rule set, format the result using the default rule set for this renderer.
                // FIXME: Should be the default rule set for this renderer!
                expressionAsts.push(
                  wrap ? applyRenderer(expr, that.type) : expr
                );
              } else {
                throw new Error('== not supported!');
              }
            }
          } else if (optional) {
            // [ ... ]
            const optionalRuleExpressionAst = ruleToExpressionAst({
              radix: rule.radix,
              rbnf: optional,
              value: rule.value,
            });
            expressionAsts.push({
              type: 'ConditionalExpression',
              test: {
                type: 'BinaryExpression',
                operator: '===',
                left: {
                  type: 'BinaryExpression',
                  operator: '%',
                  left: {
                    type: 'Identifier',
                    name: 'n',
                  },
                  right: {
                    type: 'Literal',
                    value: parseInt(rule.value, 10),
                  },
                },
                right: {
                  type: 'Literal',
                  value: 0,
                },
              },
              consequent: {
                type: 'Literal',
                value: '',
              },
              alternate: optionalRuleExpressionAst,
            });
          } else if (literal) {
            expressionAsts.push({
              type: 'Literal',
              value: literal,
            });
          } else {
            throw new Error('Unknown token in ' + rule.rbnf);
          }
        }
      );
      if (expressionAsts.length === 0) {
        expressionAsts = [
          {
            type: 'Literal',
            value: '',
          },
        ];
      }
      let expressionAst = expressionAsts.shift();
      while (expressionAsts.length > 0) {
        expressionAst = {
          type: 'BinaryExpression',
          operator: '+',
          left: expressionAst,
          right: expressionAsts.shift(),
        };
      }
      return expressionAst;
    }

    function conditionToStatementAst(conditionAst, rule) {
      return {
        type: 'IfStatement',
        test: conditionAst,
        consequent: {
          type: 'ReturnStatement',
          argument: ruleToExpressionAst(rule),
        },
      };
    }

    const statementAsts = [];

    if (this.ruleByValue['x.0'] || this.ruleByValue['x.x']) {
      // var isFractional = n !== Math.floor(n);
      statementAsts.push({
        type: 'VariableDeclaration',
        kind: 'const',
        declarations: [
          {
            type: 'VariableDeclarator',
            id: {
              type: 'Identifier',
              name: 'isFractional',
            },
            init: {
              type: 'BinaryExpression',
              operator: '!==',
              left: {
                type: 'Identifier',
                name: 'n',
              },
              right: {
                type: 'CallExpression',
                callee: {
                  type: 'MemberExpression',
                  computed: false,
                  object: {
                    type: 'Identifier',
                    name: 'Math',
                  },
                  property: {
                    type: 'Identifier',
                    name: 'floor',
                  },
                },
                arguments: [
                  {
                    type: 'Identifier',
                    name: 'n',
                  },
                ],
              },
            },
          },
        ],
      });
    }
    if (this.ruleByValue['x.0']) {
      statementAsts.push(
        conditionToStatementAst(
          {
            type: 'Identifier',
            name: 'isFractional',
          },
          this.ruleByValue['x.0']
        )
      );
    }
    if (this.ruleByValue['-x']) {
      statementAsts.push(
        conditionToStatementAst(
          {
            type: 'BinaryExpression',
            operator: '<',
            left: {
              type: 'Identifier',
              name: 'n',
            },
            right: {
              type: 'Literal',
              value: 0,
            },
          },
          this.ruleByValue['-x']
        )
      );
    }
    if (this.ruleByValue['x.x']) {
      statementAsts.push(
        conditionToStatementAst(
          {
            type: 'Identifier',
            name: 'isFractional',
          },
          this.ruleByValue['x.x']
        )
      );
    }
    if (this.ruleByValue['0.x']) {
      statementAsts.push(
        conditionToStatementAst(
          {
            type: 'LogicalExpression',
            operator: '&&',
            left: {
              type: 'BinaryExpression',
              operator: '>',
              left: {
                type: 'Identifier',
                name: 'n',
              },
              right: {
                type: 'Literal',
                value: 0,
              },
            },
            right: {
              type: 'BinaryExpression',
              operator: '<',
              left: {
                type: 'Identifier',
                name: 'n',
              },
              right: {
                type: 'Literal',
                value: 1,
              },
            },
          },
          this.ruleByValue['0.x']
        )
      );
    }

    Object.keys(this.ruleByValue)
      .filter((value) => /^\d+$/.test(value))
      .map((value) => parseInt(value, 10))
      .sort((a, b) => b - a)
      .forEach(function (numericalValue) {
        if (numericalValue === 0) {
          statementAsts.push({
            type: 'ReturnStatement',
            argument: ruleToExpressionAst(this.ruleByValue[numericalValue]),
          });
        } else {
          statementAsts.push(
            conditionToStatementAst(
              {
                type: 'BinaryExpression',
                operator: '>=',
                left: {
                  type: 'Identifier',
                  name: 'n',
                },
                right: {
                  type: 'Literal',
                  value: numericalValue,
                },
              },
              this.ruleByValue[numericalValue]
            )
          );
        }
      }, this);

    return {
      functionAst: {
        type: 'FunctionExpression',
        params: [
          {
            type: 'Identifier',
            name: 'n',
          },
        ],
        body: {
          type: 'BlockStatement',
          body: statementAsts,
        },
      },
      dependencies: Object.keys(isSeenByRuleSetType),
    };
  },
};

module.exports = CldrRbnfRuleSet;
