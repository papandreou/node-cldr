var fs = require('fs');

var Path = require('path');

var PEG = require('pegjs');

var parser = PEG.generate(
  fs.readFileSync(Path.resolve(__dirname, 'cldrPluralRule.pegjs'), 'utf-8')
);

function rangeListToJavaScriptAst(
  rangeListNode,
  lhsJavaScriptAst,
  withinSemantics
) {
  var javaScriptAst;

  var seenRange = false;
  for (var i = rangeListNode.ranges.length - 1; i >= 0; i -= 1) {
    var range = rangeListNode.ranges[i];

    var itemJavaScriptAst;
    if (range.type === 'number') {
      itemJavaScriptAst = {
        type: 'BinaryExpression',
        operator: '===',
        left: lhsJavaScriptAst,
        right: {
          type: 'Literal',
          value: range.value
        }
      };
    } else {
      // range.type === 'range'
      seenRange = true;
      itemJavaScriptAst = {
        type: 'LogicalExpression',
        operator: '&&',
        left: {
          type: 'BinaryExpression',
          operator: '>=',
          left: lhsJavaScriptAst,
          right: {
            type: 'Literal',
            value: range.min.value
          }
        },
        right: {
          type: 'BinaryExpression',
          operator: '<=',
          left: lhsJavaScriptAst,
          right: {
            type: 'Literal',
            value: range.max.value
          }
        }
      };
    }
    if (javaScriptAst) {
      javaScriptAst = {
        type: 'LogicalExpression',
        operator: '||',
        left: itemJavaScriptAst,
        right: javaScriptAst
      };
    } else {
      javaScriptAst = itemJavaScriptAst;
    }
  }
  if (seenRange && !withinSemantics) {
    javaScriptAst = {
      type: 'LogicalExpression',
      operator: '&&',
      left: {
        type: 'BinaryExpression',
        operator: '===',
        left: lhsJavaScriptAst,
        right: {
          type: 'CallExpression',
          callee: {
            type: 'MemberExpression',
            computed: false,
            object: {
              type: 'Identifier',
              name: 'Math'
            },
            property: {
              type: 'Identifier',
              name: 'floor'
            }
          },
          arguments: [lhsJavaScriptAst]
        }
      },
      right: javaScriptAst
    };
  }
  return javaScriptAst;
}

function nodeToJavaScriptAst(node) {
  switch (node.type) {
    case 'number':
      return {
        type: 'Literal',
        value: node.value
      };
    case 'n':
    case 'i':
    case 'v':
    case 'w':
    case 'f':
    case 't':
      return {
        type: 'Identifier',
        name: node.type
      };
    case 'is':
      return {
        type: 'BinaryExpression',
        operator: '===',
        left: nodeToJavaScriptAst(node.operands[0]),
        right: nodeToJavaScriptAst(node.operands[1])
      };
    case 'isnot':
      return {
        type: 'BinaryExpression',
        operator: '!==',
        left: nodeToJavaScriptAst(node.operands[0]),
        right: nodeToJavaScriptAst(node.operands[1])
      };
    case 'mod':
      return {
        type: 'BinaryExpression',
        operator: '%',
        left: nodeToJavaScriptAst(node.operands[0]),
        right: nodeToJavaScriptAst(node.operands[1])
      };
    case 'and':
      return {
        type: 'BinaryExpression',
        operator: '&&',
        left: nodeToJavaScriptAst(node.operands[0]),
        right: nodeToJavaScriptAst(node.operands[1])
      };
    case 'or':
      return {
        type: 'BinaryExpression',
        operator: '||',
        left: nodeToJavaScriptAst(node.operands[0]),
        right: nodeToJavaScriptAst(node.operands[1])
      };
    case 'not':
      return {
        type: 'UnaryExpression',
        operator: '!',
        prefix: true,
        argument: nodeToJavaScriptAst(node.operands)
      };
    case 'isnot':
      return {
        type: 'BinaryExpression',
        operator: '!==',
        left: nodeToJavaScriptAst(node.operands[0]),
        right: nodeToJavaScriptAst(node.operands[1])
      };
    case 'within':
      return rangeListToJavaScriptAst(
        node.operands[1],
        nodeToJavaScriptAst(node.operands[0]),
        true
      );
    case 'notwithin':
      return {
        type: 'UnaryExpression',
        operator: '!',
        prefix: true,
        argument: rangeListToJavaScriptAst(
          node.operands[1],
          nodeToJavaScriptAst(node.operands[0]),
          true
        )
      };
    case 'in':
      return rangeListToJavaScriptAst(
        node.operands[1],
        nodeToJavaScriptAst(node.operands[0]),
        false
      );
    case 'notin':
      return {
        type: 'UnaryExpression',
        operator: '!',
        prefix: false,
        argument: rangeListToJavaScriptAst(
          node.operands[1],
          nodeToJavaScriptAst(node.operands[0]),
          false
        )
      };
    default:
      throw new Error('nodeToJavaScriptAst: Unknown node type: ' + node.type);
  }
}

function traverse(node, lambda) {
  lambda(node);
  if (node.operands) {
    node.operands.forEach(function(operand) {
      traverse(operand, lambda);
    });
  }
}

function CldrPluralRule(src) {
  this.topLevelNode = parser.parse(
    src.replace(/^\s+|\s+$/g, '').replace(/\s{2,}/g, ' ')
  );
}

CldrPluralRule.prototype = {
  toJavaScriptAst: function() {
    return nodeToJavaScriptAst(this.topLevelNode);
  },

  eachNode: function(lambda) {
    traverse(this.topLevelNode, lambda);
  },

  updateIsUsedByTerm: function(isUsedByTerm) {
    this.eachNode(function(node) {
      if (['i', 'v', 'w', 'f', 't', 'n'].indexOf(node.type) !== -1) {
        isUsedByTerm[node.type] = true;
      }
    });
    return isUsedByTerm;
  }
};

module.exports = CldrPluralRule;
