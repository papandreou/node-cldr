var Path = require('path'),
    fs = require('fs'),
    passError = require('passerror'),
    libxmljs = require('libxmljs'),
    seq = require('seq'),
    normalizeLocaleId = require('./normalizeLocaleId'),
    cldrPluralRuleToJavaScriptAst = require('./cldrPluralRuleToJavaScriptAst'),
    uglifyJs = require('uglify-js');

function normalizeXPathQuery(xpathQuery) {
    var xpathQueryFragments = xpathQuery.split('/');
    for (var i = 0 ; i < xpathQueryFragments.length ; i += 1) {
        if (i > 0 && xpathQueryFragments[i] === '..' && xpathQueryFragments[i - 1] !== '..') {
            xpathQueryFragments.splice(i - 1, 2);
            i -= 2;
        }
    }
    return xpathQueryFragments.join('/');
}

function expandLocaleIdToPrioritizedList(localeId) {
    if (!localeId) {
        return [];
    }
    var localeIds = [localeId];
    while (/_[^_]+$/.test(localeId)) {
        localeId = localeId.replace(/_[^_]+$/, '');
        localeIds.push(localeId);
    }
    return localeIds;
}

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

    this.allLocaleIds = Object.keys(this.cldrCommonMainXmlFileNameByNormalizedLocaleId);
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
        var that = this;
        seq(expandLocaleIdToPrioritizedList(localeId).concat('root'))
            .parMap(function (subLocaleId) {
                that.getCommonMainDocument(subLocaleId, this);
            })
            .unflatten()
            .seq(function (prioritizedDocuments) {
                function find(xpathQuery) {
                    var prioritizedResults = [];
                    prioritizedDocuments.forEach(function (document, i) {
                        var resultsForLocaleDocument = document.find(xpathQuery);
                        if (resultsForLocaleDocument.length === 0 && i === (prioritizedDocuments.length - 1)) { // root
                            var queryFragments = xpathQuery.split('/'),
                                poppedQueryFragments = [];
                            while (queryFragments.length > 1) {
                                poppedQueryFragments.unshift(queryFragments.pop());
                                var aliasNodes = document.find(queryFragments.join('/') + '/alias');
                                if (aliasNodes.length > 0) {
                                    var aliasSpecifiedQuery = normalizeXPathQuery(aliasNodes[0].path() + '/../' + aliasNodes[0].attr('path').value() + '/' + poppedQueryFragments.join('/'));
                                    Array.prototype.push.apply(prioritizedResults, find(aliasSpecifiedQuery));
                                    break;
                                }
                            }
                        } else {
                            Array.prototype.push.apply(prioritizedResults, resultsForLocaleDocument);
                        }
                    });
                    return prioritizedResults;
                }

                var localeData = {};
                localeData.localeDisplayNames = {};
                find('/ldml/localeDisplayNames/languages/language').forEach(function (node) {
                    var localeId = normalizeLocaleId(node.attr('type').value());
                    localeData.localeDisplayNames[localeId] = localeData.localeDisplayNames[localeId] || node.text();
                });

                localeData.numberSymbols = {};
                find("/ldml/numbers/symbols/*[name() != 'alias']").forEach(function (numberSymbolNode) {
                    var numberSystemId = numberSymbolNode.parent().attr('numberSystem').value(),
                        symbolId = numberSymbolNode.name();
                    localeData.numberSymbols[numberSystemId] = localeData.numberSymbols[numberSystemId] || {};
                    localeData.numberSymbols[numberSystemId][symbolId] = localeData.numberSymbols[numberSystemId][symbolId] || numberSymbolNode.text();
                });

                localeData.calendars = {};
                ['buddhist', 'gregorian', 'islamic', 'japanese', 'roc'].forEach(function (calendarId) {
                    var calendarData = localeData.calendars[calendarId] = {};

                    calendarData.eraNames = {};
                    ['eraNames', 'eraAbbr'].forEach(function (eraType) {
                        var typeInOutput = {eraNames: 'wide', eraAbbr: 'abbreviated'}[eraType];
                        find("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/eras/" + eraType + "/era").forEach(function (eraNode) {
                            var type = parseInt(eraNode.attr('type').value(), 10);
                            calendarData.eraNames[typeInOutput] = calendarData.eraNames[typeInOutput] || {};
                            calendarData.eraNames[typeInOutput][type] = calendarData.eraNames[typeInOutput][type] || eraNode.text();
                        });
                    });

                    calendarData.quarterNames = {};
                    find("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/quarters/quarterContext/quarterWidth/quarter").forEach(function (quarterNode) {
                        // Avoid dashes in width and context (so that dot notation can be used in JavaScript)
                        var context = quarterNode.parent().parent().attr('type').value().replace(/-/g, ''),
                            width = quarterNode.parent().attr('type').value().replace(/-/g, ''),
                            quarterNo = parseInt(quarterNode.attr('type').value(), 10) - 1;
                        calendarData.quarterNames[context] = calendarData.quarterNames[context] || {};
                        calendarData.quarterNames[context][width] = calendarData.quarterNames[context][width] || {};
                        calendarData.quarterNames[context][width][quarterNo] = calendarData.quarterNames[context][width][quarterNo] || quarterNode.text();
                    });

                    find("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/months/monthContext/monthWidth/month").forEach(function (monthNode) {
                        // Avoid dashes in width and context (so that dot notation can be used in JavaScript)
                        var context = monthNode.parent().parent().attr('type').value().replace(/-/g, ''),
                            width = monthNode.parent().attr('type').value().replace(/-/g, '');
                        calendarData.monthNames = calendarData.monthNames || {};
                        calendarData.monthNames[context] = calendarData.monthNames[context] || {};
                        calendarData.monthNames[context][width] = calendarData.monthNames[context][width] || {};
                        var monthNo = parseInt(monthNode.attr('type').value(), 10) - 1;
                        calendarData.monthNames[context][width][monthNo] = calendarData.monthNames[context][width][monthNo] || monthNode.text();
                    });

                    var dayNoByCldrId = {sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6};
                    find("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/days/dayContext/dayWidth/day").forEach(function (dayNode) {
                        var width = dayNode.parent().attr('type').value().replace(/-/g, ''),
                            context = dayNode.parent().parent().attr('type').value().replace(/-/g, ''),
                            dayNo = dayNoByCldrId[dayNode.attr('type').value()];
                        calendarData.dayNames = calendarData.dayNames || {};
                        calendarData.dayNames[context] = calendarData.dayNames[context] || {};
                        calendarData.dayNames[context][width] = calendarData.dayNames[context][width] || {};
                        calendarData.dayNames[context][width][dayNo] = calendarData.dayNames[context][width][dayNo] || dayNode.text();
                    });

                    // Alias not observed in root.xml:
                    find("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/fields/field/displayName").forEach(function (fieldDisplayNameNode) {
                        var fieldName = fieldDisplayNameNode.parent().attr('type').value();
                        calendarData.fields = calendarData.fields || {};
                        calendarData.fields[fieldName] = calendarData.fields[fieldName] || {};
                        calendarData.fields[fieldName].displayName = calendarData.fields[fieldName].displayName || fieldDisplayNameNode.text();
                    });

                    // Alias not observed in root.xml:
                    find("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/fields/field/relative").forEach(function (fieldRelativeNode) {
                        var fieldName = fieldRelativeNode.parent().attr('type').value(),
                            type = fieldRelativeNode.attr('type').value();
                        calendarData.fields = calendarData.fields || {};
                        calendarData.fields[fieldName] = calendarData.fields[fieldName] || {};
                        calendarData.fields[fieldName].relative = calendarData.fields[fieldName].relative || {};
                        calendarData.fields[fieldName].relative[type] = calendarData.fields[fieldName].relative[type] || fieldRelativeNode.text();

                    });

                    ['date', 'time'].forEach(function (dateOrTime) {
                        var dateOrTimeCapitalized = dateOrTime.replace(/^(\w)/, function (ch) {return ch.toUpperCase();});

                        find("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/" + dateOrTime + "Formats/" + dateOrTime + "FormatLength/" + dateOrTime + "Format/*").forEach(function (patternNode) {
                            var type = patternNode.parent().parent().attr('type').value();

                            calendarData.dateFormats = calendarData.dateFormats || {};
                            calendarData.dateFormats.basic = calendarData.dateFormats.basic || {};
                            calendarData.dateFormats.basic[type + dateOrTimeCapitalized] = calendarData.dateFormats.basic[type + dateOrTimeCapitalized] || patternNode.text();
                        });
                    });

                    find("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/dateTimeFormats/dateTimeFormatLength").forEach(function (dateTimeFormatLengthNode) {
                        var dateTimeFormatLengthTypeAttribute = dateTimeFormatLengthNode.attr('type');
                        // FIXME and query aliases!
                        if (!dateTimeFormatLengthTypeAttribute){
                            return;
                        }

                        var dateTimeFormatLengthType = dateTimeFormatLengthTypeAttribute.value(),
                            patternNodes = dateTimeFormatLengthNode.find("dateTimeFormat/pattern");
                        if (patternNodes.length !== 1) {
                            throw new Error('Expected exactly one dateTimeFormat/pattern in dateTimeFormatLengthNode');
                        }
                        calendarData.dateTimePatterns = calendarData.dateTimePatterns || {};
                        calendarData.dateTimePatterns[dateTimeFormatLengthType] = calendarData.dateTimePatterns[dateTimeFormatLengthType] || patternNodes[0].text();
                    });

                    find("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/dateTimeFormats/default").forEach(function (dateTimeDefaultLengthNode) {
                        calendarData.defaultDateTimePatternName = dateTimeDefaultLengthNode.attr('choice').value();
                    });

                    find("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/dateTimeFormats/availableFormats/dateFormatItem").forEach(function (dateFormatItemNode) {
                        var id = dateFormatItemNode.attr('id').value();
                        calendarData.dateFormats = calendarData.dateFormats || {};
                        calendarData.dateFormats.cldr = calendarData.dateFormats.cldr || {};
                        calendarData.dateFormats.cldr[id] = calendarData.dateFormats.cldr[id] || dateFormatItemNode.text();
                    });

                    find("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/dateTimeFormats/intervalFormats/intervalFormatFallback").forEach(function (intervalFormatFallbackNode) {
                        calendarData.dateIntervalFallbackFormat = calendarData.dateIntervalFallbackFormat || intervalFormatFallbackNode.text();
                    });

                    find("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/dateTimeFormats/intervalFormats/intervalFormatItem").forEach(function (intervalFormatItemNode) {
                        calendarData.dateIntervalFormats = calendarData.dateIntervalFormats || {};
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
                        calendarData.dateIntervalFormats[id] = dateIntervalFormat;
                    });
                });
                // Extract unit patterns:

                localeData.unitPatterns = {};
                // No aliases observed in root.xml:
                find("/ldml/units/unit/unitPattern").forEach(function (unitPatternNode) {
                    var unitId = unitPatternNode.parent().attr('type').value().replace(/-([a-z])/g, function ($0, ch) { // year-future => yearFuture etc.
                        return ch.toUpperCase();
                    });
                    localeData.unitPatterns[unitId] = localeData.unitPatterns[unitId] || {};
                    var count = unitPatternNode.attr('count').value();
                    localeData.unitPatterns[unitId][count] = localeData.unitPatterns[unitId][count] || unitPatternNode.text();
                });

                localeData.delimiters = {};
                find("/ldml/delimiters/*").forEach(function (delimiterNode) {
                    var type = delimiterNode.name();
                    localeData.delimiters[type] = localeData.delimiters[type] || delimiterNode.text();
                });

                find("/ldml/listPatterns/listPattern/listPatternPart").forEach(function (listPatternPartNode) {
                    localeData.listPatterns = localeData.listPatterns || {};
                    var type = listPatternPartNode.attr('type').value();
                    localeData.listPatterns[type] = localeData.listPatterns[type] || listPatternPartNode.text();
                });

                localeData.exemplarCharacters = {};

                find("/ldml/characters/exemplarCharacters").forEach(function (exemplarCharactersNode) {
                    var typeAttr = exemplarCharactersNode.attr('type'),
                        type = (typeAttr && typeAttr.value()) || 'default';
                    localeData.exemplarCharacters[type] = localeData.exemplarCharacters[type] || exemplarCharactersNode.text().replace(/^\[|\]$/g, '').split(" ");
                });

                localeData.timeZoneDisplayNames = {};
                find("/ldml/dates/timeZoneNames/zone").forEach(function (zoneNode) {
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
                find("/ldml/localeDisplayNames/territories/territory").forEach(function (territoryNode) {
                    var territoryId = territoryNode.attr('type').value();
                    localeData.territoryDisplayNames[territoryId] = localeData.territoryDisplayNames[territoryId] || territoryNode.text();
                });

                localeData.currencyDisplayNames = {};
                localeData.currencyDisplayNamesCount = {};
                find("/ldml/numbers/currencies/currency/displayName").forEach(function (currencyDisplayNameNode) {
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
                find("/ldml/localeDisplayNames/scripts/script").forEach(function (scriptNode) {
                    var scriptId = scriptNode.attr('type').value();
                    localeData.scriptDisplayNames[scriptId] = localeData.scriptDisplayNames[scriptId] || scriptNode.text();
                });

                cb(null, localeData);
            })
            .catch(cb);
    },

    generateGetQuantityFunction: function (localeId, cb) {
        var that = this;
        this.getDocument(Path.resolve(that.cldrPath, 'common', 'supplemental', 'plurals.xml'), passError(cb, function (document) {
            var subLocaleIds = expandLocaleIdToPrioritizedList(localeId),
                statementAsts = [];
            for (var i = 0 ; i < subLocaleIds.length ; i += 1) {
                var subLocaleId = subLocaleIds[i],
                    matchLocalesXPathExpr =
                        "@locales = '" + subLocaleId + "' or " +
                        "starts-with(@locales, '" + subLocaleId + "') or " +
                        "contains(@locales, ' " + subLocaleId + " ') or " +
                        "(contains(@locales, ' " + subLocaleId + "') and substring-after(@locales, ' " + subLocaleId + "') = '')",
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
                    break;
                }
            }
            return cb(null, new Function("n", uglifyJs.uglify.gen_code(['toplevel', statementAsts])));
        }));
    }
};

module.exports = Cldr;
