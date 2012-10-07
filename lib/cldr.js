var libxmljs = require('libxmljs'),
    normalizeLocaleId = require('./normalizeLocaleId'),
    cldrPluralRuleToJavaScriptAst = require('./cldrPluralRuleToJavaScriptAst'),
    uglifyJs = require('uglify-js'),
    cldr = module.exports = {};

cldr.extractLocaleDataFromXmlString = function (xmlString, cb) {
    var localeData = {};
        document = libxmljs.parseXmlString(xmlString);

    localeData.localeDisplayNames = {};
    document.find('//languages/language').forEach(function (node) {
        var localeId = normalizeLocaleId(node.attr('type').value());
        localeData.localeDisplayNames[localeId] = localeData.localeDisplayNames[localeId] || node.text();
    });

    localeData.relativeDayDisplay = {};
    document.find("/ldml/dates/calendars/calendar[@type='gregorian']/fields/field[@type = 'day']/relative").forEach(function (relativeNode) {
        var type = relativeNode.attr('type').value();
        localeData.relativeDayDisplay[type] = localeData.relativeDayDisplay[type] || relativeNode.text();
    });

    localeData.numberSymbols = {};
    ['decimal', 'group', 'percentSign'].forEach(function (numberSymbolName) {
        document.find("/ldml/numbers/symbols/" + numberSymbolName).forEach(function (numberSymbolNode) {
            localeData.numberSymbols[numberSymbolName] = localeData.numberSymbols[numberSymbolName] || numberSymbolNode.text();
        });
    });

    localeData.eraNames = {};
    ['eraNames', 'eraAbbr'].forEach(function (eraType) {
        var typeInOutput = {eraNames: 'wide', eraAbbr: 'abbreviated'}[eraType];
        localeData.eraNames[typeInOutput] = [];
        document.find("/ldml/dates/calendars/calendar[@type='gregorian']/eras/" + eraType + "/era").forEach(function (eraNode) {
            var type = parseInt(eraNode.attr('type').value(), 10);
            localeData.eraNames[typeInOutput][type] = localeData.eraNames[typeInOutput][type] || eraNode.text();
        });
    });

    localeData.quarterNames = {};
    document.find("/ldml/dates/calendars/calendar[@type='gregorian']/quarters/quarterContext/quarterWidth/quarter").forEach(function (quarterNode) {
        // Avoid dashes in width and context (so that dot notation can be used in JavaScript)
        var context = quarterNode.parent().parent().attr('type').value().replace(/-/g, ''),
            width = quarterNode.parent().attr('type').value().replace(/-/g, ''),
            quarterNo = parseInt(quarterNode.attr('type').value(), 10) - 1;
        localeData.quarterNames[context] = localeData.quarterNames[context] || {};
        localeData.quarterNames[context][width] = localeData.quarterNames[context][width] || [];
        localeData.quarterNames[context][width][quarterNo] = localeData.quarterNames[context][width][quarterNo] || quarterNode.text();
    });

    localeData.monthNames = {};
    document.find("/ldml/dates/calendars/calendar[@type='gregorian']/months/monthContext/monthWidth/month").forEach(function (monthNode) {
        // Avoid dashes in width and context (so that dot notation can be used in JavaScript)
        var context = monthNode.parent().parent().attr('type').value().replace(/-/g, ''),
            width = monthNode.parent().attr('type').value().replace(/-/g, '');
        localeData.monthNames[context] = localeData.monthNames[context] || {};
        localeData.monthNames[context][width] = localeData.monthNames[context][width] || {};
        var monthNo = parseInt(monthNode.attr('type').value(), 10) - 1;
        localeData.monthNames[context][width][monthNo] = localeData.monthNames[context][width][monthNo] || monthNode.text();
    });

    localeData.dayNames = {};
    var dayNoByCldrId = {sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6};
    document.find("/ldml/dates/calendars/calendar[@type='gregorian']/days/dayContext/dayWidth/day").forEach(function (dayNode) {
        var width = dayNode.parent().attr('type').value().replace(/-/g, ''),
            context = dayNode.parent().parent().attr('type').value().replace(/-/g, ''),
            dayNo = dayNoByCldrId[dayNode.attr('type').value()];
        localeData.dayNames[context] = localeData.dayNames[context] || {};
        localeData.dayNames[context][width] = localeData.dayNames[context][width] || {};
        localeData.dayNames[context][width][dayNo] = localeData.dayNames[context][width][dayNo] || dayNode.text();
    });

    localeData.fieldDisplayNames = {};
    document.find("/ldml/dates/calendars/calendar[@type='gregorian']/fields/field/displayName").forEach(function (fieldDisplayNameNode) {
        var fieldName = fieldDisplayNameNode.parent().attr('type').value();
        localeData.fieldDisplayNames[fieldName] = localeData.fieldDisplayNames[fieldName] || fieldDisplayNameNode.text();
    });

    ['date', 'time'].forEach(function (dateOrTime) {
        var dateOrTimeCapitalized = dateOrTime.replace(/^(\w)/, function (ch) {return ch.toUpperCase();});

        localeData.dateFormats = localeData.dateFormats || {};
        localeData.dateFormats.basic = localeData.dateFormats.basic || {};
        document.find("/ldml/dates/calendars/calendar[@type='gregorian']/" + dateOrTime + "Formats/" + dateOrTime + "FormatLength/" + dateOrTime + "Format/pattern").forEach(function (formatNode) {
            var type = formatNode.parent().parent().attr('type').value();
            localeData.dateFormats.basic[type + dateOrTimeCapitalized] = localeData.dateFormats.basic[type + dateOrTimeCapitalized] || formatNode.text();
        });
    });

    localeData.dateTimePatterns = {};
    document.find("/ldml/dates/calendars/calendar[@type='gregorian']/dateTimeFormats/dateTimeFormatLength").forEach(function (dateTimeFormatLengthNode) {
        var dateTimeFormatType = dateTimeFormatLengthNode.attr('type').value(),
            patternNodes = dateTimeFormatLengthNode.find("dateTimeFormat/pattern");
        if (patternNodes.length !== 1) {
            throw new Error('Expected exactly one dateTimeFormat/pattern in $date_time_format_length_node');
        }
        localeData.dateTimePatterns[dateTimeFormatType] = localeData.dateTimePatterns[dateTimeFormatType] || patternNodes[0].text();
    });

    var dateTimeDefaultLengthNode = document.get("/ldml/dates/calendars/calendar[@type='gregorian']/dateTimeFormats/default");
    if (dateTimeDefaultLengthNode) {
        localeData.defaultDateTimePatternName = dateTimeDefaultLengthNode.attr('choice').value();
    }

    document.find("/ldml/dates/calendars/calendar[@type='gregorian']/dateTimeFormats/availableFormats/dateFormatItem").forEach(function (dateTimeFormatNode) {
       localeData.dateFormats.cldr = localeData.dateFormats.cldr || {};
       var id = dateTimeFormatNode.attr('id').value();
       localeData.dateFormats.cldr[id] = localeData.dateFormats.cldr[id] || dateTimeFormatNode.text();
    });

    var intervalFormatFallbackNode = document.get("/ldml/dates/calendars/calendar[@type='gregorian']/dateTimeFormats/intervalFormats/intervalFormatFallback");
    if (intervalFormatFallbackNode) {
        localeData.dateIntervalFallbackFormat = intervalFormatFallbackNode.text();
    }

    document.find("/ldml/dates/calendars/calendar[@type='gregorian']/dateTimeFormats/intervalFormats/intervalFormatItem").forEach(function (intervalFormatNode) {
       localeData.dateIntervalFormats = localeData.dateIntervalFormats || {};
       var dateIntervalFormat = {};
       intervalFormatNode.childNodes().forEach(function (greatestDifferenceNode) {
           var idAttribute = greatestDifferenceNode.attr('id');
           if (!idAttribute) {
               // Skip whitespace nodes
               return;
           }
           var id = idAttribute.value();
           dateIntervalFormat[id] = dateIntervalFormat[id] || greatestDifferenceNode.text();
       });
       var id = intervalFormatNode.attr('id').value();
       localeData.dateIntervalFormats[id] = dateIntervalFormat;
    });

    // Extract unit patterns:

    ['day', 'hour', 'minute', 'month', 'week', 'year'].forEach(function (unit) {
        document.find("/ldml/units/unit[@type='" + unit + "']/unitPattern").forEach(function (unitPatternNode) {
            localeData.unitPatterns = localeData.unitPatterns || {};
            localeData.unitPatterns[unit] = localeData.unitPatterns[unit] || {};
            var count = unitPatternNode.attr('count').value();
            localeData.unitPatterns[unit][count] = localeData.unitPatterns[unit][count] || unitPatternNode.text();
        });
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

    return localeData;
};

cldr.generateGetQuantityMethodAstsFromXmlString = function (xmlString, localeIds) {
    var document = libxmljs.parseXmlString(xmlString),
        getQuantityMethodAstByLocaleId = {};
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
};
