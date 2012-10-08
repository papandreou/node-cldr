var Path = require('path'),
    fs = require('fs'),
    passError = require('passerror'),
    libxmljs = require('libxmljs'),
    seq = require('seq'),
    normalizeLocaleId = require('./normalizeLocaleId'),
    cldrPluralRuleToJavaScriptAst = require('./cldrPluralRuleToJavaScriptAst'),
    uglifyJs = require('uglify-js');

function Cldr(cldrPath) {
    this.cldrPath = cldrPath;
    this.documentByFileName = {};
    this.cldrCommonMainXmlFileNameByNormalizedLocaleId = {};

    // Sorry, but it's just one sync call per Cldr instance:
    fs.readdirSync(Path.resolve(this.cldrPath, "common", "main")).forEach(function (fileName) {
        var matchFileName = fileName.match(/^(.*)\.xml$/);
        if (matchFileName) {
            this.cldrCommonMainXmlFileNameByNormalizedLocaleId[normalizeLocaleId(matchFileName[1])] =
                Path.resolve(this.cldrPath, "common", "main", fileName);
        }
    }, this);
}

Cldr.prototype = {
    getDocument: function (fileName, cb) {
        var that = this;

        if (that.documentByFileName[fileName]) {
            process.nextTick(function () {
                cb(null, that.documentByFileName[fileName]);
            });
        } else {
            fs.readFile(fileName, 'utf-8', passError(cb, function (xmlString) {
                var document = libxmljs.parseXmlString(xmlString);
                that.documentByFileName[fileName] = document;
                cb(null, document);
            }));
        }
    },

    getCommonMainDocument: function (localeId, cb) {
        var that = this;
        that.getDocument(that.cldrCommonMainXmlFileNameByNormalizedLocaleId[normalizeLocaleId(localeId)], cb);
    },

    getLocaleData: function (localeId, cb) {
        var that = this,
            localeData = {};
        that.getCommonMainDocument(localeId, passError(cb, function (document) {
            localeData.localeDisplayNames = {};
            document.find('/ldml/localeDisplayNames/languages/language').forEach(function (node) {
                var localeId = normalizeLocaleId(node.attr('type').value());
                localeData.localeDisplayNames[localeId] = localeData.localeDisplayNames[localeId] || node.text();
            });

            localeData.numberSymbols = {};
            document.find("/ldml/numbers/symbols/*").forEach(function (numberSymbolNode) {
                if (numberSymbolNode.name() === 'alias') {
                    return;
                }
                var numberSystemId = numberSymbolNode.parent().attr('numberSystem').value(),
                    symbolId = numberSymbolNode.name();
                localeData.numberSymbols[numberSystemId] = localeData.numberSymbols[numberSystemId] || {};
                localeData.numberSymbols[numberSystemId][symbolId] = localeData.numberSymbols[numberSystemId][symbolId] || numberSymbolNode.text();
            });

            localeData.calendars = {};
            ['eraNames', 'eraAbbr'].forEach(function (eraType) {
                var typeInOutput = {eraNames: 'wide', eraAbbr: 'abbreviated'}[eraType];
                document.find("/ldml/dates/calendars/calendar/eras/" + eraType + "/era").forEach(function (eraNode) {
                    var calendarId = eraNode.parent().parent().parent().attr('type').value(),
                        type = parseInt(eraNode.attr('type').value(), 10);
                    localeData.calendars[calendarId] = localeData.calendars[calendarId] || {};
                    localeData.calendars[calendarId].eraNames = localeData.calendars[calendarId].eraNames || {};
                    localeData.calendars[calendarId].eraNames[typeInOutput] = localeData.calendars[calendarId].eraNames[typeInOutput] || {};
                    localeData.calendars[calendarId].eraNames[typeInOutput][type] = localeData.calendars[calendarId].eraNames[typeInOutput][type] || eraNode.text();
                });
            });

            document.find("/ldml/dates/calendars/calendar/quarters/quarterContext/quarterWidth/quarter").forEach(function (quarterNode) {
                // Avoid dashes in width and context (so that dot notation can be used in JavaScript)
                var calendarId = quarterNode.parent().parent().parent().parent().attr('type').value(),
                    context = quarterNode.parent().parent().attr('type').value().replace(/-/g, ''),
                    width = quarterNode.parent().attr('type').value().replace(/-/g, ''),
                    quarterNo = parseInt(quarterNode.attr('type').value(), 10) - 1;
                localeData.calendars[calendarId] = localeData.calendars[calendarId] || {};
                localeData.calendars[calendarId].quarterNames = localeData.calendars[calendarId].quarterNames || {};
                localeData.calendars[calendarId].quarterNames[context] = localeData.calendars[calendarId].quarterNames[context] || {};
                localeData.calendars[calendarId].quarterNames[context][width] = localeData.calendars[calendarId].quarterNames[context][width] || [];
                localeData.calendars[calendarId].quarterNames[context][width][quarterNo] = localeData.calendars[calendarId].quarterNames[context][width][quarterNo] || quarterNode.text();
            });

            document.find("/ldml/dates/calendars/calendar/months/monthContext/monthWidth/month").forEach(function (monthNode) {
                // Avoid dashes in width and context (so that dot notation can be used in JavaScript)
                var calendarId = monthNode.parent().parent().parent().parent().attr('type').value(),
                    context = monthNode.parent().parent().attr('type').value().replace(/-/g, ''),
                    width = monthNode.parent().attr('type').value().replace(/-/g, '');
                localeData.calendars[calendarId] = localeData.calendars[calendarId] || {};
                localeData.calendars[calendarId].monthNames = localeData.calendars[calendarId].monthNames || {};
                localeData.calendars[calendarId].monthNames[context] = localeData.calendars[calendarId].monthNames[context] || {};
                localeData.calendars[calendarId].monthNames[context][width] = localeData.calendars[calendarId].monthNames[context][width] || {};
                var monthNo = parseInt(monthNode.attr('type').value(), 10) - 1;
                localeData.calendars[calendarId].monthNames[context][width][monthNo] = localeData.calendars[calendarId].monthNames[context][width][monthNo] || monthNode.text();
            });

            var dayNoByCldrId = {sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6};
            document.find("/ldml/dates/calendars/calendar/days/dayContext/dayWidth/day").forEach(function (dayNode) {
                var calendarId = dayNode.parent().parent().parent().parent().attr('type').value(),
                    width = dayNode.parent().attr('type').value().replace(/-/g, ''),
                    context = dayNode.parent().parent().attr('type').value().replace(/-/g, ''),
                    dayNo = dayNoByCldrId[dayNode.attr('type').value()];
                localeData.calendars[calendarId] = localeData.calendars[calendarId] || {};
                localeData.calendars[calendarId].dayNames = localeData.calendars[calendarId].dayNames || {};
                localeData.calendars[calendarId].dayNames[context] = localeData.calendars[calendarId].dayNames[context] || {};
                localeData.calendars[calendarId].dayNames[context][width] = localeData.calendars[calendarId].dayNames[context][width] || {};
                localeData.calendars[calendarId].dayNames[context][width][dayNo] = localeData.calendars[calendarId].dayNames[context][width][dayNo] || dayNode.text();
            });

            document.find("/ldml/dates/calendars/calendar/fields/field/displayName").forEach(function (fieldDisplayNameNode) {
                var calendarId = fieldDisplayNameNode.parent().parent().parent().attr('type').value(),
                    fieldName = fieldDisplayNameNode.parent().attr('type').value();
                localeData.calendars[calendarId] = localeData.calendars[calendarId] || {};
                localeData.calendars[calendarId].fields = localeData.calendars[calendarId].fields || {};
                localeData.calendars[calendarId].fields[fieldName] = localeData.calendars[calendarId].fields[fieldName] || {};
                localeData.calendars[calendarId].fields[fieldName].displayName = localeData.calendars[calendarId].fields[fieldName].displayName || fieldDisplayNameNode.text();
            });

            document.find("/ldml/dates/calendars/calendar/fields/field/relative").forEach(function (fieldRelativeNode) {
                var calendarId = fieldRelativeNode.parent().parent().parent().attr('type').value(),
                    fieldName = fieldRelativeNode.parent().attr('type').value(),
                    type = fieldRelativeNode.attr('type').value();
                localeData.calendars[calendarId] = localeData.calendars[calendarId] || {};
                localeData.calendars[calendarId].fields = localeData.calendars[calendarId].fields || {};
                localeData.calendars[calendarId].fields[fieldName] = localeData.calendars[calendarId].fields[fieldName] || {};
                localeData.calendars[calendarId].fields[fieldName].relative = localeData.calendars[calendarId].fields[fieldName].relative || {};
                localeData.calendars[calendarId].fields[fieldName].relative[type] = localeData.calendars[calendarId].fields[fieldName].relative[type] || fieldRelativeNode.text();

            });

            ['date', 'time'].forEach(function (dateOrTime) {
                var dateOrTimeCapitalized = dateOrTime.replace(/^(\w)/, function (ch) {return ch.toUpperCase();});

                document.find("/ldml/dates/calendars/calendar/" + dateOrTime + "Formats/" + dateOrTime + "FormatLength/" + dateOrTime + "Format/pattern").forEach(function (patternNode) {
                    var calendarId = patternNode.parent().parent().parent().parent().attr('type').value(),
                        type = patternNode.parent().parent().attr('type').value();

                    localeData.calendars[calendarId] = localeData.calendars[calendarId] || {};
                    localeData.calendars[calendarId].dateFormats = localeData.calendars[calendarId].dateFormats || {};
                    localeData.calendars[calendarId].dateFormats.basic = localeData.calendars[calendarId].dateFormats.basic || {};
                    localeData.calendars[calendarId].dateFormats.basic[type + dateOrTimeCapitalized] = localeData.calendars[calendarId].dateFormats.basic[type + dateOrTimeCapitalized] || patternNode.text();
                });
            });

            document.find("/ldml/dates/calendars/calendar/dateTimeFormats/dateTimeFormatLength").forEach(function (dateTimeFormatLengthNode) {
                var calendarId = dateTimeFormatLengthNode.parent().parent().attr('type').value(),
                    dateTimeFormatLengthTypeAttribute = dateTimeFormatLengthNode.attr('type');

                if (!dateTimeFormatLengthTypeAttribute) {
                    // alias
                    return;
                }

                var dateTimeFormatLengthType = dateTimeFormatLengthTypeAttribute.value(),
                    patternNodes = dateTimeFormatLengthNode.find("dateTimeFormat/pattern");
                if (patternNodes.length !== 1) {
                    throw new Error('Expected exactly one dateTimeFormat/pattern in dateTimeFormatLengthNode');
                }
                localeData.calendars[calendarId] = localeData.calendars[calendarId] || {};
                localeData.calendars[calendarId].dateTimePatterns = localeData.calendars[calendarId].dateTimePatterns || {};
                localeData.calendars[calendarId].dateTimePatterns[dateTimeFormatLengthType] = localeData.calendars[calendarId].dateTimePatterns[dateTimeFormatLengthType] || patternNodes[0].text();
            });

            document.find("/ldml/dates/calendars/calendar/dateTimeFormats/default").forEach(function (dateTimeDefaultLengthNode) {
                var calendarId = dateTimeDefaultLengthNode.parent().parent().attr('type').value();
                localeData.calendars[calendarId] = localeData.calendars[calendarId] || {};
                localeData.calendars[calendarId].defaultDateTimePatternName = dateTimeDefaultLengthNode.attr('choice').value();
            });

            document.find("/ldml/dates/calendars/calendar/dateTimeFormats/availableFormats/dateFormatItem").forEach(function (dateFormatItemNode) {
                var calendarId = dateFormatItemNode.parent().parent().parent().attr('type').value(),
                    id = dateFormatItemNode.attr('id').value();
                localeData.calendars[calendarId] = localeData.calendars[calendarId] || {};
                localeData.calendars[calendarId].dateFormats = localeData.calendars[calendarId].dateFormats || {};
                localeData.calendars[calendarId].dateFormats.cldr = localeData.calendars[calendarId].dateFormats.cldr || {};
                localeData.calendars[calendarId].dateFormats.cldr[id] = localeData.calendars[calendarId].dateFormats.cldr[id] || dateFormatItemNode.text();
            });

            document.find("/ldml/dates/calendars/calendar/dateTimeFormats/intervalFormats/intervalFormatFallback").forEach(function (intervalFormatFallbackNode) {
                var calendarId = intervalFormatFallbackNode.parent().parent().parent().attr('type').value();
                localeData.calendars[calendarId] = localeData.calendars[calendarId] || {};
                localeData.calendars[calendarId].dateIntervalFallbackFormat = localeData.calendars[calendarId].dateIntervalFallbackFormat || intervalFormatFallbackNode.text();
            });

            document.find("/ldml/dates/calendars/calendar/dateTimeFormats/intervalFormats/intervalFormatItem").forEach(function (intervalFormatItemNode) {
                var calendarId = intervalFormatItemNode.parent().parent().parent().attr('type').value();
                localeData.calendars[calendarId] = localeData.calendars[calendarId] || {};
                localeData.calendars[calendarId].dateIntervalFormats = localeData.calendars[calendarId].dateIntervalFormats || {};
                var dateIntervalFormat = {};
                intervalFormatItemNode.childNodes().forEach(function (greatestDifferenceNode) {
                    var idAttribute = greatestDifferenceNode.attr('id');
                    if (!idAttribute) {
                        // Skip whitespace nodes
                        return;
                    }
                    var id = idAttribute.value();
                    dateIntervalFormat[id] = dateIntervalFormat[id] || greatestDifferenceNode.text();
                });
                var id = intervalFormatItemNode.attr('id').value();
                localeData.calendars[calendarId].dateIntervalFormats[id] = dateIntervalFormat;
            });

            // Extract unit patterns:

            localeData.unitPatterns = {};
            document.find("/ldml/units/unit/unitPattern").forEach(function (unitPatternNode) {
                var unitId = unitPatternNode.parent().attr('type').value().replace(/-([a-z])/g, function ($0, ch) { // year-future => yearFuture etc.
                    return ch.toUpperCase();
                });
                localeData.unitPatterns[unitId] = localeData.unitPatterns[unitId] || {};
                var count = unitPatternNode.attr('count').value();
                localeData.unitPatterns[unitId][count] = localeData.unitPatterns[unitId][count] || unitPatternNode.text();
            });

            localeData.delimiters = {};
            document.find("/ldml/delimiters/*").forEach(function (delimiterNode) {
                var type = delimiterNode.name();
                localeData.delimiters[type] = localeData.delimiters[type] || delimiterNode.text();
            });

            document.find("/ldml/listPatterns/listPattern/listPatternPart").forEach(function (listPatternPartNode) {
                localeData.listPatterns = localeData.listPatterns || {};
                var type = listPatternPartNode.attr('type').value();
                localeData.listPatterns[type] = localeData.listPatterns[type] || listPatternPartNode.text();
            });

            localeData.exemplarCharacters = {};

            document.find("/ldml/characters/exemplarCharacters").forEach(function (exemplarCharactersNode) {
                var typeAttr = exemplarCharactersNode.attr('type'),
                    type = (typeAttr && typeAttr.value()) || 'default';
                localeData.exemplarCharacters[type] = localeData.exemplarCharacters[type] || exemplarCharactersNode.text().replace(/^\[|\]$/g, '').split(" ");
            });

            localeData.timeZoneDisplayNames = {};

            document.find("/ldml/dates/timeZoneNames/zone").forEach(function (zoneNode) {
                var timeZoneId = zoneNode.attr('type').value(),
                    exemplarCityNodes = zoneNode.find("exemplarCity"),
                    tzNameLocale;
                if (exemplarCityNodes.length > 0) {
                    tzNameLocale = exemplarCityNodes[0].text();
                } else {
                    var genericDisplayNameNodes = zoneNode.find("long/generic");
                    if (genericDisplayNameNodes.length > 0) {
                        tzNameLocale = genericDisplayNameNodes[0].text();
                    } else {
                        var longDisplayNameNodes = zoneNode.find("long/standard");
                        if (longDisplayNameNodes.length > 0) {
                            tzNameLocale = longDisplayNameNodes[0].text();
                        }
                    }
                }
                if (tzNameLocale) {
                    localeData.timeZoneDisplayNames[timeZoneId] = localeData.timeZoneDisplayNames[timeZoneId] || tzNameLocale;
                }
            });

            localeData.territoryDisplayNames = {};

            document.find("/ldml/localeDisplayNames/territories/territory").forEach(function (territoryNode) {
                var territoryId = territoryNode.attr('type').value();
                localeData.territoryDisplayNames[territoryId] = localeData.territoryDisplayNames[territoryId] || territoryNode.text();
            });

            localeData.currencyDisplayNames = {};
            localeData.currencyDisplayNamesCount = {};
            document.find("/ldml/numbers/currencies/currency/displayName").forEach(function (currencyDisplayNameNode) {
                var currencyId = currencyDisplayNameNode.parent().attr('type').value(),
                    countAttribute = currencyDisplayNameNode.attr('count');
                if (countAttribute) {
                    localeData.currencyDisplayNamesCount[currencyId] = localeData.currencyDisplayNamesCount[currencyId] || {};
                    localeData.currencyDisplayNamesCount[currencyId][countAttribute.value()] = currencyDisplayNameNode.text();
                } else {
                    localeData.currencyDisplayNames[currencyId] = localeData.currencyDisplayNames[currencyId] || currencyDisplayNameNode.text();
                }
            });

            localeData.scriptDisplayNames = {};
            document.find("/ldml/localeDisplayNames/scripts/script").forEach(function (scriptNode) {
                var scriptId = scriptNode.attr('type').value();
                localeData.scriptDisplayNames[scriptId] = localeData.scriptDisplayNames[scriptId] || scriptNode.text();
            });

            cb(null, localeData);
        }));
    },

    generateGetQuantityMethodAstByLocaleId: function (localeIds, cb) {
        var that = this;
        this.getDocument(Path.resolve(that.cldrPath, 'common', 'supplemental', 'plurals.xml'), passError(cb, function (document) {
            var getQuantityMethodAstByLocaleId = {};
            localeIds.forEach(function (localeId) {
                var matchLocalesXPathExpr =
                    "@locales = '" + localeId + "' or " +
                    "starts-with(@locales, '" + localeId + "') or " +
                    "contains(@locales, ' " + localeId + " ') or " +
                    "(contains(@locales, ' " + localeId + "') and substring-after(@locales, ' " + localeId + "') = '')";

                var statementAsts = [],
                    pluralRulesNodes = document.find("/supplementalData/plurals/pluralRules[" + matchLocalesXPathExpr + "]");
                if (pluralRulesNodes.length > 0) {
                    pluralRulesNodes[0].find("pluralRule").forEach(function (pluralRuleNode) {
                        statementAsts.push(
                            [
                                'if',
                                cldrPluralRuleToJavaScriptAst(pluralRuleNode.text()),
                                ['return', ['string', pluralRuleNode.attr('count').value()]]
                            ]
                        );
                    });
                    statementAsts.push(['return', ['string', 'other']]);
                    var functionAst = ['function', null, ['n'], statementAsts];
                    getQuantityMethodAstByLocaleId[localeId] = new Function("n", uglifyJs.uglify.gen_code(['toplevel', statementAsts]));
                }
            });
            return getQuantityMethodAstByLocaleId;
        }));
    }
};

module.exports = Cldr;
