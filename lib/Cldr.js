var Path = require('path'),
    fs = require('fs'),
    _ = require('underscore'),
    passError = require('passerror'),
    libxmljs = require('libxmljs'),
    seq = require('seq'),
    normalizeLocaleId = require('./normalizeLocaleId'),
    cldrPluralRuleToJavaScriptAst = require('./cldrPluralRuleToJavaScriptAst'),
    CldrRbnfRuleSet = require('./CldrRbnfRuleSet'),
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
    this.fileNamesByTypeAndLocalizedId = {};

    // Sorry, but it's just one sync call per Cldr instance:
    ['main', 'rbnf'].forEach(function (type) {
        this.fileNamesByTypeAndLocalizedId[type] = {};
        fs.readdirSync(Path.resolve(this.cldrPath, "common", type)).forEach(function (fileName) {
            var matchFileName = fileName.match(/^(.*)\.xml$/);
            if (matchFileName) {
                this.fileNamesByTypeAndLocalizedId[type][normalizeLocaleId(matchFileName[1])] =
                    Path.resolve(this.cldrPath, "common", type, fileName);
            }
        }, this);
    }, this);

    this.localeIds = Object.keys(this.fileNamesByTypeAndLocalizedId.main);
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

    getPrioritizedDocumentsForLocale: function (localeId, type, cb) {
        var that = this,
            fileNames = expandLocaleIdToPrioritizedList(localeId).concat('root').map(function (subLocaleId) {
                return that.fileNamesByTypeAndLocalizedId[type][normalizeLocaleId(subLocaleId)];
            }).filter(function (fileName) {
                return !!fileName;
            });

        seq(fileNames)
            .parMap(function (fileName) {
                that.getDocument(fileName, this);
            })
            .unflatten()
            .seq(function (prioritizedDocuments) {
                cb(null, prioritizedDocuments);
            })
            .catch(cb);
    },

    createFinder: function (prioritizedDocuments, supportAliases) {
        return function finder(xpathQuery) {
            var prioritizedResults = [];
            prioritizedDocuments.forEach(function (document, i) {
                var resultsForLocaleDocument = document.find(xpathQuery);
                if (supportAliases && resultsForLocaleDocument.length === 0 && i === (prioritizedDocuments.length - 1)) {
                    // We're in root and there were no results, look for alias elements in path:
                    var queryFragments = xpathQuery.split('/'),
                        poppedQueryFragments = [];
                    while (queryFragments.length > 1) {
                        var aliasNodes = document.find(queryFragments.join('/') + '/alias');
                        if (aliasNodes.length > 0) {
                            var aliasSpecifiedQuery = normalizeXPathQuery(aliasNodes[0].path() + '/../' + aliasNodes[0].attr('path').value() + '/' + poppedQueryFragments.join('/'));
                            Array.prototype.push.apply(prioritizedResults, finder(aliasSpecifiedQuery));
                            break;
                        }
                        poppedQueryFragments.unshift(queryFragments.pop());
                    }
                } else {
                    Array.prototype.push.apply(prioritizedResults, resultsForLocaleDocument);
                }
            });
            return prioritizedResults;
        };
    },

    _extractLanguages: function (options, finder) {
        var languageDisplayNames = {};
        finder('/ldml/localeDisplayNames/languages/language').forEach(function (node) {
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

    _extractTimeZones: function (options, finder) {
        var timeZoneDisplayNames = {};
        finder("/ldml/dates/timeZoneNames/zone").forEach(function (zoneNode) {
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
            return timeZoneId in options.zoneInfo.utcStandardOffsetSecondsByTimeZoneId && timeZoneId in options.zoneInfo.territoryIdByTimeZoneId;
        }).map(function (timeZoneId) {
            var utcStandardOffsetSeconds = options.zoneInfo.utcStandardOffsetSecondsByTimeZoneId[timeZoneId],
                territoryId = options.zoneInfo.territoryIdByTimeZoneId[timeZoneId];
            return {
                id: timeZoneId,
                regionId: options.worldInfo.numericRegionIdByTerritoryId[territoryId] || null,
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

    _extractTerritories: function (options, finder) {
        var territoryDisplayNames = {};
        finder("/ldml/localeDisplayNames/territories/territory").forEach(function (territoryNode) {
            var territoryId = territoryNode.attr('type').value();
            territoryDisplayNames[territoryId] = territoryDisplayNames[territoryId] || territoryNode.text();
        });

        return Object.keys(territoryDisplayNames).sort(function (a, b) {
            return territoryDisplayNames[a] < territoryDisplayNames[b] ? -1 :
                (territoryDisplayNames[a] > territoryDisplayNames[b] ? 1 : 0);
        }).map(function (territoryId) {
            return {
                id: territoryId,
                regionId: options.worldInfo.numericRegionIdByTerritoryId[territoryId] || null,
                displayName: territoryDisplayNames[territoryId],
                hasTimeZones: options.zoneInfo.numTimeZonesByTerritoryId[territoryId] > 0
            };
        });
    },

    _extractCurrencies: function (options, finder) {
        var currencyDisplayNameByCurrencyId = {},
            currencyDisplayNameByCurrencyIdAndCount = {},
            currencySymbolByCurrencyId = {};

        finder("/ldml/numbers/currencies/currency/displayName").forEach(function (displayNameNode) {
            var currencyId = displayNameNode.parent().attr('type').value(),
                countAttribute = displayNameNode.attr('count');
            if (countAttribute) {
                currencyDisplayNameByCurrencyIdAndCount[currencyId] = currencyDisplayNameByCurrencyIdAndCount[currencyId] || {};
                currencyDisplayNameByCurrencyIdAndCount[currencyId][countAttribute.value()] = displayNameNode.text();
            } else {
                currencyDisplayNameByCurrencyId[currencyId] = currencyDisplayNameByCurrencyId[currencyId] || displayNameNode.text();
            }
        });

        finder("/ldml/numbers/currencies/currency/symbol").forEach(function (symbolNode) {
            var currencyId = symbolNode.parent().attr('type').value();
            currencySymbolByCurrencyId[currencyId] = currencySymbolByCurrencyId[currencyId] || symbolNode.text();
        });

        return Object.keys(currencyDisplayNameByCurrencyId).sort(function (a, b) {
            return currencyDisplayNameByCurrencyId[a] < currencyDisplayNameByCurrencyId[b] ? -1 :
                (currencyDisplayNameByCurrencyId[a] > currencyDisplayNameByCurrencyId[b] ? 1 : 0);
        }).map(function (currencyId) {
            return _.extend({
                id: currencyId,
                displayName: currencyDisplayNameByCurrencyId[currencyId],
                symbol: currencySymbolByCurrencyId[currencyId]
            }, currencyDisplayNameByCurrencyIdAndCount[currencyId]);
        });
    },

    _extractScripts: function (options, finder) {
        var scriptDisplayNames = {};
        finder("/ldml/localeDisplayNames/scripts/script").forEach(function (scriptNode) {
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

    _extractCalendar: function (options, finder) {
        var calendarId = options.id,
            calendar = {};

        if (options.eraNames || options.dateFormats || options.dateIntervalFormats) {
            calendar.eraNames = {};
            ['eraNames', 'eraAbbr'].forEach(function (eraType) {
                var typeInOutput = {eraNames: 'wide', eraAbbr: 'abbreviated'}[eraType];
                finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/eras/" + eraType + "/era").forEach(function (eraNode) {
                    var type = parseInt(eraNode.attr('type').value(), 10);
                    calendar.eraNames[typeInOutput] = calendar.eraNames[typeInOutput] || {};
                    calendar.eraNames[typeInOutput][type] = calendar.eraNames[typeInOutput][type] || eraNode.text();
                });
            });
        }

        if (options.quarterNames || options.dateFormats || options.dateIntervalFormats) {
            calendar.quarterNames = {};
            ['format', 'stand-alone'].forEach(function (quarterContext) {
                ['abbreviated', 'narrow', 'wide'].forEach(function (quarterWidth) {
                    finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/quarters/quarterContext[@type='" + quarterContext + "']/quarterWidth[@type='" + quarterWidth + "']/quarter").forEach(function (quarterNode) {
                        // Avoid dashes in width and context (so that dot notation can be used in JavaScript)
                        var context = quarterContext.replace(/-/g, ''),
                            width = quarterWidth.replace(/-/g, ''),
                            quarterNo = parseInt(quarterNode.attr('type').value(), 10) - 1;
                        calendar.quarterNames[context] = calendar.quarterNames[context] || {};
                        calendar.quarterNames[context][width] = calendar.quarterNames[context][width] || {};
                        calendar.quarterNames[context][width][quarterNo] = calendar.quarterNames[context][width][quarterNo] || quarterNode.text();
                    });
                });
            });
        }

        if (options.dayPeriods || options.dateFormats || options.dateIntervalFormats) {
            calendar.dayPeriods = calendar.dayPeriods || {};
            ['format', 'stand-alone'].forEach(function (dayPeriodContext) {
                ['abbreviated', 'narrow', 'wide', 'short'].forEach(function (dayPeriodWidth) {
                    finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/dayPeriods/dayPeriodContext[@type='" + dayPeriodContext + "']/dayPeriodWidth[@type='" + dayPeriodWidth + "']/dayPeriod").forEach(function (dayPeriodNode) {
                        var width = dayPeriodWidth.replace(/-/g, ''),
                            context = dayPeriodContext.replace(/-/g, ''),
                            type = dayPeriodNode.attr('type').value();
                        calendar.dayPeriods[context] = calendar.dayPeriods[context] || {};
                        calendar.dayPeriods[context][width] = calendar.dayPeriods[context][width] || {};
                        calendar.dayPeriods[context][width][type] = calendar.dayPeriods[context][width][type] || dayPeriodNode.text();
                    });
                });
            });
        }

        if ((options.cyclicNames || options.dateFormats || options.dateIntervalFormats) && calendarId === 'chinese') {
            calendar.cyclicNames = {};
            ['dayParts', 'days', 'months', 'years', 'zodiacs'].forEach(function (cyclicNameSet) {
                ['format'].forEach(function (cyclicNameContext) {
                    ['abbreviated', 'narrow', 'wide'].forEach(function (cyclicNameWidth) {
                        finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/cyclicNameSets/cyclicNameSet[@type='" + cyclicNameSet + "']/cyclicNameContext[@type='" + cyclicNameContext + "']/cyclicNameWidth[@type='" + cyclicNameWidth + "']/cyclicName").forEach(function (cyclicNameNode) {
                            var type = cyclicNameNode.attr('type').value();
                            calendar.cyclicNames[cyclicNameSet] = calendar.cyclicNames[cyclicNameSet] || {};
                            calendar.cyclicNames[cyclicNameSet][cyclicNameContext] = calendar.cyclicNames[cyclicNameSet][cyclicNameContext] || {};
                            calendar.cyclicNames[cyclicNameSet][cyclicNameContext][cyclicNameWidth] = calendar.cyclicNames[cyclicNameSet][cyclicNameContext][cyclicNameWidth] || {};
                            calendar.cyclicNames[cyclicNameSet][cyclicNameContext][cyclicNameWidth][type] = calendar.cyclicNames[cyclicNameSet][cyclicNameContext][cyclicNameWidth][type] || cyclicNameNode.text();
                        });
                    });
                });
            });
        }

        if (options.monthNames || options.dateFormats || options.dateIntervalFormats) {
            calendar.monthNames = calendar.monthNames || {};
            ['format', 'stand-alone'].forEach(function (monthContext) {
                ['abbreviated', 'narrow', 'wide'].forEach(function (monthWidth) {
                    finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/months/monthContext[@type='" + monthContext + "']/monthWidth[@type='" + monthWidth + "']/month").forEach(function (monthNode) {
                        // Avoid dashes in width and context (so that dot notation can be used in JavaScript)
                        var context = monthContext.replace(/-/g, ''),
                            width = monthWidth.replace(/-/g, '');
                        calendar.monthNames[context] = calendar.monthNames[context] || {};
                        calendar.monthNames[context][width] = calendar.monthNames[context][width] || {};
                        var monthNo = parseInt(monthNode.attr('type').value(), 10) - 1;
                        calendar.monthNames[context][width][monthNo] = calendar.monthNames[context][width][monthNo] || monthNode.text();
                    });
                });
            });
        }

        if (options.monthPatterns || options.dateFormats || options.dateIntervalFormats) {
            ['format', 'numeric', 'stand-alone'].forEach(function (monthPatternContext) {
                ['abbreviated', 'narrow', 'wide', 'all'].forEach(function (monthPatternWidth) {
                    finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/monthPatterns/monthPatternContext[@type='" + monthPatternContext + "']/monthPatternWidth[@type='" + monthPatternWidth + "']/monthPattern").forEach(function (monthPatternNode) {
                        // Avoid dashes in width and context (so that dot notation can be used in JavaScript)
                        var type = monthPatternNode.attr('type').value(),
                            width = monthPatternWidth.replace(/-/g, ''),
                            context = monthPatternContext.replace(/-/g, '');
                        calendar.monthPatterns = calendar.monthPatterns || {};
                        calendar.monthPatterns[context] = calendar.monthPatterns[context] || {};
                        calendar.monthPatterns[context][width] = calendar.monthPatterns[context][width] || {};
                        calendar.monthPatterns[context][width][type] = calendar.monthPatterns[context][width][type] || monthPatternNode.text();
                    });
                });
            });
        }

        if (options.dayNames || options.dateFormats || options.dateIntervalFormats) {
            var dayNoByCldrId = {sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6};
            ['format', 'numeric', 'stand-alone'].forEach(function (dayContext) {
                ['abbreviated', 'narrow', 'wide', 'short'].forEach(function (dayWidth) {
                    finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/days/dayContext[@type='" + dayContext + "']/dayWidth[@type='" + dayWidth + "']/day").forEach(function (dayNode) {
                        var width = dayWidth.replace(/-/g, ''),
                            context = dayContext.replace(/-/g, ''),
                            dayNo = dayNoByCldrId[dayNode.attr('type').value()];
                        calendar.dayNames = calendar.dayNames || {};
                        calendar.dayNames[context] = calendar.dayNames[context] || {};
                        calendar.dayNames[context][width] = calendar.dayNames[context][width] || {};
                        calendar.dayNames[context][width][dayNo] = calendar.dayNames[context][width][dayNo] || dayNode.text();
                    });
                });
            });
        }

        if (options.fields) {
            finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/fields/field/displayName").forEach(function (fieldDisplayNameNode) {
                var fieldName = fieldDisplayNameNode.parent().attr('type').value();
                calendar.fields = calendar.fields || {};
                calendar.fields[fieldName] = calendar.fields[fieldName] || {};
                calendar.fields[fieldName].displayName = calendar.fields[fieldName].displayName || fieldDisplayNameNode.text();
            });

            finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/fields/field/relative").forEach(function (fieldRelativeNode) {
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

                finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/" + dateOrTime + "Formats/" + dateOrTime + "FormatLength/" + dateOrTime + "Format/*").forEach(function (patternNode) {
                    var type = patternNode.parent().parent().attr('type').value();

                    calendar.dateFormats = calendar.dateFormats || {};
                    calendar.dateFormats.basic = calendar.dateFormats.basic || {};
                    calendar.dateFormats.basic[type + dateOrTimeCapitalized] = calendar.dateFormats.basic[type + dateOrTimeCapitalized] || patternNode.text();
                });
            });

            var dateTimePatterns = {};
            finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/dateTimeFormats/dateTimeFormatLength/dateTimeFormat").forEach(function (dateTimeFormatNode) {
                var dateTimeFormatLengthType = dateTimeFormatNode.parent().attr('type').value(),
                    patternNodes = dateTimeFormatNode.find("pattern");
                if (patternNodes.length !== 1) {
                    throw new Error('Expected exactly one pattern in dateTimeFormatNode');
                }
                dateTimePatterns[dateTimeFormatLengthType] = dateTimePatterns[dateTimeFormatLengthType] || patternNodes[0].text();
            });

            finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/dateTimeFormats/default").forEach(function (dateTimeDefaultLengthNode) {
                calendar.defaultDateTimePattern = calendar.defaultDateTimePattern || dateTimePatterns[dateTimeDefaultLengthNode.attr('choice').value()];
            });

            finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/dateTimeFormats/availableFormats/dateFormatItem").forEach(function (dateFormatItemNode) {
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
            finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/dateTimeFormats/intervalFormats/intervalFormatItem").forEach(function (intervalFormatItemNode) {
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

            finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/dateTimeFormats/intervalFormats/intervalFormatFallback").forEach(function (intervalFormatFallbackNode) {
                calendar.dateIntervalFallbackFormat = calendar.dateIntervalFallbackFormat || intervalFormatFallbackNode.text();
            });
        }

        return calendar;
    },

    _extractNumberSystem: function (numberSystemId, finder) {
        var numberSystem = {
            symbols: {},
            formats: {}
        };
        finder("/ldml/numbers/symbols[@numberSystem = '" + numberSystemId + "']/*[name() != 'alias']").forEach(function (numberSymbolNode) {
            var symbolId = numberSymbolNode.name();
            numberSystem.symbols[symbolId] = numberSystem.symbols[symbolId] || numberSymbolNode.text();
        });
        ['scientific', 'decimal', 'currency', 'percent'].forEach(function (formatType) {
            ['full', 'long', 'medium', 'short'].forEach(function (length) {
                finder("/ldml/numbers/" + formatType + "Formats[@numberSystem = '" + numberSystemId + "']/" + formatType + "FormatLength[@type='" + length + "']/" + formatType + "Format/pattern").forEach(function (patternNode) {
                    var type = patternNode.attr('type').value(),
                        count = patternNode.attr('count').value();
                    numberSystem.formats[formatType] = numberSystem.formats[formatType] || {};
                    numberSystem.formats[formatType][length] = numberSystem.formats[formatType][length] || {};
                    numberSystem.formats[formatType][length][type] = numberSystem.formats[formatType][length][type] || {};
                    numberSystem.formats[formatType][length][type][count] = numberSystem.formats[formatType][length][type][count] || patternNode.text();
                });
            });
            finder("/ldml/numbers/" + formatType + "Formats[@numberSystem = '" + numberSystemId + "']/" + formatType + "FormatLength[not(@type)]/" + formatType + "Format/pattern").forEach(function (patternNode) {
                numberSystem.formats[formatType] = numberSystem.formats[formatType] || {};
                numberSystem.formats[formatType].default = numberSystem.formats[formatType].default || patternNode.text();
            });
            finder("/ldml/numbers/" + formatType + "Formats[@numberSystem = '" + numberSystemId + "']/unitPattern").forEach(function (unitPatternNode) {
                var count = unitPatternNode.attr('count').value();
                numberSystem.formats[formatType] = numberSystem.formats[formatType] || {};
                numberSystem.formats[formatType][count] = numberSystem.formats[formatType][count] || unitPatternNode.text();
            });
        });
        return numberSystem;
    },

    /**
     * options.localeId
     * options.calendars: true means all, array of calendar ids means extract only data for those calendars
     * options.numbers: true means all, array of number system ids means extract only data for those number systems
     * options.territories
     * options.countries (subset of territories)
     * options.regions (subset of territories)
     * options.timeZones
     * options.languages
     * options.scripts
     * options.zoneInfo.numericRegionIdByTerritoryId (if provided a regionId property will be added to each territory/country)
     * options.zoneInfo.numTimeZonesByTerritoryId (if provided a hasTimeZones property will be added to each territory/country)
     * options.worldInfo.countryInfoByTerritoryId (required if options.countries is true)
     * options.worldInfo.numericRegionIdByNumericTerritoryId
     * options.worldInfo.numericRegionIdByTerritoryId
     * options.worldInfo.alpha2CodeByNumericTerritoryId
     */
    extractDataForLocale: function (options, cb) {
        var that = this;
        that.getPrioritizedDocumentsForLocale(options.localeId, 'main', passError(cb, function (prioritizedDocuments) {
            var finder = that.createFinder(prioritizedDocuments, true),
                localeData = {};
            if (options.languages) {
                localeData.languages = that._extractLanguages(options, finder);
            }

            if (options.numbers || options.rbnf) {
                localeData.numbers = {};
                (Array.isArray(options.numbers) ? options.numbers : Cldr.numberSystemIds).forEach(function (numberSystemId) {
                    localeData.numbers[numberSystemId] = that._extractNumberSystem(numberSystemId, finder);
                });
                finder('/ldml/numbers/defaultNumberingSystem').forEach(function (defaultNumberingSystemNode) {
                    localeData.defaultNumberSystemId = localeData.defaultNumberSystemId || defaultNumberingSystemNode.text();
                });
            }

            if (options.calendars || options.eraNames || options.quarterNames || options.monthNames || options.monthPatterns || options.dayNames || options.dayPeriods || options.cyclicNames || options.dateFormats || options.dateIntervalFormats || options.fields) {
                localeData.calendars = {};
                (Array.isArray(options.calendars) ? options.calendars : Cldr.calendarIds).forEach(function (calendarId) {
                    localeData.calendars[calendarId] = that._extractCalendar(_.defaults({id: calendarId}, options), finder);
                });
            }

            if (options.unitPatterns) {
                localeData.unitPatterns = {};
                finder("/ldml/units/unit/unitPattern").forEach(function (unitPatternNode) {
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
                finder("/ldml/delimiters/*").forEach(function (delimiterNode) {
                    var type = delimiterNode.name();
                    localeData.delimiters[type] = localeData.delimiters[type] || delimiterNode.text();
                });
            }

            if (options.listPatterns) {
                localeData.listPatterns = {};
                finder("/ldml/listPatterns/listPattern/listPatternPart").forEach(function (listPatternPartNode) {
                    var type = listPatternPartNode.attr('type').value();
                    localeData.listPatterns[type] = localeData.listPatterns[type] || listPatternPartNode.text();
                });
            }

            if (options.characters) {
                localeData.exemplarCharacters = {};
                finder("/ldml/characters/exemplarCharacters").forEach(function (exemplarCharactersNode) {
                    var typeAttr = exemplarCharactersNode.attr('type'),
                        type = (typeAttr && typeAttr.value()) || 'default';
                    localeData.exemplarCharacters[type] = localeData.exemplarCharacters[type] || exemplarCharactersNode.text().replace(/^\[|\]$/g, '').split(" ");
                });
                localeData.ellipsis = {};
                finder("/ldml/characters/ellipsis").forEach(function (ellipsisNode) {
                    var type = ellipsisNode.attr('type').value();
                    localeData.ellipsis[type] = localeData.ellipsis[type] || ellipsisNode.text();
                });
                finder("/ldml/characters/moreInformation").forEach(function (moreInformationNode) {
                    localeData.moreInformation = localeData.moreInformation || moreInformationNode.text();
                });
            }

            if (options.timeZones) {
                localeData.timeZones = that._extractTimeZones(options, finder);
                localeData.timeZoneFormats = {};
                ['hourFormat', 'gmtFormat', 'gmtZeroFormat', 'regionFormat', 'fallbackFormat', 'fallbackRegionFormat'].forEach(function (tagName) {
                    finder("/ldml/dates/timeZoneNames/" + tagName).forEach(function (node) {
                        var formatName = node.name().replace(/Format$/, ''),
                            value = node.text();
                        if (formatName === 'hour') {
                            value = value.split(';');
                        }
                        localeData.timeZoneFormats[formatName] = localeData.timeZoneFormats[formatName] || value;
                    });
                });
            }

            if (options.territories || options.countries || options.regions) {
                var territories = that._extractTerritories(options, finder);

                if (options.territories) {
                    localeData.territories = territories;
                }

                if (options.countries) {
                    localeData.countries = territories.filter(function (territoryId) {
                        var countryInfo = options.worldInfo.countryInfoByTerritoryId[territoryId];
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
                localeData.currencies = that._extractCurrencies(options, finder);
            }

            if (options.scripts) {
                localeData.scripts = that._extractScripts(options, finder);
            }

            seq()
                .seq(function () {
                    var callback = this;
                    if (options.rbnf) {
                        that.getRbnfFunctionByType(options.localeId, ['renderDigitsOrdinal', 'renderSpelloutNumbering'], passError(callback, function (rbnfFunctionByType) {
                            _.extend(localeData, rbnfFunctionByType);
                            callback();
                        }));
                    } else {
                        callback();
                    }
                })
                .seq(function () {
                    var callback = this;
                    if (options.pluralRules) {
                        that.generateGetQuantityFunction(options.localeId, passError(callback, function (getQuantityMethod) {
                            localeData.getQuantity = getQuantityMethod;
                            callback();
                        }));
                    } else {
                        callback();
                    }
                })
                .seq(function () {
                    var callback = this;
                    if (options.numbers) {
                        that.getDigitsByNumberSystemId(passError(callback, function (digitsByNumberSystemId) {
                            Object.keys(digitsByNumberSystemId).forEach(function (numberSystemId) {
                                if (numberSystemId in localeData.numbers) {
                                    localeData.numbers[numberSystemId].digits = digitsByNumberSystemId[numberSystemId];
                                }
                            });
                            callback();
                        }));
                    } else {
                        callback();
                    }
                })
                .seq(function () {
                    // Convert objects with all integral keys starting from 0 to arrays and remove undefined values:
                    localeData = (function convert(obj) {
                        if (Array.isArray(obj)) {
                            return obj.map(convert);
                        } else if (typeof obj === 'object' && obj !== null) {
                            var keys = Object.keys(obj);
                            if (0 in obj || 1 in obj) {
                                var firstNumericKeyNumber = 0 in obj ? 0 : 1,
                                    nextNumericKeyNumber = firstNumericKeyNumber + 1;
                                while (nextNumericKeyNumber in obj) {
                                    nextNumericKeyNumber += 1;
                                }
                                if (keys.length > 0 && nextNumericKeyNumber === keys.length + firstNumericKeyNumber) {
                                    var array = [],
                                        i;
                                    for (i = 0 ; i < firstNumericKeyNumber ; i += 1) {
                                        array.push(undefined);
                                    }
                                    for (i = firstNumericKeyNumber ; i < keys.length ; i += 1) {
                                        array.push(convert(obj[i]));
                                    }
                                    return array;
                                }
                            }
                            var resultObj = {};
                            keys.forEach(function (key) {
                                if (typeof obj[key] !== 'undefined') {
                                    resultObj[key] = convert(obj[key]);
                                }
                            });
                            return resultObj;
                        } else {
                            return obj;
                        }
                    }(localeData));

                    cb(null, localeData);
                });
        }));
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
    },

    getRbnfFunctionByType: function (localeId, types, cb) {
        var that = this;
        that.getPrioritizedDocumentsForLocale(localeId, 'rbnf', passError(cb, function (prioritizedDocuments) {
            var finder = that.createFinder(prioritizedDocuments, false),
                cldrRbnfRuleSetByType = {};
            finder('/ldml/rbnf/rulesetGrouping/ruleset/rbnfrule').forEach(function (rbnfRuleNode) {
                var type = CldrRbnfRuleSet.getSafeRendererName(rbnfRuleNode.parent().attr('type').value()),
                    value = rbnfRuleNode.attr('value').value();
                cldrRbnfRuleSetByType[type] = cldrRbnfRuleSetByType[type] || new CldrRbnfRuleSet({type: type});
                if (!cldrRbnfRuleSetByType[type].ruleByValue[value]) {
                    var radixAttribute = rbnfRuleNode.attr('radix');
                    cldrRbnfRuleSetByType[type].ruleByValue[value] = {
                        value: value,
                        rbnf: rbnfRuleNode.text().replace(/;$/, '').replace(/←/g, '<').replace(/→/g, '>'),
                        radix: radixAttribute && radixAttribute.value()
                    };
                }
            });
            var isAddedByType = {},
                typesToAdd = [].concat(types),
                rbnfFunctionByType = {};
            while (typesToAdd.length > 0) {
                var type = typesToAdd.shift();
                if (!(type in isAddedByType)) {
                    isAddedByType[type] = true;
                    var result = cldrRbnfRuleSetByType[type].toFunctionAst();

                    rbnfFunctionByType[type] = new Function("n", uglifyJs.uglify.gen_code(['toplevel', result.functionAst[3]]));
                    Array.prototype.push.apply(typesToAdd, result.dependencies);
                }
            }
            cb(null, rbnfFunctionByType);
       }));
    },

    getDigitsByNumberSystemId: function (cb) {
        var that = this;
        this.getDocument(Path.resolve(that.cldrPath, 'common', 'supplemental', 'numberingSystems.xml'), passError(cb, function (document) {
            var digitsByNumberSystemId = {};
            seq(document.find('/supplementalData/numberingSystems/numberingSystem'))
                .parEach(function (numberingSystemNode) {
                    var callback = this,
                        numberSystemId = numberingSystemNode.attr('id').value();
                    if (numberingSystemNode.attr('type').value() === 'numeric') {
                        digitsByNumberSystemId[numberSystemId] = numberingSystemNode.attr('digits').value().split(/(?:)/);
                        callback();
                    } else {
                        // type='algorithmic'
                        // Broken -- but unused as long as Cldr.numberSystemIds isn't changed.
                        var rulesAttributeFragments = numberingSystemNode.attr('rules').value().split('/'),
                            sourceLocaleId = rulesAttributeFragments.length === 3 ? normalizeLocaleId(rulesAttributeFragments[0]) : 'root',
                            ruleType = CldrRbnfRuleSet.getSafeRendererName(rulesAttributeFragments[rulesAttributeFragments.length - 1]);
                        that.getRbnfFunctionByType(sourceLocaleId, [ruleType], passError(callback, function (rbnfFunctionByType) {
                            digitsByNumberSystemId[numberSystemId] = rbnfFunctionByType[ruleType];
                            callback();
                        }));
                    }
                })
                .seq(function () {
                    cb(null, digitsByNumberSystemId);
                })
                .catch(cb);
        }));
    }
};

// root.xml:
Cldr.numberSystemIds = ['arab', 'arabext', 'bali', 'beng', 'cham', 'deva', 'fullwide', 'gujr', 'guru', 'hanidec', 'java', 'kali', 'khmr', 'knda', 'lana', 'lanatham', 'laoo', 'latn', 'lepc', 'limb', 'mlym', 'mong', 'mtei', 'mymr', 'mymrshan', 'nkoo', 'olck', 'orya', 'saur', 'sund', 'talu', 'tamldec', 'telu', 'thai', 'tibt', 'vaii'];

// common/bcp47/numbers.xml
//Cldr.numberSystemIds = ['arab', 'arabext', 'armn', 'armnlow', 'bali', 'beng', 'brah', 'cakm', 'cham', 'deva', 'ethi', 'finance', 'fullwide', 'geor', 'grek', 'greklow', 'gujr', 'guru', 'hanidec', 'hans', 'hansfin', 'hant', 'hantfin', 'hebr', 'java', 'jpan', 'jpanfin', 'kali', 'khmr', 'knda', 'lana', 'lanatham', 'laoo', 'latn', 'lepc', 'limb', 'mlym', 'mong', 'mtei', 'mymr', 'mymrshan', 'native', 'nkoo', 'olck', 'orya', 'osma', 'roman', 'romanlow', 'saur', 'shrd', 'sora', 'sund', 'takr', 'talu', 'taml', 'tamldec', 'telu', 'thai', 'tibt', 'traditio', 'vaii'];

// Copied from CLDR (common/bcp47/calendar.xml), would be nice to extract the list dynamically:
Cldr.calendarIds = ['buddhist', 'chinese', 'coptic', 'ethiopic', 'ethiopic-amete-alem', 'gregorian', 'hebrew', 'indian', 'islamic', 'islamic-civil', 'japanese', 'persian', 'roc'];

module.exports = Cldr;
