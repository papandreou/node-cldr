var fs = require('fs'),
    Path = require('path'),
    PEG = require('pegjs'),
    parser = PEG.buildParser(fs.readFileSync(Path.resolve(__dirname, 'cldrPluralRule.pegjs'), 'utf-8'));

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
        return ['name', 'n'];
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

module.exports = function (cldrPluralRule) {
    var topLevelNode = parser.parse(cldrPluralRule.replace(/^\s+|\s+$/g, '').replace(/\s{2,}/g, ' '));

    return nodeToJavaScriptAst(topLevelNode);
};
