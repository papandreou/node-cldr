var fs = require('fs'),
    Path = require('path'),
    PEG = require('pegjs'),
    parser = PEG.generate(fs.readFileSync(Path.resolve(__dirname, 'cldrPluralRule.pegjs'), 'utf-8'));

function rangeListToJavaScriptAst(rangeListNode, lhsJavaScriptAst, withinSemantics) {
    var javaScriptAst,
        seenRange = false;
    for (var i = rangeListNode.ranges.length - 1 ; i >= 0 ; i -= 1) {
        var range = rangeListNode.ranges[i],
            itemJavaScriptAst;
        if (range.type === 'number') {
            itemJavaScriptAst = ['binary', '===', lhsJavaScriptAst, ['num', range.value]];
        } else {
            // range.type === 'range'
            seenRange = true;
            itemJavaScriptAst = ['binary', '&&', ['binary', '>=', lhsJavaScriptAst, ['num', range.min.value]],
                ['binary', '<=', lhsJavaScriptAst, ['num', range.max.value]]];
        }
        if (javaScriptAst) {
            javaScriptAst = ['binary', '||', itemJavaScriptAst, javaScriptAst];
        } else {
            javaScriptAst = itemJavaScriptAst;
        }
    }
    if (seenRange && !withinSemantics) {
        javaScriptAst = ['binary', '&&', ['binary', '===', lhsJavaScriptAst,
            ['call', ['dot', ['name', 'Math'], 'floor'], [lhsJavaScriptAst]]],
        javaScriptAst];
    }
    return javaScriptAst;
}

function nodeToJavaScriptAst(node) {
    switch (node.type) {
    case 'number':
        return ['num', node.value];
    case 'n':
    case 'i':
    case 'v':
    case 'w':
    case 'f':
    case 't':
        return ['name', node.type];
    case 'is':
        return ['binary', '==='].concat(node.operands.map(nodeToJavaScriptAst));
    case 'isnot':
        return ['binary', '!=='].concat(node.operands.map(nodeToJavaScriptAst));
    case 'mod':
        return ['binary', '%'].concat(node.operands.map(nodeToJavaScriptAst));
    case 'and':
        return ['binary', '&&'].concat(node.operands.map(nodeToJavaScriptAst));
    case 'or':
        return ['binary', '||'].concat(node.operands.map(nodeToJavaScriptAst));
    case 'not':
        return ['unary-prefix', '!', nodeToJavaScriptAst(node.operands)];
    case 'isnot':
        return ['binary', '!=='].concat(node.operands.map(nodeToJavaScriptAst));
    case 'within':
        return rangeListToJavaScriptAst(node.operands[1], nodeToJavaScriptAst(node.operands[0]), true);
    case 'notwithin':
        return ['unary-prefix', '!', rangeListToJavaScriptAst(node.operands[1], nodeToJavaScriptAst(node.operands[0]), true)];
    case 'in':
        return rangeListToJavaScriptAst(node.operands[1], nodeToJavaScriptAst(node.operands[0]), false);
    case 'notin':
        return ['unary-prefix', '!', rangeListToJavaScriptAst(node.operands[1], nodeToJavaScriptAst(node.operands[0]), false)];
    default:
        throw new Error('nodeToJavaScriptAst: Unknown node type: ' + node.type);
    }
}

function traverse(node, lambda) {
    lambda(node);
    if (node.operands) {
        node.operands.forEach(function (operand) {
            traverse(operand, lambda);
        });
    }
}

function CldrPluralRule(src) {
    this.topLevelNode = parser.parse(src.replace(/^\s+|\s+$/g, '').replace(/\s{2,}/g, ' '));
}

CldrPluralRule.prototype = {
    toJavaScriptAst: function () {
        return nodeToJavaScriptAst(this.topLevelNode);
    },

    eachNode: function (lambda) {
        traverse(this.topLevelNode, lambda);
    },

    updateIsUsedByTerm: function (isUsedByTerm) {
        this.eachNode(function (node) {
            if (['i', 'v', 'w', 'f', 't', 'n'].indexOf(node.type) !== -1) {
                isUsedByTerm[node.type] = true;
            }
        });
        return isUsedByTerm;
    }
};

module.exports = CldrPluralRule;
