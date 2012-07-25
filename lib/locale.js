/*global one*/
/*jslint evil:true*/

/**
 * Utility for rendering dates, times, date/time intervals,
 * numbers, percentages and much more in formats that honor the
 * user's locale.
 */
one.locale = {
    renderers: {},

    // Return a nicely formatted date interval.
    // FIXME: is this really the best location/name for this method?
    formatInterval: function (dateInterval) {
        if (dateInterval.getDominantMonthInterval().equals(dateInterval)) {
            return this.renderDate(dateInterval.firstDay, "yMMMM");
        } else if (dateInterval.getDominantYearInterval().equals(dateInterval)) {
            return this.renderDate(dateInterval.firstDay, "y");
        } else if (dateInterval.firstDay.getTime() === dateInterval.lastDay.getTime()) {
            return this.renderDate(dateInterval.firstDay, "yMMMEd");
        } else {
            return this.renderInterval(dateInterval, "yMMMd");
        }
    },

    trQuantity: function (patternByQuantity, number) { // ...
        return this.getPatternRenderer(patternByQuantity[this.getQuantity(number)]).call(this, Array.prototype.slice.call(arguments, 1));
    },

    /**
     * Render a list of items as dictated by the locale. The formats
     * are extracted from CLDR (<a
     * href='http://cldr.unicode.org/development/design-proposals/list-formatting'>see
     * some examples</a>).
     *
     * Example invocation:
     * <pre><code>
     *   one.locale.renderList(["foo", "bar", "quux"]); // "foo, bar, and quux" (en_US).
     * </code></pre>
     * @param {String[]} list The list items.
     * @return {String} The rendered list.
     */
    renderList: function (list) {
        switch (list.length) {
        case 0:
            return "";
        case 1:
            return list[0];
        case 2:
            if ('2' in this.listPatterns) {
                return this.renderPattern(list, this.listPatterns['2']);
            }
            /* falls through */
        default:
            var str = this.renderPattern(list.slice(-2), this.listPatterns.end || "{0}, {1}");
            for (var i = list.length - 3; i >= 0; i -= 1) {
                str = this.renderPattern([list[i], str], (!i && this.listPatterns.start) || this.listPatterns.middle || "{0}, {1}");
            }
            return str;
        }
    },

    /**
     * Tokenize a pattern with placeholders for mapping.
     * @param (String) pattern The pattern to tokenize.
     * @return {Array} An array of text and placeholder objects
     * @static
     */
    tokenizePattern: function (pattern) {
        var tokens = [];
        // Split pattern into tokens (return value of replace isn't used):
        pattern.replace(/\{(\d+)\}|([^\{]+)/g, function ($0, placeHolderNumber, text) {
            if (text) {
                tokens.push({
                    type: 'text',
                    value: text
                });
            } else {
                tokens.push({
                    type: 'placeHolder',
                    value: parseInt(placeHolderNumber, 10)
                });
            }
        });
        return tokens;
    },

    /**
     * Get a renderer function for a pattern. Default values for the
     * placeholders can be provided as further arguments (JavaScript
     * code fragments).
     * @param {String} pattern The pattern, e.g. <tt>"I like {0}
     * music"</tt>.
     * @param {String} placeHolderValue1 (optional) The value to
     * insert into the first placeholder.
     * @param {String} placeHolderValue2 (optional) The value to
     * insert into the second placeholder, and so on.
     * @return {Function} The renderer function (String[] => String).
     * @private (use renderPattern or getPatternRenderer)
     */
    makePatternRenderer: function (pattern) { // ...
        if (pattern) {
            var predefinedCodeFragments = [].slice.call(arguments, 1);
            return new Function("values", "return " + this.tokenizePattern(pattern).map(function (token) {
                if (token.type === 'placeHolder') {
                    return predefinedCodeFragments[token.value] || "values[" + token.value + "]";
                } else {
                    return "\"" + token.value.replace(/\"/g, "\\\"").replace(/\n/g, "\\n") + "\"";
                }
            }).join("+") + ";");
        } else {
            // Fail somewhat gracefully if no pattern was provided:
            return function () {
                return "[! makePatternRenderer: No pattern provided !]";
            };
        }
    },

    /**
     * Get a renderer function for a number with unit.
     * @param {String} unit The unit. Supported values: 'year',
     * 'week', 'month', 'day', 'hour', 'minute'.
     * @return {Function} The renderer function (String[] => String).
     * @private (use renderUnit or getUnitRenderer)
     */
    makeUnitRenderer: function (unit) {
        var quantityRenderers = {};
        for (var quantity in this.units[unit]) {
            if (this.units[unit].hasOwnProperty(quantity)) {
                quantityRenderers[quantity] = this.makePatternRenderer(pattern);
            }
        }
        return function (n) {
            return quantityRenderers[one.locale.getQuantity(n)]([n]);
        };
    },

    /**
     * Get a locale-specific renderer function for numbers. The
     * renderer outputs a fixed number of decimals. Thousands
     * separators are not supported yet.
     * @param {Number} numDecimals (optional) The fixed number of
     * decimals, defaults to <tt>0</tt>.
     * @param {Number} factor (optional) Factor to multiply all
     * numbers by (useful for rendering percentages and the likes).
     * @param {String} prefix (optional) String to prefix all
     * renderered numbers with (e.g. <tt>"$"</tt> or <tt>"DKK "</tt>).
     * @param {String} suffix (optional) String to suffix all
     * renderered numbers with (e.g. <tt>"%"</tt> or <tt>" m/s"</tt>).
     * @return {Function} The renderer function (Number => String).
     * @private (use renderNumber or getNumberRenderer)
     */
    makeNumberRenderer: function (numDecimals, factor, prefix, suffix) {
        return new Function("num",
                            "return " +
                                this.makeNumberRendererSource((typeof factor === 'undefined' ? '' : "" + factor + "*") + "num", numDecimals, prefix, suffix) +
                                (suffix ? "+'" + suffix.replace(/\'/g, "\\'") + "'" : "") + ";");
    },

    /**
     * Make a percentage renderer, honoring the locale's preferred
     * percent sign and number format. The renderer outputs a fixed
     * number of decimals.
     * @param {Number} numDecimals (optional) The fixed number of
     * decimals, defaults to <tt>0</tt>.
     * @returns {Function} The renderer function (Number => String).
     * @private (use renderPercentage or getPercentageRenderer)
     */
    makePercentageRenderer: function (numDecimals) {
        return new Function("num", "return " + this.makeNumberRendererSource("100*num", numDecimals, "", " " + this.numberSymbols.percentSign) + ";");
    },

    /**
     * Make a function for rendering a file size, ie. a number of
     * bytes. The renderer works like {@link
     * Ext.util.Format#fileSize}, but respects the locale's decimal
     * separator. Note: The strings <tt>bytes</tt>, <tt>KB</tt>,
     * <tt>MB</tt>, and <tt>GB</tt> are not localized yet, sorry!
     * @param {Number} numDecimals (optional) The fixed number of
     * decimals, defaults to <tt>0</tt>. Won't be used when the number
     * of bytes is less than or equal to 1000.
     * @return {Function} The file size renderer (Number => String).
     * @private (use renderFileSize or getFileSizeRenderer)
     */
    makeFileSizeRenderer: function (numDecimals) {
        return new Function("size",
                            "if (size < 1000) {" +
                                "return " + this.makeNumberRendererSource("size", 0, "", " bytes") + ";" +
                            "} else if (size < 1000000) {" +
                                "return " + this.makeNumberRendererSource("size/1024", numDecimals, "", " KB") + ";" +
                            "} else if (size < 1000000000) {" +
                                "return " + this.makeNumberRendererSource("size/1048576", numDecimals, "", " MB") + ";" +
                            "} else if (size < 1000000000000) {" +
                                "return " + this.makeNumberRendererSource("size/1073741824", numDecimals, "", " GB") + ";" +
                            "} else {" +
                                "return " + this.makeNumberRendererSource("size/1099511627776", numDecimals, "", " TB") + ";" +
                            "}");
    },

    /**
     * Make a JavaScript code fragment for rendering a number in the
     * locale's number format with a fixed number of decimals. Useful
     * in a <tt>new Function("...")</tt> construct.
     * @param {String} sourceVariableNameOrExpression JavaScript
     * expression representing the number to render, a variable name
     * in the simple case.
     * @return {String} The JavaScript code fragment.
     * @private
     */
    makeNumberRendererSource: function (sourceVariableNameOrExpression, numDecimals, prefix, suffix) {
        return (prefix ? "'" + prefix.replace(/\'/g, "\\'") + "'+" : "") +
            "(" + sourceVariableNameOrExpression + ")" +
            ".toFixed(" + (numDecimals || 0) + ")" +
            (this.numberSymbols.decimalPoint === '.' ? "" : ".replace('.', '" + this.numberSymbols.decimal.replace(/\'/g, "\\'") + "')") +
            (suffix ? "+'" + suffix.replace(/\'/g, "\\'") + "'" : "");
    },

    /**
     * Make a locale-specific date renderer using one of the locale's
     * standard full/long/medium/short time or date formats, or given
     * by a CLDR <tt>dateFormatItem</tt> id (<a
     * href='http://unicode.org/reports/tr35/#dateFormats'>see some
     * examples</a>).
     * @param {String} formatId The CLDR id of the date format, or
     * <tt>"fullDate"</tt>, <tt>"fullTime"</tt>, <tt>"fullDateTime"</tt>,
     * <tt>"longDate"</tt>, <tt>"longTime"</tt>, <tt>"longDateTime"</tt>,
     * <tt>"mediumDate"</tt>, <tt>"mediumTime"</tt>, <tt>"mediumDateTime"</tt>,
     * <tt>"shortDate"</tt>, <tt>"shortTime"</tt>, or <tt>"shortDateTime"</tt>.
     * @return {Function} The date renderer.
     * @private (use renderDate or getDateRenderer)
     */
    makeDateRenderer: function (formatId) {
        var format;
        if (formatId === 'hv') {
            // Hack: There's no 'hv' format in CLDR. Try to make one by stripping the minute part from the short time format:
            format = this.getDateFormat("shortTime").replace(/[\.:]i\s*/, "");
        } else {
            format = this.getDateFormat(formatId);
        }
        return Ext.util.Format.dateRenderer(format);
    },

    /**
     * Make a locale-specific date or date-time interval renderer
     * using one of the locale's standard full/long/medium/short time
     * or date formats, or specified by a CLDR <tt>dateFormatItem</tt>
     * id (<a href='http://unicode.org/reports/tr35/#timeFormats'>see
     * some examples</a>).
     * @param {String} formatId The CLDR id of the date format, or
     * <tt>"fullDate"</tt>, <tt>"fullTime"</tt>, <tt>"fullDateTime"</tt>,
     * <tt>"longDate"</tt>, <tt>"longTime"</tt>, <tt>"longDateTime"</tt>,
     * <tt>"mediumDate"</tt>, <tt>"mediumTime"</tt>, <tt>"mediumDateTime"</tt>,
     * <tt>"shortDate"</tt>, <tt>"shortTime"</tt>, or <tt>"shortDateTime"</tt>.
     * @return {Function} The date or date-time interval renderer
     * (one.DateInterval|one.DateTimeInterval => String).
     * @private (use renderInterval or getIntervalRenderer)
     */
    makeIntervalRenderer: function (formatId) {
        var greatestDifferences = this.intervalFormats[formatId];
        if (!greatestDifferences) {
            var bestMatchingIntervalFormatId = this.getBestICUFormatId(formatId, this.intervalFormats);
            if (bestMatchingIntervalFormatId) {
                // Clone the best match, then adapt it:
                greatestDifferences = {};
                for (var key in this.intervalFormats[bestMatchingIntervalFormatId]) {
                    greatestDifferences[key] = this.adaptICUFormat(this.intervalFormats[bestMatchingIntervalFormatId][propertyName], formatId);
                }
            }
        }
        if (greatestDifferences) {
            return this.makeIntervalRendererFromGreatestDifferences(greatestDifferences);
        } else {
            var dateFormat = this.getDateFormat(formatId),
                fallbackRenderer;
            if (dateFormat) {
                var escapedDateFormat = dateFormat.replace(/\"/g, "\\\"");
                fallbackRenderer = this.getPatternRenderer(this.intervalFallbackFormat,
                                                           "arguments[0].start.format(\"" + escapedDateFormat + "\")",
                                                           "arguments[0].end.format(\"" + escapedDateFormat + "\")");
            } else {
                throw "renderInterval: No usable interval format found for " + formatId;
            }
            var m = formatId.match(/^([yMQEd]+)([Hhms]+)$/);
            if (m) {
                // The requested format has both date and time components. We can do a little better than the
                // fallback format by
                //   a) Only rendering the date part when a one.DateInterval is provided
                //   b) Don't repeat the date part for intervals that start and end on the same day
                var dateFormatId = m[1],
                    timeFormatId = m[2];
                return function (interval) {
                    if (interval instanceof one.DateInterval) {
                        return this.renderInterval(interval, dateFormatId);
                    } else if (interval.firstDay.sameDateAs(interval.lastDay)) {
                        return this.renderDate(interval.firstDay, dateFormatId) + ", " + this.renderInterval(interval, timeFormatId); // Hack
                    } else {
                        return fallbackRenderer(interval);
                    }
                }.createDelegate(this);
            } else {
                return fallbackRenderer;
            }
        }
    },

    /**
     * Get one of the locale's standard full/long/medium/short time or
     * date formats, or a locale-specific format specified by a CLDR
     * <tt>dateFormatItem</tt> id (<a
     * href='http://unicode.org/reports/tr35/#dateFormats'>see some
     * examples</a>).
     *
     * Example invocation:
     * <pre><code>
     *   one.locale.getDateFormat("fullDate"); // "l, F j, Y" (en_US)
     * </code></pre>
     * @param {String} formatId The CLDR id of the date format, or
     * <tt>"fullDate"</tt>, <tt>"fullTime"</tt>, <tt>"fullDateTime"</tt>,
     * <tt>"longDate"</tt>, <tt>"longTime"</tt>, <tt>"longDateTime"</tt>,
     * <tt>"mediumDate"</tt>, <tt>"mediumTime"</tt>, <tt>"mediumDateTime"</tt>,
     * <tt>"shortDate"</tt>, <tt>"shortTime"</tt>, or <tt>"shortDateTime"</tt>.
     * @return {String} The date format in {@link
     * Date#format}-compatible syntax, or undefined if no usable
     * format could be found.
     */
    getDateFormat: function (formatId) {
        var icuFormat = this.getICUDateFormat(formatId);
        return icuFormat && this.convertICUDateFormatToExt(icuFormat);
    },

    // private
    getICUDateFormat: function (formatId) {
        var icuFormat = this.dateFormats.basic[formatId] || this.dateFormats.cldr[formatId];
        if (icuFormat) {
            return icuFormat;
        } else {
            // The exact format wasn't found.
            // See if we know a similar format that can be rewritten, explanation here: http://unicode.org/cldr/trac/ticket/2641
            var bestCandidateFormatId = this.getBestICUFormatId(formatId, this.dateFormats.cldr);
            if (bestCandidateFormatId) {
                return (this.dateFormats.cldr[formatId] = this.adaptICUFormat(this.dateFormats.cldr[bestCandidateFormatId], formatId));
            } else {
                // No suitable formats found
                var m = formatId.match(/^y+M+d+$/);
                if (m) {
                    // For some reason there's no yMd fragment in CLDR, adapt the short date format to the required level of detail:
                    return (this.dateFormats.cldr[formatId] = this.adaptICUFormat(this.dateFormats.basic.shortDate, formatId));
                }

                m = formatId.match(/^([yMQEd]+)([Hhms]+)$/);
                if (m) {
                    // It's a format with both date and time components. Try to lookup the date and time parts separately,
                    // then compose them use the default date time pattern:
                    var dateFormat = this.getICUDateFormat(m[1]),
                        timeFormat = this.getICUDateFormat(m[2]);
                    return dateFormat && timeFormat && this.renderPattern([timeFormat, dateFormat], this.defaultDateTimePattern);
                } else {
                    return; // No usable date format found
                }
            }
        }
    },

    /**
     * Make a date or date-time interval renderer from an
     * ExtJS ({@link Date#format}-compatible) format string.
     * @param {String} format The format.
     * @return {Function} The date or date-time interval renderer
     * function (one.DateInterval|one.DateTimeInterval => String).
     * @private
     */
    makeIntervalRendererFromFormatString: function (format) {
        var code = [],
            special = false,
            ch = '',
            seenCodes = {};
        for (var i = 0; i < format.length; i += 1) {
            ch = format.charAt(i);
            if (!special && ch === "\\") {
                special = true;
            } else if (special) {
                special = false;
                code.push("'" + String.escape(ch) + "'");
            } else {
                code.push(Date.getFormatCode(ch).replace(/this/g, 'interval.' + (seenCodes[ch] ? 'end' : 'start')));
                seenCodes[ch] = 1;
            }
        }
        return new Function('interval', 'return ' + code.join('+') + ";");
    },

    /**
     * Make a date or date-time interval renderer from an object
     * representing the <tt>greatestDifferences</tt> interval formats
     * as extracted from CLDR (see <a
     * href='http://unicode.org/reports/tr35/#dateTimeFormats'>see
     * some examples</a>) by <tt>build-locale.pl</tt>.
     * @param {Object} greatestDifferences Object containing the
     * greatestDifferences map.
     * @return {Function} The date or date-time interval renderer
     * (one.DateInterval|one.DateTimeInterval => String).
     * @private
     */
    makeIntervalRendererFromGreatestDifferences: function (greatestDifferences) {
        var formatters = [],
            previousFormatter;
        ['y', 'M', 'd', 'a', 'h', 'm'].forEach(function (ch, i) {
            var formatter;
            if (ch in greatestDifferences) {
                formatter = this.makeIntervalRendererFromFormatString(this.convertICUDateFormatToExt(greatestDifferences[ch]));
                if (!previousFormatter) {
                    for (var j = 0; j < i; j += 1) {
                        formatters[j] = formatter;
                    }
                }
                previousFormatter = formatters[i] = formatter;
            } else if (previousFormatter) {
                formatters[i] = previousFormatter;
            }
        }, this);
        var intervalRenderers = {};
        for (var greatestDifference in greatestDifferences) {
            if (greatestDifferences.hasOwnProperty(greatestDifference)) {
                intervalRenderers[greatestDifference] = this.makeIntervalRendererFromFormatString(this.convertICUDateFormatToExt(greatestDifferences[greatestDifference]));
            }
        }
        return function (interval) {
            if (interval.start.getFullYear() !== interval.end.getFullYear()) {
                return formatters[0](interval);
            } else if (interval.start.getMonth() !== interval.end.getMonth()) {
                return formatters[1](interval);
            } else if (interval.start.getDate() !== interval.end.getDate()) {
                return formatters[2](interval);
            } else if ((interval.start.getHours() >= 12) === (interval.end.getHours() >= 12)) {
                return formatters[4](interval);
            } else if (interval.start.getHours() !== interval.end.getHours()) {
                return formatters[3](interval);
            } else {
                return formatters[5](interval);
            }
        };
    },

    /**
     * Get the CLDR id of the best matching date or date-time format
     * given a (possible non-existent) CLDR
     * <tt>dateFormatItem</tt>-like id.
     * @param {String} formatId The CLDR id of the date or date-time
     * format to search for.
     * @param {Object} sourceObject The object to search for
     * candidates in, could be set to <tt>this.dateFormats.cldr</tt>
     * or <tt>this.intervalFormats</tt>.
     * @return {String} The CLDR id of the best matching format, or
     * undefined if no candidate is found.
     * @private
     */
    getBestICUFormatId: function (formatId, sourceObject) {
        var bestCandidateFormatId,
            matcher = new RegExp("^" + formatId.replace(/(([a-zA-Z])\2*)/g, function ($0, formatToken, formatChar) {
                return formatChar + "{1," + formatToken.length + "}";
            }) + "$");
        // Find the longest matching candidate:
        for (var candidateFormatId in sourceObject) {
            if (matcher.test(candidateFormatId)) {
                if (!bestCandidateFormatId || candidateFormatId.length > bestCandidateFormatId.length) {
                    bestCandidateFormatId = candidateFormatId;
                }
            }
        }
        return bestCandidateFormatId;
    },

    /**
     * Adapt an ICU date format to a different level of detail as
     * specified by a CLDR <tt>dateFormatItem</tt> id. Typically used
     * in conjunction with {@link one.localelib.Base#getBestICUFormatId}. The
     * return value probably won't make sense if the parameters
     * specify incompatible formats.
     * @param {String} icuFormat The ICU format to adapt.
     * @param {String} adaptToFormatId The CLDR id specifying the
     * level of detail to adapt to.
     * @return {String} The adapted ICU format.
     * @private
     */
    adaptICUFormat: function (icuFormat, adaptToFormatId) {
        adaptToFormatId.replace(/(([a-zA-Z])\2*)/g, function ($0, formatToken, formatChar) { // For each token in the wanted format id
            // FIXME: This should probably be aware of quoted strings:
            icuFormat = icuFormat.replace(new RegExp(formatChar + "+", "g"), formatToken);
        });
        return icuFormat;
    },

    /**
     * Convert an ICU date format to ExtJS ({@link
     * Date#format}-compatible) format.
     * @param {String} icuFormat The ICU date or date-time format.
     * @return {String} The ExtJS date format.
     * @static
     * @private
     */
    convertICUDateFormatToExt: function (icuFormat) {
        return icuFormat.replace(/(([a-zA-Z])\2*)|(\'(?:[^\']|\'\')*\')/g, function ($0, formatToken, formatChar, quotedString) {
            if (quotedString) {
                return quotedString.replace(/^\'|\'$/g, "").replace(/\'\'/g, "\'").replace(/(.)/g, "\\$1");
            } else {
                var candidates = {
                    G: [''], // Unsupported: Era
                    Q: [''], // Unsupported: Quarter - Use one or two for the numerical quarter, three for the abbreviation, or four for the full name.
                    A: [''], // Unsupported: Milliseconds in day
                    E: ['D', 'D', 'D', 'l'],
                    d: ['j', 'd'],
                    L: ['n', 'm', 'M', 'F'],
                    M: ['n', 'm', 'M', 'F'],
                    y: ['Y'],
                    H: ['H'],
                    h: ['g'],
                    m: ['i'],
                    s: ['s'],
                    a: ['a'],
                    v: ['T'],
                    z: ['O', 'O', 'O', 'T']
                }[formatChar];
                if (candidates) {
                    return candidates[Math.min(formatToken.length, candidates.length) - 1];
                } else {
                    throw "Unsupported format token: " + formatToken + " in format: " + icuFormat;
                }
            }
        });
    }
};

/**
 * @name one.locale
 * @namespace one.locale
 */

/**
 * Render a number with unit in a locale-specific format.
 *
 * Example invocation:
 * <pre><code>
 *   one.locale.renderUnit(1, 'hour'); // "1 hour" (en_US locale)
 *   one.locale.renderUnit(14, 'month'); // "14 months" (en_US locale)
 * </code></pre>
 * @param {Number} number The number to render.
 * @param {String} unit The unit. Supported values: 'year',
 * 'week', 'month', 'day', 'hour', 'minute'.
 * @return {String} The rendered number with unit.
 * @name one.locale.renderUnit
 * @function
 */

/**
 * Get a locale-specific renderer function for numbers with units.
 *
 * Example invocation:
 * <pre><code>
 *   var weekRenderer = one.locale.getUnitRenderer('week');
 *   weekRenderer(10); // "10 weeks" (en_US)
 * </code></pre>
 * @param {String} unit The unit. Supported values: 'year', 'week',
 * 'month', 'day', 'hour', 'minute'.
 * @return {Function} The renderer function (Number => String).
 * @name one.locale.getUnitRenderer
 * @function
 */

/**
 * Render a number in a locale-specific format with a fixed number of
 * decimals. Thousands separators are not supported yet.
 *
 * Example invocation:
 * <pre><code>
 *   one.locale.renderNumber(14.5, 2, undefined, "kr. "); // "kr. 14,00" (da)
 * </code></pre>
 * @param {Number} number The number to render.
 * @param {Number} numDecimals (optional) The fixed number of
 * decimals, defaults to <tt>0</tt>.
 * @param {Number} factor (optional) Factor to multiply all numbers by
 * (useful for rendering percentages and the likes).
 * @param {String} prefix (optional) String to prefix all renderered
 * numbers with (e.g. <tt>"$"</tt> or <tt>"DKK "</tt>).
 * @param {String} suffix (optional) String to suffix all renderered
 * numbers with (e.g. <tt>"%"</tt> or <tt>" m/s"</tt>).
 * @return {String} The rendered number.
 * @name one.locale.renderNumber
 * @function
 */

/**
 * Get a locale-specific renderer function for numbers. The renderer
 * outputs a fixed number of decimals. Thousands separators are not
 * supported yet.
 *
 * Example invocation:
 * <pre><code>
 *   var moneyRenderer = one.locale.getNumberRenderer(2, undefined, "$");
 *   moneyRenderer(14.42442); // "$14.42" (en_US)
 * </code></pre>
 * @param {Number} numDecimals (optional) The fixed number of
 * decimals, defaults to <tt>0</tt>.
 * @param {Number} factor (optional) Factor to multiply all numbers by
 * (useful for rendering percentages and the likes).
 * @param {String} prefix (optional) String to prefix all renderered
 * numbers with (e.g. <tt>"$"</tt> or <tt>"DKK "</tt>).
 * @param {String} suffix (optional) String to suffix all renderered
 * numbers with (e.g. <tt>"%"</tt> or <tt>" m/s"</tt>).
 * @return {Function} The renderer function (Number => String).
 * @name one.locale.getNumberRenderer
 * @function
 */

/**
 * Render a percentage in a locale-specific format with the locale's
 * preferred percent sign and number format and a fixed number of
 * decimals.
 *
 * Example invocations:
 * <pre><code>
 *   one.locale.renderPercentage(.42, 3); // "42.000 %" (en_US)
 *   one.locale.renderPercentage(12, 2); // "1200.00 %" (en_US)
 * </code></pre>
 * @param {Number} number The percentage to render.
 * @param {Number} numDecimals (optional) The fixed number of
 * decimals, defaults to <tt>0</tt>.
 * @returns {String} The rendered percentage.
 * @name one.locale.renderPercentage
 * @function
 */

/**
 * Get a percentage renderer honoring the locale's preferred percent
 * sign and number format. The renderer outputs a fixed number of
 * decimals.
 *
 * Example invocation:
 * <pre><code>
 *   var renderer = one.locale.getPercentageRenderer(2);
 *   renderer(.66677); // "66.68 %" (en_US)
 * </code></pre>
 * @param {Number} numDecimals (optional) The fixed number of
 * decimals, defaults to <tt>0</tt>.
 * @returns {Function} The renderer function (Number => String).
 * @name one.locale.getPercentageRenderer
 * @function
 */

/**
 * Render a file size, ie. a number of bytes, in a locale specific
 * format. Works like {@link Ext.util.Format#fileSize}, but respects
 * the locale's decimal separator. Note: The strings <tt>bytes</tt>,
 * <tt>KB</tt>, <tt>MB</tt>, and <tt>GB</tt> are not localized yet,
 * sorry!
 *
 * Example invocations:
 * <pre><code>
 *   one.locale.renderFileSize(1024*1024*1024, 2); // "1.00 GB" (en_US)
 *   one.locale.renderFileSize(4141243, 2); // "3.95 MB" (en_US)
 *   one.locale.renderFileSize(1008, 2); // "0.98 KB" (en_US)
 * </code></pre>
 * @param {Number} numBytes The file size (number of bytes) to render.
 * @param {Number} numDecimals (optional) The fixed number of
 * decimals, defaults to <tt>0</tt>. Won't be used when the number of
 * bytes is less than or equal to 1000.
 * @return {String} The rendered file size.
 * @name one.locale.renderFileSize
 * @function
 */

/**
 * Get a locale-specific function for rendering a file size, ie. a
 * number of bytes. The renderer works like {@link
 * Ext.util.Format#fileSize}, but respects the locale's decimal
 * separator. Note: The strings <tt>bytes</tt>, <tt>KB</tt>,
 * <tt>MB</tt>, and <tt>GB</tt> are not localized yet, sorry!
 *
 * Example invocations:
 * <pre><code>
 *   one.locale.getFileSizeRenderer(2)(41841242); // "39.90 MB" (en_US)
 *   one.locale.getFileSizeRenderer()(0x40); // "64 bytes"
 * </code></pre>
 * @param {Number} numDecimals (optional) The fixed number of
 * decimals, defaults to <tt>0</tt>. Won't be used when the number of
 * bytes is less than or equal to 1000.
 * @return {Function} The file size renderer (Number => String).
 * @name one.locale.getFileSizeRenderer
 * @function
 */

/**
 * Render a date or date-time in one of the locale's standard
 * full/long/medium/short time or date formats, or a locale-specific
 * format specified by a CLDR <tt>dateFormatItem</tt> id (<a
 * href='http://unicode.org/reports/tr35/#dateFormats'>see some
 * examples</a>).
 *
 * Example invocations:
 * <pre><code>
 *   var aprilFourth = new Date(2010, 3, 4);
 *   one.locale.renderDate(aprilFourth, "fullDate"); // "Sunday, April 4, 2010" (en_US)
 *   one.locale.renderDate(aprilFourth, "shortTime"); // "12:00 am" (en_US)
 *   one.locale.renderDate(aprilFourth, "MMMMEd"); // "Sun, April 4" (en_US)
 * </code></pre>
 * @param {Date} date The date or date-time to render.
 * @param {String} formatId The CLDR id of the date format, or
 * <tt>"fullDate"</tt>, <tt>"fullTime"</tt>, <tt>"fullDateTime"</tt>,
 * <tt>"longDate"</tt>, <tt>"longTime"</tt>, <tt>"longDateTime"</tt>,
 * <tt>"mediumDate"</tt>, <tt>"mediumTime"</tt>, <tt>"mediumDateTime"</tt>,
 * <tt>"shortDate"</tt>, <tt>"shortTime"</tt>, or <tt>"shortDateTime"</tt>.
 * @return {String} The rendered date.
 * @name one.locale.renderDate
 * @function
 */

/**
 * Get a renderer for one of the locale's standard
 * full/long/medium/short time or date formats, or a locale-specifc
 * format specified by a CLDR <tt>dateFormatItem</tt> id (<a
 * href='http://unicode.org/reports/tr35/#dateFormats'>see some
 * examples</a>).
 *
 * Example invocations:
 * <pre><code>
 *   one.locale.renderDate(new Date(2010, 5, 7, 22, 30), "mediumTime"); // "10:30:00 pm" (en_US)
 *   one.locale.renderDate(new Date(2010, 5, 7, 22, 30), "longDate"); // "June 7, 2010" (en_US)
 * </code></pre>
 * @param {String} formatId The CLDR id of the date format, or
 * <tt>"fullDate"</tt>, <tt>"fullTime"</tt>, <tt>"fullDateTime"</tt>,
 * <tt>"longDate"</tt>, <tt>"longTime"</tt>, <tt>"longDateTime"</tt>,
 * <tt>"mediumDate"</tt>, <tt>"mediumTime"</tt>, <tt>"mediumDateTime"</tt>,
 * <tt>"shortDate"</tt>, <tt>"shortTime"</tt>, or <tt>"shortDateTime"</tt>.
 * @return {Function} The date renderer.
 * @name one.locale.getDateRenderer
 * @function
 */

/**
 * Render a date or date-time interval using one of the locale's
 * standard full/long/medium/short time or date formats, or a
 * locale-specific format specified by a CLDR <tt>dateFormatItem</tt>
 * id (<a href='http://unicode.org/reports/tr35/#timeFormats'>see some
 * examples</a>).
 *
 * Example invocations:
 * <pre><code>
 *   var firstTenDaysOfJune = new one.DateInterval(new Date(2010, 5, 1), new Date(2010, 5, 10));
 *   one.locale.renderInterval(firstTenDaysOfJune, "yMMd"); // "06/1/2010-06/10/2010" (en_US)
 *   one.locale.renderInterval(firstTenDaysOfJune, "yMMMMd"); // "June 1-10, 2010" (en_US)
 * </code></pre>
 * @param {one.DateInterval|one.DateTimeInterval} interval The date or
 * date-time interval to render.
 * @param {String} formatId The CLDR id of the date format, or
 * <tt>"fullDate"</tt>, <tt>"fullTime"</tt>, <tt>"fullDateTime"</tt>,
 * <tt>"longDate"</tt>, <tt>"longTime"</tt>, <tt>"longDateTime"</tt>,
 * <tt>"mediumDate"</tt>, <tt>"mediumTime"</tt>, <tt>"mediumDateTime"</tt>,
 * <tt>"shortDate"</tt>, <tt>"shortTime"</tt>, or <tt>"shortDateTime"</tt>.
 * @return {Function} The rendered date or date-time interval.
 * @name one.locale.renderInterval
 * @function
 */

/**
 * Get a renderer for a date or date-time interval that uses one of
 * the locale's standard full/long/medium/short time or date formats,
 * or a locale-specific format specified by a CLDR <tt>dateFormatItem</tt>
 * id (<a href='http://unicode.org/reports/tr35/#timeFormats'>see some
 * examples</a>).
 *
 * Example invocation:
 * <pre><code>
 *   var renderer = one.locale.getIntervalRenderer("yMMMM"),
 *       januaryThroughApril = new one.DateInterval(new Date(2010, 0, 1), new Date(2010, 4, 0));
 *   renderer(januaryThroughApril); // "January-April 2010" (en_US)
 * </code></pre>
 * @param {String} formatId The CLDR id of the date format, or
 * <tt>"fullDate"</tt>, <tt>"fullTime"</tt>, <tt>"fullDateTime"</tt>,
 * <tt>"longDate"</tt>, <tt>"longTime"</tt>, <tt>"longDateTime"</tt>,
 * <tt>"mediumDate"</tt>, <tt>"mediumTime"</tt>, <tt>"mediumDateTime"</tt>,
 * <tt>"shortDate"</tt>, <tt>"shortTime"</tt>, or <tt>"shortDateTime"</tt>.
 * @return {Function} The date or date-time interval renderer,
 * one.DateInterval|one.DateTimeInterval => String.
 * @name one.locale.getIntervalRenderer
 * @function
 */

/**
 * Render a pattern, ie. substitute all placeholders with the provided
 * values.
 *
 * Example invocation:
 * <pre><code>
 *   one.locale.renderPattern(["jazz", "blues"], "I like {1} and {0} music"); // "I like blues and jazz music"
 * </code></pre>
 * @param {String[]} placeHolderValues The placeholder values.
 * @param {String} pattern The pattern.
 * @return {String} The rendered pattern.
 * @function
 * @name one.locale.renderPattern
 */

/**
 * Get a renderer function for a pattern. Fixed values for the the
 * placeholders can be provided as further arguments (JavaScript code
 * fragments). This feature probably has a limited usefulness outside
 * of one.localelib.Base itself.
 *
 * Example invocation:
 * <pre><code>
 *   var pattern = "WhatThe{0} is {1}?";
 *   one.locale.getPatternRenderer(pattern)(["Font", "Tahoma"]); // "WhatTheFont is Tahoma?"
 *   one.locale.getPatternRenderer(pattern, "\"***\"")(["foo", "bar"]); // "WhatThe*** is bar?"
 * </code></pre>
 * @param {String} pattern The pattern.
 * @param {String[]} placeHolderValues (optional) The JavaScript code
 * fragment to use for the first placeholder.
 * @return {Function} The renderer function, String[] (optional) =>
 * String.
 * @name one.locale.getPatternRenderer
 * @function
 */

// Generate render(Unit|Number|Percentage|FileSize|Date|Interval|Pattern)
// and get(Unit|Number|Percentage|FileSize|Date|Interval|Pattern)Renderer
// methods.

['Unit', 'Number', 'Percentage', 'FileSize', 'Date', 'Interval', 'Pattern'].forEach(function (rendererType) {
    one.locale['get' + rendererType + 'Renderer'] = function () { // ...
        var rendererId = rendererType + ':' + [].join.call(arguments, '/');
        return this.renderers[rendererId] || (this.renderers[rendererId] = this['make' + rendererType + 'Renderer'].apply(this, arguments));
    };
    one.locale['render' + rendererType] = function (obj) { // ...
        // this.renderDate(date, format) => this.getDateRenderer(format)(date)
        // this.renderInterval(interval, format) => this.getIntervalRenderer(format)(interval)
        // this.renderPattern(argumentsArray, pattern, codeFragment1, codeFragment2) => this.getPatternRenderer(pattern, codeFragment1, codeFragment2)(argumentsArray)
        var makeRendererArgs = [].slice.call(arguments, 1);
        return (this.renderers[rendererType + ':' + makeRendererArgs.join('/')] || this['get' + rendererType + 'Renderer'].apply(this, makeRendererArgs))(obj);
    };
});
