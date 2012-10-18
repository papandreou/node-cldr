var Path = require('path'),
    fs = require('fs'),
    _ = require('underscore'),
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

    _extractLanguages: function (options, find) {
        var languageDisplayNames = {};
        find('/ldml/localeDisplayNames/languages/language').forEach(function (node) {
            var id = normalizeLocaleId(node.attr('type').value());
            languageDisplayNames[id] = languageDisplayNames[id] || node.text();
        });

        // FIXME: Reintroduce nativeDisplayName somewhere else
        return Object.keys(languageDisplayNames).map(function (id) {
            return {
                id: id,
                displayName: languageDisplayNames[id]
            };
        });
    },

    _extractTimeZones: function (options, find) {
        var timeZoneDisplayNames = {};
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
                timeZoneDisplayNames[timeZoneId] = timeZoneDisplayNames[timeZoneId] || tzNameLocale;
            }
        });

        return Object.keys(timeZoneDisplayNames).filter(function (timeZoneId) {
            return timeZoneId in options.utcStandardOffsetSecondsByTimeZoneId && timeZoneId in options.territoryIdByTimeZoneId;
        }).map(function (timeZoneId) {
            var utcStandardOffsetSeconds = options.utcStandardOffsetSecondsByTimeZoneId[timeZoneId],
                territoryId = options.territoryIdByTimeZoneId[timeZoneId];
            return {
                id: timeZoneId,
                regionId: options.numericRegionIdByTerritoryId[territoryId] || null,
                utcStandardOffsetSeconds: utcStandardOffsetSeconds,
                displayName: timeZoneDisplayNames[timeZoneId],
                countryId: territoryId
            };
        }).sort(function (a, b) {
            return ((typeof b.utcStandardOffsetSeconds === 'number') - (typeof a.utcStandardOffsetSeconds === 'number')) ||
                a.utcStandardOffsetSeconds - b.utcStandardOffsetSeconds ||
                (a.displayName < b.displayName ? -1 : (b.displayName < a.displayName ? 1 : 0));
        });
    },

    _extractTerritories: function (options, find) {
        var territoryDisplayNames = {};
        find("/ldml/localeDisplayNames/territories/territory").forEach(function (territoryNode) {
            var territoryId = territoryNode.attr('type').value();
            territoryDisplayNames[territoryId] = territoryDisplayNames[territoryId] || territoryNode.text();
        });

        return Object.keys(territoryDisplayNames).sort(function (a, b) {
            return territoryDisplayNames[a] < territoryDisplayNames[b] ? -1 :
                (territoryDisplayNames[a] > territoryDisplayNames[b] ? 1 : 0);
        }).map(function (territoryId) {
            return {
                id: territoryId,
                regionId: options.numericRegionIdByTerritoryId[territoryId] || null,
                displayName: territoryDisplayNames[territoryId],
                hasTimeZones: options.numTimeZonesByTerritoryId[territoryId] > 0
            };
        });
    },

    _extractCurrencies: function (options, find) {
        var currencyDisplayNames = {},
            currencyDisplayNamesCount = {};

        find("/ldml/numbers/currencies/currency/displayName").forEach(function (currencyDisplayNameNode) {
            var currencyId = currencyDisplayNameNode.parent().attr('type').value(),
                countAttribute = currencyDisplayNameNode.attr('count');
            if (countAttribute) {
                currencyDisplayNamesCount[currencyId] = currencyDisplayNamesCount[currencyId] || {};
                currencyDisplayNamesCount[currencyId][countAttribute.value()] = currencyDisplayNameNode.text();
            } else {
                currencyDisplayNames[currencyId] = currencyDisplayNames[currencyId] || currencyDisplayNameNode.text();
            }
        });

        return Object.keys(currencyDisplayNames).sort(function (a, b) {
            return currencyDisplayNames[a] < currencyDisplayNames[b] ? -1 :
                (currencyDisplayNames[a] > currencyDisplayNames[b] ? 1 : 0);
        }).map(function (currencyId) {
            return _.extend({
                id: currencyId,
                displayName: currencyDisplayNames[currencyId]
            }, currencyDisplayNamesCount[currencyId]);
        });
    },

    _extractScripts: function (options, find) {
        var scriptDisplayNames = {};
        find("/ldml/localeDisplayNames/scripts/script").forEach(function (scriptNode) {
            var id = scriptNode.attr('type').value();
            scriptDisplayNames[id] = scriptDisplayNames[id] || scriptNode.text();
        });

        return Object.keys(scriptDisplayNames).sort(function (a, b) {
            return scriptDisplayNames[a] < scriptDisplayNames[b] ? -1 :
                (scriptDisplayNames[a] > scriptDisplayNames[b] ? 1 : 0);
        }).map(function (id) {
            return {
                id: id,
                displayName: scriptDisplayNames[id]
            };
        });
    },

    _extractCalendar: function (options, find) {
        var calendarId = options.id,
            calendar = {};

        if (options.eraNames || options.dateFormats || options.dateIntervalFormats) {
            calendar.eraNames = {};
            ['eraNames', 'eraAbbr'].forEach(function (eraType) {
                var typeInOutput = {eraNames: 'wide', eraAbbr: 'abbreviated'}[eraType];
                find("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/eras/" + eraType + "/era").forEach(function (eraNode) {
                    var type = parseInt(eraNode.attr('type').value(), 10);
                    calendar.eraNames[typeInOutput] = calendar.eraNames[typeInOutput] || {};
                    calendar.eraNames[typeInOutput][type] = calendar.eraNames[typeInOutput][type] || eraNode.text();
                });
            });
        }

        if (options.quarterNames || options.dateFormats || options.dateIntervalFormats) {
            calendar.quarterNames = {};
            find("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/quarters/quarterContext/quarterWidth/quarter").forEach(function (quarterNode) {
                // Avoid dashes in width and context (so that dot notation can be used in JavaScript)
                var context = quarterNode.parent().parent().attr('type').value().replace(/-/g, ''),
                    width = quarterNode.parent().attr('type').value().replace(/-/g, ''),
                    quarterNo = parseInt(quarterNode.attr('type').value(), 10) - 1;
                calendar.quarterNames[context] = calendar.quarterNames[context] || {};
                calendar.quarterNames[context][width] = calendar.quarterNames[context][width] || {};
                calendar.quarterNames[context][width][quarterNo] = calendar.quarterNames[context][width][quarterNo] || quarterNode.text();
            });
        }

        if (options.monthNames || options.dateFormats || options.dateIntervalFormats) {
            find("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/months/monthContext/monthWidth/month").forEach(function (monthNode) {
                // Avoid dashes in width and context (so that dot notation can be used in JavaScript)
                var context = monthNode.parent().parent().attr('type').value().replace(/-/g, ''),
                    width = monthNode.parent().attr('type').value().replace(/-/g, '');
                calendar.monthNames = calendar.monthNames || {};
                calendar.monthNames[context] = calendar.monthNames[context] || {};
                calendar.monthNames[context][width] = calendar.monthNames[context][width] || {};
                var monthNo = parseInt(monthNode.attr('type').value(), 10) - 1;
                calendar.monthNames[context][width][monthNo] = calendar.monthNames[context][width][monthNo] || monthNode.text();
            });
        }

        if (options.dayNames || options.dateFormats || options.dateIntervalFormats) {
            var dayNoByCldrId = {sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6};
            find("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/days/dayContext/dayWidth/day").forEach(function (dayNode) {
                var width = dayNode.parent().attr('type').value().replace(/-/g, ''),
                    context = dayNode.parent().parent().attr('type').value().replace(/-/g, ''),
                    dayNo = dayNoByCldrId[dayNode.attr('type').value()];
                calendar.dayNames = calendar.dayNames || {};
                calendar.dayNames[context] = calendar.dayNames[context] || {};
                calendar.dayNames[context][width] = calendar.dayNames[context][width] || {};
                calendar.dayNames[context][width][dayNo] = calendar.dayNames[context][width][dayNo] || dayNode.text();
            });
        }

        if (options.fields) {
            find("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/fields/field/displayName").forEach(function (fieldDisplayNameNode) {
                var fieldName = fieldDisplayNameNode.parent().attr('type').value();
                calendar.fields = calendar.fields || {};
                calendar.fields[fieldName] = calendar.fields[fieldName] || {};
                calendar.fields[fieldName].displayName = calendar.fields[fieldName].displayName || fieldDisplayNameNode.text();
            });

            find("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/fields/field/relative").forEach(function (fieldRelativeNode) {
                var fieldName = fieldRelativeNode.parent().attr('type').value(),
                    type = fieldRelativeNode.attr('type').value();
                calendar.fields = calendar.fields || {};
                calendar.fields[fieldName] = calendar.fields[fieldName] || {};
                calendar.fields[fieldName].relative = calendar.fields[fieldName].relative || {};
                calendar.fields[fieldName].relative[type] = calendar.fields[fieldName].relative[type] || fieldRelativeNode.text();

            });
        }

        if (options.dateFormats || options.dateIntervalFormats) {
            ['date', 'time'].forEach(function (dateOrTime) {
                var dateOrTimeCapitalized = dateOrTime.replace(/^(\w)/, function (ch) {return ch.toUpperCase();});

                find("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/" + dateOrTime + "Formats/" + dateOrTime + "FormatLength/" + dateOrTime + "Format/*").forEach(function (patternNode) {
                    var type = patternNode.parent().parent().attr('type').value();

                    calendar.dateFormats = calendar.dateFormats || {};
                    calendar.dateFormats.basic = calendar.dateFormats.basic || {};
                    calendar.dateFormats.basic[type + dateOrTimeCapitalized] = calendar.dateFormats.basic[type + dateOrTimeCapitalized] || patternNode.text();
                });
            });

            var dateTimePatterns = {};
            find("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/dateTimeFormats/dateTimeFormatLength/dateTimeFormat").forEach(function (dateTimeFormatNode) {
                var dateTimeFormatLengthType = dateTimeFormatNode.parent().attr('type').value(),
                    patternNodes = dateTimeFormatNode.find("pattern");
                if (patternNodes.length !== 1) {
                    throw new Error('Expected exactly one pattern in dateTimeFormatNode');
                }
                dateTimePatterns[dateTimeFormatLengthType] = dateTimePatterns[dateTimeFormatLengthType] || patternNodes[0].text();
            });

            find("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/dateTimeFormats/default").forEach(function (dateTimeDefaultLengthNode) {
                calendar.defaultDateTimePattern = calendar.defaultDateTimePattern || dateTimePatterns[dateTimeDefaultLengthNode.attr('choice').value()];
            });

            find("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/dateTimeFormats/availableFormats/dateFormatItem").forEach(function (dateFormatItemNode) {
                var id = dateFormatItemNode.attr('id').value();
                calendar.dateFormats = calendar.dateFormats || {};
                calendar.dateFormats.cldr = calendar.dateFormats.cldr || {};
                calendar.dateFormats.cldr[id] = calendar.dateFormats.cldr[id] || dateFormatItemNode.text();
            });

            ['short', 'medium', 'long', 'full'].forEach(function (length) {
                calendar.dateFormats.basic[length + 'DateTime'] = dateTimePatterns[length]
                    .replace(/\{0\}/g, calendar.dateFormats.basic[length + 'Time'])
                    .replace(/\{1\}/g, calendar.dateFormats.basic[length + 'Date']);
            });

            // Inspired by date_parts_order in DateTime::Locale::Base:
            calendar.datePartsOrder = calendar.dateFormats.basic.shortDate.replace(/[^dmy]/gi, '').toLowerCase().replace(/(\w)\1+/g, "$1");
        }

        if (options.dateIntervalFormats) {
            calendar.dateIntervalFormats = {};
            find("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/dateTimeFormats/intervalFormats/intervalFormatItem").forEach(function (intervalFormatItemNode) {
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
                calendar.dateIntervalFormats[id] = calendar.dateIntervalFormats[id] || dateIntervalFormat;
            });

            find("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/dateTimeFormats/intervalFormats/intervalFormatFallback").forEach(function (intervalFormatFallbackNode) {
                calendar.dateIntervalFallbackFormat = calendar.dateIntervalFallbackFormat || intervalFormatFallbackNode.text();
            });
        }

        return calendar;
    },

    _extractNumberSymbols: function (numberSystemId, find) {
        var numberSymbols = {};
        find("/ldml/numbers/symbols[@numberSystem = '" + numberSystemId + "']/*[name() != 'alias']").forEach(function (numberSymbolNode) {
            var symbolId = numberSymbolNode.name();
            numberSymbols[numberSystemId] = numberSymbols[numberSystemId] || {};
            numberSymbols[numberSystemId][symbolId] = numberSymbols[numberSystemId][symbolId] || numberSymbolNode.text();
        });
        return numberSymbols;
    },

    /**
     * options.localeId
     * options.calendars: true means all, array of calendar ids means extract only data for those calendars
     * options.numberSymbols: true means all, array of number system ids means extract only data for those number systems
     * options.territories
     * options.countries (subset of territories)
     * options.regions (subset of territories)
     * options.timeZones
     * options.languages
     * options.scripts
     * options.countryInfoByTerritoryId (required if options.countries is true)
     * options.numericRegionIdByTerritoryId (if provided a regionId property will be added to each territory/country)
     * options.numTimeZonesByTerritoryId (if provided a hasTimeZones property will be added to each territory/country)
     */
    extractDataForLocale: function (options, cb) {
        var that = this;
        seq(expandLocaleIdToPrioritizedList(options.localeId).concat('root'))
            .parMap(function (subLocaleId) {
                that.getCommonMainDocument(subLocaleId, this);
            })
            .unflatten()
            .seq(function (prioritizedDocuments) {
                function find(xpathQuery) {
                    var prioritizedResults = [];
                    prioritizedDocuments.forEach(function (document, i) {
                        var resultsForLocaleDocument = document.find(xpathQuery);
                        if (resultsForLocaleDocument.length === 0 && i === (prioritizedDocuments.length - 1)) {
                            // We're in root and there were no results, look for alias elements in path:
                            var queryFragments = xpathQuery.split('/'),
                                poppedQueryFragments = [];
                            while (queryFragments.length > 1) {
                                var aliasNodes = document.find(queryFragments.join('/') + '/alias');
                                if (aliasNodes.length > 0) {
                                    var aliasSpecifiedQuery = normalizeXPathQuery(aliasNodes[0].path() + '/../' + aliasNodes[0].attr('path').value() + '/' + poppedQueryFragments.join('/'));
                                    Array.prototype.push.apply(prioritizedResults, find(aliasSpecifiedQuery));
                                    break;
                                }
                                poppedQueryFragments.unshift(queryFragments.pop());
                            }
                        } else {
                            Array.prototype.push.apply(prioritizedResults, resultsForLocaleDocument);
                        }
                    });
                    return prioritizedResults;
                }

                var localeData = {};
                if (options.languages) {
                    localeData.languages = that._extractLanguages(options, find);
                }

                if (options.numberSymbols) {
                    localeData.numberSymbols = {};
                    (Array.isArray(options.numberSymbols) ? options.numberSymbols : Cldr.numberSymbolIds).forEach(function (numberSystemId) {
                        localeData.numberSymbols[numberSystenId] = that._extractNumberSymbols(numberSystemId, find);
                    });
                }

                if (options.calendars || options.eraNames || options.quarterNames || options.monthNames || options.dayNames || options.dateFormats || options.dateIntervalFormats || options.fields) {
                    localeData.calendars = {};
                    (Array.isArray(options.calendars) ? options.calendars : Cldr.calendarIds).forEach(function (calendarId) {
                        localeData.calendars[calendarId] = that._extractCalendar(_.defaults({id: calendarId}, options), find);
                    });
                }

                if (options.unitPatterns) {
                    localeData.unitPatterns = {};
                    find("/ldml/units/unit/unitPattern").forEach(function (unitPatternNode) {
                        var unitId = unitPatternNode.parent().attr('type').value().replace(/-([a-z])/g, function ($0, ch) { // year-future => yearFuture etc.
                            return ch.toUpperCase();
                        });
                        localeData.unitPatterns[unitId] = localeData.unitPatterns[unitId] || {};
                        var count = unitPatternNode.attr('count').value();
                        localeData.unitPatterns[unitId][count] = localeData.unitPatterns[unitId][count] || unitPatternNode.text();
                    });
                }

                if (options.delimiters) {
                    localeData.delimiters = {};
                    find("/ldml/delimiters/*").forEach(function (delimiterNode) {
                        var type = delimiterNode.name();
                        localeData.delimiters[type] = localeData.delimiters[type] || delimiterNode.text();
                    });
                }

                if (options.listPatterns) {
                    localeData.listPatterns = {};
                    find("/ldml/listPatterns/listPattern/listPatternPart").forEach(function (listPatternPartNode) {
                        var type = listPatternPartNode.attr('type').value();
                        localeData.listPatterns[type] = localeData.listPatterns[type] || listPatternPartNode.text();
                    });
                }

                if (options.exemplarCharacters) {
                    localeData.exemplarCharacters = {};
                    find("/ldml/characters/exemplarCharacters").forEach(function (exemplarCharactersNode) {
                        var typeAttr = exemplarCharactersNode.attr('type'),
                            type = (typeAttr && typeAttr.value()) || 'default';
                        localeData.exemplarCharacters[type] = localeData.exemplarCharacters[type] || exemplarCharactersNode.text().replace(/^\[|\]$/g, '').split(" ");
                    });
                }

                if (options.timeZones) {
                    localeData.timeZones = that._extractTimeZones(options, find);
                }

                if (options.territories || options.countries || options.regions) {
                    var territories = that._extractTerritories(options, find);

                    if (options.territories) {
                        localeData.territories = territories;
                    }

                    if (options.countries) {
                        localeData.countries = territories.filter(function (territoryId) {
                            var countryInfo = options.countryInfoByTerritoryId[territoryId];
                            return countryInfo && !countryInfo.isHistorical && !countryInfo.isSubdivision;
                        });
                    }
                    if (options.regions) {
                        localeData.regions = territories.filter(function (territoryId) {
                            return /^\d{3}/.test(territoryId);
                        });
                    }
                }

                if (options.currencies) {
                    localeData.currencies = that._extractCurrencies(options, find);
                }

                if (options.scripts) {
                    localeData.scripts = that._extractScripts(options, find);
                }

                // Convert objects with all integral keys starting from 0 to arrays and remove undefined values:
                localeData = (function convert(obj) {
                    if (Array.isArray(obj)) {
                        return obj.map(convert);
                    } else if (typeof obj === 'object' && obj !== null) {
                        var keys = Object.keys(obj),
                            nextNumericKeyNumber = 0;
                        while (nextNumericKeyNumber in obj) {
                            nextNumericKeyNumber += 1;
                        }
                        if (keys.length > 0 && nextNumericKeyNumber === keys.length) {
                            var array = [];
                            for (var i = 0 ; i < keys.length ; i += 1) {
                                array.push(convert(obj[i]));
                            }
                            return array;
                        } else {
                            var resultObj = {};
                            keys.forEach(function (key) {
                                if (typeof obj[key] !== 'undefined') {
                                    resultObj[key] = convert(obj[key]);
                                }
                            });
                            return resultObj;
                        }
                    } else {
                        return obj;
                    }
                }(localeData));

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

// root.xml:
// Cldr.numberSystemIds = ['arab', 'arabext', 'bali', 'beng', 'cham', 'deva', 'fullwide', 'gujr', 'guru', 'hanidec', 'java', 'kali', 'khmr', 'knda', 'lana', 'lanatham', 'laoo', 'latn', 'lepc', 'limb', 'mlym', 'mong', 'mtei', 'mymr', 'mymrshan', 'nkoo', 'olck', 'orya', 'saur', 'sund', 'talu', 'tamldec', 'telu', 'thai', 'tibt', 'vaii'];

// common/bcp47/numbers.xml:
Cldr.numberSystemIds = ['arab', 'arabext', 'armn', 'armnlow', 'bali', 'beng', 'brah', 'cakm', 'cham', 'deva', 'ethi', 'finance', 'fullwide', 'geor', 'grek', 'greklow', 'gujr', 'guru', 'hanidec', 'hans', 'hansfin', 'hant', 'hantfin', 'hebr', 'java', 'jpan', 'jpanfin', 'kali', 'khmr', 'knda', 'lana', 'lanatham', 'laoo', 'latn', 'lepc', 'limb', 'mlym', 'mong', 'mtei', 'mymr', 'mymrshan', 'native', 'nkoo', 'olck', 'orya', 'osma', 'roman', 'romanlow', 'saur', 'shrd', 'sora', 'sund', 'takr', 'talu', 'taml', 'tamldec', 'telu', 'thai', 'tibt', 'traditio', 'vaii'];

// Copied from CLDR (common/bcp47/calendar.xml), would be nice to extract the list dynamically:
Cldr.calendarIds = ['buddhist', 'chinese', 'coptic', 'ethiopic', 'ethiopic-amete-alem', 'gregorian', 'hebrew', 'indian', 'islamic', 'islamic-civil', 'japanese', 'persian', 'roc'];

module.exports = Cldr;
