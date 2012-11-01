condition    = a:subcondition " and "i b:condition {return ["binary", "&&", a, b];}
             / a:subcondition " or "i b:condition {return ["binary", "||", a, b];}
             / " not "i a:condition {return ["unary-prefix", "!", a];}
             / subcondition

subcondition = ex:expression " is not "i i:INT {return ["binary", "!==", ex, i];}
             / ex:expression " is "i i:INT {return ["binary", "===", ex, i];}
             / ex:expression " " "with"i? "in "i i1:INT ".." i2:INT "," i3:INT ".." i4:INT {return ["binary", "||", ["binary", "&&", ["binary", ">=", ex, i1], ["binary", "<=", ex, i2]], ["binary", "&&", ["binary", ">=", ex, i3], ["binary", "<=", ex, i4]]];}
             / ex:expression " " "with"i? "in "i i1:INT ".." i2:INT "," i3:INT {return ["binary", "||", ["binary", "&&", ["binary", ">=", ex, i1], ["binary", "<=", ex, i2]], ["binary", "===", ex, i3]];}
             / ex:expression " " "with"i? "in "i i1:INT ".." i2:INT {return ["binary", "&&", ["binary", ">=", ex, i1], ["binary", "<=", ex, i2]];}
             / ex:expression " " "with"i? "in "i i1:INT "," i2:INT {return ["binary", "||", ["binary", "===", ex, i1], ["binary", "===", ex, i2]];}
             / ex:expression " not "i "with"i? "in "i i1:INT ".." i2:INT "," i3:INT ".." i4:INT "," i5:INT ".." i6:INT {return ['binary', '&&', ['binary', '&&', ['unary-prefix', '!', ['binary', '&&', ['binary', '>=', ex, ['name', 'i1']], ['binary', '<=', ex, ['name', 'i2']]]], ['unary-prefix', '!', ['binary', '&&', ['binary', '>=', ex, ['name', 'i3']], ['binary', '<=', ex, ['name', 'i4']]]]], ['unary-prefix', '!', ['binary', '&&', ['binary', '>=', ex, ['name', 'i5']], ['binary', '<=', ex, ['name', 'i6']]]]];}
             / ex:expression " not "i "with"i? "in "i i1:INT ".." i2:INT {return ["unary-prefix", "!", ["binary", "&&", ["binary", ">=", ex, i1], ["binary", "<=", ex, i2]]];}
             / ex:expression " not "i "with"i? "in "i i1:INT "," i2:INT "," i3:INT {return ["binary", "&&", ["binary", "!==", ex, i1], ["binary", "&&", ["binary", "!==", ex, i2], ["binary", "!==", ex, i3]]];}

expression   = t:term " mod "i i:INT {return ["binary", "%", t, i];}
             / term

term         = INT
             / "n"i {return ["name", "n"];}

INT          = sign:[-+]? digits:[0-9]+ { return ["num", parseInt(sign + digits.join(""), 10)]; }
