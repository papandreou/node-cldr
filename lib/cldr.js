var Path = require('path'),
    fs = require('fs'),
    _ = require('underscore'),
    passError = require('passerror'),
    memoizeAsync = require('./memoizeAsync'),
    libxmljs = require('libxmljs'),
    seq = require('seq'),
    normalizeLocaleId = require('./normalizeLocaleId'),
    convertObjectsWithIntegerKeysToArrays = require('./convertObjectsWithIntegerKeysToArrays'),
    CldrPluralRuleSet = require('./CldrPluralRuleSet'),
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
    // Support instantiation without the 'new' operator:
    if (!(this instanceof Cldr)) {
        return new Cldr(cldrPath);
    }
    this.cldrPath = cldrPath;
    this.documentByFileName = {};
    this.memoizerByFileName = {};
}

Cldr.prototype = {
    get fileNamesByTypeAndNormalizedLocaleId() {
        if (!this._fileNamesByTypeAndNormalizedLocaleId) {
            this._fileNamesByTypeAndNormalizedLocaleId = {};
            ['main', 'rbnf'].forEach(function (type) {
                this._fileNamesByTypeAndNormalizedLocaleId[type] = {};
                var fileNames;
                try {
                    fileNames = fs.readdirSync(Path.resolve(this.cldrPath, "common", type));
                } catch (e) {
                    if (e.code === 'ENOENT') {
                        // Directory doesn't exist, just pretend it's empty.
                        return;
                    }
                }
                fileNames.forEach(function (fileName) {
                    var matchFileName = fileName.match(/^(.*)\.xml$/);
                    if (matchFileName) {
                        this._fileNamesByTypeAndNormalizedLocaleId[type][normalizeLocaleId(matchFileName[1])] =
                            Path.resolve(this.cldrPath, "common", type, fileName);
                    }
                }, this);
            }, this);
        }
        return this._fileNamesByTypeAndNormalizedLocaleId;
    },

    get localeIds() {
        if (!this._localeIds) {
            this._localeIds = Object.keys(this.fileNamesByTypeAndNormalizedLocaleId.main);
        }
        return this._localeIds;
    },

    get calendarIds() {
        if (!this._calendarIds) {
            this._calendarIds = [];
            this.getDocument(Path.resolve(this.cldrPath, 'common', 'bcp47', 'calendar.xml')).find('/ldmlBCP47/keyword/key[@name="ca"]/type').forEach(function (keyNode) {
                var calendarId = keyNode.attr('name').value();
                if (calendarId === 'gregory') {
                    calendarId = 'gregorian';
                }
                this._calendarIds.push(calendarId);
            }, this);
        }
        return this._calendarIds;
    },

    get numberSystemIds() {
        if (!this._numberSystemIds) {
            this._numberSystemIds = [];
            this.getDocument(Path.resolve(this.cldrPath, 'common', 'bcp47', 'number.xml')).find('/ldmlBCP47/keyword/key[@name="nu"]/type').forEach(function (keyNode) {
                this._numberSystemIds.push(keyNode.attr('name').value());
            }, this);
        }
        return this._numberSystemIds;
    },

    // Works both async and sync (omit cb):
    getDocument: function (fileName, cb) {
        var that = this;
        if (that.documentByFileName[fileName]) {
            if (cb) {
                process.nextTick(function () {
                    cb(null, that.documentByFileName[fileName]);
                });
            } else {
                return that.documentByFileName[fileName];
            }
        } else {
            if (cb) {
                // Make sure not to load file more than once if it's being loaded when getDocument is called for the second time:
                that.memoizerByFileName[fileName] = that.memoizerByFileName[fileName] || memoizeAsync(function (cb) {
                    fs.readFile(fileName, 'utf-8', passError(cb, function (xmlString) {
                        var document = libxmljs.parseXmlString(xmlString);
                        that.documentByFileName[fileName] = document;
                        cb(null, document);
                    }));
                });
                that.memoizerByFileName[fileName](cb);
            } else {
                return that.documentByFileName[fileName] = libxmljs.parseXmlString(fs.readFileSync(fileName, 'utf-8'));
            }
        }
    },

    getPrioritizedDocumentsForLocale: function (localeId, type) {
        var that = this;
        return expandLocaleIdToPrioritizedList(localeId).concat('root').map(function (subLocaleId) {
            return that.fileNamesByTypeAndNormalizedLocaleId[type][normalizeLocaleId(subLocaleId)];
        }).filter(function (fileName) {
            return !!fileName;
        }).map(function (fileName) {
            return that.getDocument(fileName);
        });
    },

    preload: function (localeIds, cb) {
        var that = this;
        if (typeof localeIds === 'function') {
            cb = localeIds;
            localeIds = that.localeIds;
        }
        localeIds = (Array.isArray(localeIds) ? localeIds : [localeIds]).map(normalizeLocaleId);
        var neededLocaleById = {root: true};
        localeIds.forEach(function (localeId) {
            expandLocaleIdToPrioritizedList(localeId).forEach(function (subLocaleId) {
                neededLocaleById[subLocaleId] = true;
            });
        });
        var fileNames = [
            Path.resolve(that.cldrPath, 'common', 'supplemental', 'plurals.xml'),
            Path.resolve(that.cldrPath, 'common', 'supplemental', 'numberingSystems.xml')
        ];
        Object.keys(neededLocaleById).forEach(function (localeId) {
            ['main', 'rbnf'].forEach(function (type) {
                var fileName = that.fileNamesByTypeAndNormalizedLocaleId[type][localeId];
                if (fileName) {
                    fileNames.push(fileName);
                }
            });
        });
        seq(fileNames)
            .parEach(20, function (fileName) {
                that.getDocument(fileName, this);
            })
            .seq(function () {
                cb();
            })
            .catch(cb);
    },

    createFinder: function (prioritizedDocuments) {
        return function finder(xpathQuery) {
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
                            var aliasSpecifiedQuery = normalizeXPathQuery(queryFragments.join('/') + '/' + aliasNodes[0].attr('path').value() + '/' + poppedQueryFragments.join('/'));
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

    extractLanguageDisplayNames: function (localeId) {
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            languageDisplayNames = {};
        finder('/ldml/localeDisplayNames/languages/language').forEach(function (node) {
            var id = normalizeLocaleId(node.attr('type').value());
            languageDisplayNames[id] = languageDisplayNames[id] || node.text();
        });
        return languageDisplayNames;
    },

    extractTimeZoneDisplayNames: function (localeId) {
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            timeZoneDisplayNames = {};
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
        return timeZoneDisplayNames;
    },

    extractTimeZoneFormats: function (localeId) {
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            timeZoneFormats = {};
        ['hourFormat', 'gmtFormat', 'gmtZeroFormat', 'regionFormat', 'fallbackFormat', 'fallbackRegionFormat'].forEach(function (tagName) {
            finder("/ldml/dates/timeZoneNames/" + tagName).forEach(function (node) {
                var formatName = node.name().replace(/Format$/, ''),
                    value = node.text();
                if (formatName === 'hour') {
                    value = value.split(';');
                }
                timeZoneFormats[formatName] = timeZoneFormats[formatName] || value;
            });
        });
        return timeZoneFormats;
    },

    extractTerritoryDisplayNames: function (localeId) {
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            territoryDisplayNames = {};
        finder("/ldml/localeDisplayNames/territories/territory").forEach(function (territoryNode) {
            var territoryId = territoryNode.attr('type').value();
            territoryDisplayNames[territoryId] = territoryDisplayNames[territoryId] || territoryNode.text();
        });
        return territoryDisplayNames;
    },

    extractCurrencyInfoById: function (localeId) {
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            currencyDisplayNameByCurrencyId = {},
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

        var currencyInfoById = {};
        Object.keys(currencyDisplayNameByCurrencyId).forEach(function (currencyId) {
            currencyInfoById[currencyId] = _.extend({
                displayName: currencyDisplayNameByCurrencyId[currencyId],
                symbol: currencySymbolByCurrencyId[currencyId]
            }, currencyDisplayNameByCurrencyIdAndCount[currencyId]);
        });
        return currencyInfoById;
    },

    extractScriptDisplayNames: function (localeId) {
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            scriptDisplayNames = {};
        finder("/ldml/localeDisplayNames/scripts/script").forEach(function (scriptNode) {
            var id = scriptNode.attr('type').value();
            scriptDisplayNames[id] = scriptDisplayNames[id] || scriptNode.text();
        });
        return scriptDisplayNames;
    },

    // Calendar extraction methods:

    extractEraNames: function (localeId, calendarId) {
        calendarId = calendarId || 'gregorian';
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            eraNames;
        ['eraNames', 'eraAbbr'].forEach(function (eraType) {
            var typeInOutput = {eraNames: 'wide', eraAbbr: 'abbreviated'}[eraType];
            finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/eras/" + eraType + "/era").forEach(function (eraNode) {
                var type = parseInt(eraNode.attr('type').value(), 10);
                eraNames = eraNames || {};
                eraNames[typeInOutput] = eraNames[typeInOutput] || {};
                eraNames[typeInOutput][type] = eraNames[typeInOutput][type] || eraNode.text();
            });
        });
        return convertObjectsWithIntegerKeysToArrays(eraNames);
    },

    extractQuarterNames: function (localeId, calendarId) {
        calendarId = calendarId || 'gregorian';
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            quarterNames;
        ['format', 'stand-alone'].forEach(function (quarterContext) {
            var quarterContextCamelCase = quarterContext.replace(/-([a-z])/g, function ($0, ch) { // stand-alone => standAlone
                return ch.toUpperCase();
            });
            ['abbreviated', 'narrow', 'wide'].forEach(function (quarterWidth) {
                finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/quarters/quarterContext[@type='" + quarterContext + "']/quarterWidth[@type='" + quarterWidth + "']/quarter").forEach(function (quarterNode) {
                    var quarterNo = parseInt(quarterNode.attr('type').value(), 10) - 1;

                    quarterNames = quarterNames || {};
                    quarterNames[quarterContextCamelCase] = quarterNames[quarterContextCamelCase] || {};
                    quarterNames[quarterContextCamelCase][quarterWidth] = quarterNames[quarterContextCamelCase][quarterWidth] || {};
                    quarterNames[quarterContextCamelCase][quarterWidth][quarterNo] = quarterNames[quarterContextCamelCase][quarterWidth][quarterNo] || quarterNode.text();
                });
            });
        });
        return convertObjectsWithIntegerKeysToArrays(quarterNames);
    },

    extractDayPeriods: function (localeId, calendarId) {
        calendarId = calendarId || 'gregorian';
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            dayPeriods;
        ['format', 'stand-alone'].forEach(function (dayPeriodContext) {
            var dayPeriodContextCamelCase = dayPeriodContext.replace(/-([a-z])/g, function ($0, ch) { // stand-alone => standAlone
                return ch.toUpperCase();
            });
            ['abbreviated', 'narrow', 'wide', 'short'].forEach(function (dayPeriodWidth) {
                finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/dayPeriods/dayPeriodContext[@type='" + dayPeriodContext + "']/dayPeriodWidth[@type='" + dayPeriodWidth + "']/dayPeriod").forEach(function (dayPeriodNode) {
                    var type = dayPeriodNode.attr('type').value();

                    dayPeriods = dayPeriods || {};
                    dayPeriods[dayPeriodContextCamelCase] = dayPeriods[dayPeriodContextCamelCase] || {};
                    dayPeriods[dayPeriodContextCamelCase][dayPeriodWidth] =
                        dayPeriods[dayPeriodContextCamelCase][dayPeriodWidth] || {};
                    dayPeriods[dayPeriodContextCamelCase][dayPeriodWidth][type] =
                        dayPeriods[dayPeriodContextCamelCase][dayPeriodWidth][type] || dayPeriodNode.text();
                });
            });
        });
        return dayPeriods;
    },

    extractCyclicNames: function (localeId, calendarId) {
        calendarId = calendarId || 'gregorian';
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            cyclicNames;
        ['dayParts', 'days', 'months', 'years', 'zodiacs'].forEach(function (cyclicNameSet) {
            ['format'].forEach(function (cyclicNameContext) {
                ['abbreviated', 'narrow', 'wide'].forEach(function (cyclicNameWidth) {
                    finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/cyclicNameSets/cyclicNameSet[@type='" + cyclicNameSet + "']/cyclicNameContext[@type='" + cyclicNameContext + "']/cyclicNameWidth[@type='" + cyclicNameWidth + "']/cyclicName").forEach(function (cyclicNameNode) {
                        var type = cyclicNameNode.attr('type').value();
                        cyclicNames = cyclicNames || {};
                        cyclicNames[cyclicNameSet] = cyclicNames[cyclicNameSet] || {};
                        cyclicNames[cyclicNameSet][cyclicNameContext] = cyclicNames[cyclicNameSet][cyclicNameContext] || {};
                        cyclicNames[cyclicNameSet][cyclicNameContext][cyclicNameWidth] = cyclicNames[cyclicNameSet][cyclicNameContext][cyclicNameWidth] || {};
                        cyclicNames[cyclicNameSet][cyclicNameContext][cyclicNameWidth][type] = cyclicNames[cyclicNameSet][cyclicNameContext][cyclicNameWidth][type] || cyclicNameNode.text();
                    });
                });
            });
        });
        return convertObjectsWithIntegerKeysToArrays(cyclicNames);
    },

    extractMonthNames: function (localeId, calendarId) {
        calendarId = calendarId || 'gregorian';
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            monthNames;
        ['format', 'stand-alone'].forEach(function (monthContext) {
            var monthContextCamelCase = monthContext.replace(/-([a-z])/g, function ($0, ch) { // stand-alone => standAlone
                return ch.toUpperCase();
            });
            ['abbreviated', 'narrow', 'wide'].forEach(function (monthWidth) {
                finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/months/monthContext[@type='" + monthContext + "']/monthWidth[@type='" + monthWidth + "']/month").forEach(function (monthNode) {
                    var monthNo = parseInt(monthNode.attr('type').value(), 10) - 1;
                    monthNames = monthNames || {};
                    monthNames[monthContextCamelCase] = monthNames[monthContextCamelCase] || {};
                    monthNames[monthContextCamelCase][monthWidth] = monthNames[monthContextCamelCase][monthWidth] || {};
                    monthNames[monthContextCamelCase][monthWidth][monthNo] =
                        monthNames[monthContextCamelCase][monthWidth][monthNo] || monthNode.text();
                });
            });
        });
        return convertObjectsWithIntegerKeysToArrays(monthNames);
    },

    extractMonthPatterns: function (localeId, calendarId) {
        calendarId = calendarId || 'gregorian';
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            monthPatterns;
        ['format', 'numeric', 'stand-alone'].forEach(function (monthPatternContext) {
            var monthPatternContextCamelCase = monthPatternContext.replace(/-([a-z])/g, function ($0, ch) { // stand-alone => standAlone
                return ch.toUpperCase();
            });
            ['abbreviated', 'narrow', 'wide', 'all'].forEach(function (monthPatternWidth) {
                finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/monthPatterns/monthPatternContext[@type='" + monthPatternContext + "']/monthPatternWidth[@type='" + monthPatternWidth + "']/monthPattern").forEach(function (monthPatternNode) {
                    var type = monthPatternNode.attr('type').value();
                    monthPatterns = monthPatterns || {};
                    monthPatterns[monthPatternContextCamelCase] = monthPatterns[monthPatternContextCamelCase] || {};
                    monthPatterns[monthPatternContextCamelCase][monthPatternWidth] =
                        monthPatterns[monthPatternContextCamelCase][monthPatternWidth] || {};
                    monthPatterns[monthPatternContextCamelCase][monthPatternWidth][type] =
                        monthPatterns[monthPatternContextCamelCase][monthPatternWidth][type] || monthPatternNode.text();
                });
            });
        });
        return monthPatterns;
    },

    extractDayNames: function (localeId, calendarId) {
        calendarId = calendarId || 'gregorian';
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            dayNoByCldrId = {sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6},
            dayNames;
        ['format', 'numeric', 'stand-alone'].forEach(function (dayContext) {
            var dayContextCamelCase = dayContext.replace(/-([a-z])/g, function ($0, ch) { // stand-alone => standAlone
                return ch.toUpperCase();
            });
            ['abbreviated', 'narrow', 'wide', 'short'].forEach(function (dayWidth) {
                finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/days/dayContext[@type='" + dayContext + "']/dayWidth[@type='" + dayWidth + "']/day").forEach(function (dayNode) {
                    var dayNo = dayNoByCldrId[dayNode.attr('type').value()];
                    dayNames = dayNames || {};
                    dayNames[dayContextCamelCase] = dayNames[dayContextCamelCase] || {};
                    dayNames[dayContextCamelCase][dayWidth] = dayNames[dayContextCamelCase][dayWidth] || {};
                    dayNames[dayContextCamelCase][dayWidth][dayNo] = dayNames[dayContextCamelCase][dayWidth][dayNo] || dayNode.text();
                });
            });
        });
        return convertObjectsWithIntegerKeysToArrays(dayNames);
    },

    extractFields: function (localeId, calendarId) {
        calendarId = calendarId || 'gregorian';
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            fields;
        finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/fields/field/displayName").forEach(function (fieldDisplayNameNode) {
            var fieldName = fieldDisplayNameNode.parent().attr('type').value();
            fields = fields || {};
            fields[fieldName] = fields[fieldName] || {};
            fields[fieldName].displayName = fields[fieldName].displayName || fieldDisplayNameNode.text();
        });

        finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/fields/field/relative").forEach(function (fieldRelativeNode) {
            var fieldName = fieldRelativeNode.parent().attr('type').value(),
                type = fieldRelativeNode.attr('type').value();
            fields = fields || {};
            fields[fieldName] = fields[fieldName] || {};
            fields[fieldName].relative = fields[fieldName].relative || {};
            fields[fieldName].relative[type] = fields[fieldName].relative[type] || fieldRelativeNode.text();

        });
        return fields;
    },

    extractDateTimePatterns: function (localeId, calendarId) {
        calendarId = calendarId || 'gregorian';
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            dateTimePatterns;
        finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/dateTimeFormats/dateTimeFormatLength/dateTimeFormat").forEach(function (dateTimeFormatNode) {
            var dateTimeFormatLengthType = dateTimeFormatNode.parent().attr('type').value(),
                patternNodes = dateTimeFormatNode.find("pattern");
            if (patternNodes.length !== 1) {
                throw new Error('Expected exactly one pattern in dateTimeFormatNode');
            }
            dateTimePatterns = dateTimePatterns || {};
            dateTimePatterns[dateTimeFormatLengthType] = dateTimePatterns[dateTimeFormatLengthType] || patternNodes[0].text();
        });
        return dateTimePatterns;
    },

    extractDateOrTimeFormats: function (localeId, calendarId, dateOrTime) {
        calendarId = calendarId || 'gregorian';
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            formats;
        finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/" + dateOrTime + "Formats/" + dateOrTime + "FormatLength/" + dateOrTime + "Format/*").forEach(function (patternNode) {
            var type = patternNode.parent().parent().attr('type').value();
            formats = formats || {};
            formats[type] = formats[type] || patternNode.text();
        });
        return formats;
    },

    extractDateFormats: function (localeId, calendarId) {
        return this.extractDateOrTimeFormats(localeId, calendarId, 'date');
    },

    extractTimeFormats: function (localeId, calendarId) {
        return this.extractDateOrTimeFormats(localeId, calendarId, 'time');
    },

    extractDateFormatItems: function (localeId, calendarId) {
        calendarId = calendarId || 'gregorian';
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            dateFormatItems;
        finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/dateTimeFormats/availableFormats/dateFormatItem").forEach(function (dateFormatItemNode) {
            var id = dateFormatItemNode.attr('id').value();
            dateFormatItems = dateFormatItems || {};
            dateFormatItems[id] = dateFormatItems[id] || dateFormatItemNode.text();
        });
        return dateFormatItems;
    },

    extractDateIntervalFormats: function (localeId, calendarId) {
        calendarId = calendarId || 'gregorian';
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            dateIntervalFormats;
        finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/dateTimeFormats/intervalFormats/intervalFormatItem").forEach(function (intervalFormatItemNode) {
            var dateIntervalFormat = {};
            intervalFormatItemNode.childNodes().forEach(function (greatestDifferenceNode) {
                var greatestDifferenceIdAttribute = greatestDifferenceNode.attr('id');
                if (!greatestDifferenceIdAttribute) {
                    // Skip whitespace nodes
                    return;
                }
                var greatestDifferenceId = greatestDifferenceIdAttribute.value();
                dateIntervalFormat[greatestDifferenceId] = dateIntervalFormat[greatestDifferenceId] || greatestDifferenceNode.text();
            });
            var id = intervalFormatItemNode.attr('id').value();
            dateIntervalFormats = dateIntervalFormats || {};
            dateIntervalFormats[id] = dateIntervalFormats[id] || dateIntervalFormat;
        });
        return dateIntervalFormats;
    },

    extractDateIntervalFallbackFormat: function (localeId, calendarId) {
        calendarId = calendarId || 'gregorian';
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            dateIntervalFallbackFormat;
        finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/dateTimeFormats/intervalFormats/intervalFormatFallback").forEach(function (intervalFormatFallbackNode) {
            dateIntervalFallbackFormat = dateIntervalFallbackFormat || intervalFormatFallbackNode.text();
        });
        return dateIntervalFallbackFormat;
    },

    // Number extraction code:

    extractNumberSymbols: function (localeId, numberSystemId) {
        numberSystemId = numberSystemId || 'latn';
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            numberSymbols;
        finder("/ldml/numbers/symbols[@numberSystem = '" + numberSystemId + "']/*[name() != 'alias']").concat(finder("/ldml/numbers/symbols/*[name() != 'alias']")).forEach(function (numberSymbolNode) {
            var symbolId = numberSymbolNode.name();
            numberSymbols = numberSymbols || {};
            numberSymbols[symbolId] = numberSymbols[symbolId] || numberSymbolNode.text();
        });
        return numberSymbols;
    },

    extractNumberFormats: function (localeId, numberSystemId) {
        numberSystemId = numberSystemId || 'latn';
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            numberFormats;
        ['scientific', 'decimal', 'currency', 'percent'].forEach(function (formatType) {
            ['full', 'long', 'medium', 'short'].forEach(function (length) {
                finder("/ldml/numbers/" + formatType + "Formats[@numberSystem = '" + numberSystemId + "']/" + formatType + "FormatLength[@type='" + length + "']/" + formatType + "Format/pattern").forEach(function (patternNode) {
                    var type = patternNode.attr('type').value(),
                        count = patternNode.attr('count').value();
                    numberFormats = numberFormats || {};
                    numberFormats[formatType] = numberFormats[formatType] || {};
                    numberFormats[formatType][length] = numberFormats[formatType][length] || {};
                    numberFormats[formatType][length][type] = numberFormats[formatType][length][type] || {};
                    numberFormats[formatType][length][type][count] = numberFormats[formatType][length][type][count] || patternNode.text();
                });
            });
            finder("/ldml/numbers/" + formatType + "Formats[@numberSystem = '" + numberSystemId + "']/" + formatType + "FormatLength[not(@type)]/" + formatType + "Format/pattern").forEach(function (patternNode) {
                numberFormats = numberFormats || {};
                numberFormats[formatType] = numberFormats[formatType] || {};
                numberFormats[formatType].default = numberFormats[formatType].default || patternNode.text();
            });
            finder("/ldml/numbers/" + formatType + "Formats[@numberSystem = '" + numberSystemId + "']/unitPattern").forEach(function (unitPatternNode) {
                var count = unitPatternNode.attr('count').value();
                numberFormats = numberFormats || {};
                numberFormats[formatType] = numberFormats[formatType] || {};
                numberFormats[formatType][count] = numberFormats[formatType][count] || unitPatternNode.text();
            });
        });
        return numberFormats;
    },

    extractDefaultNumberSystemId: function (localeId) {
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            defaultNumberSystemId;
        finder('/ldml/numbers/defaultNumberingSystem').forEach(function (defaultNumberingSystemNode) {
            defaultNumberSystemId = defaultNumberSystemId || defaultNumberingSystemNode.text();
        });
        return defaultNumberSystemId;
    },

    extractUnitPatterns: function (localeId) {
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            unitPatterns = {
                unit: {},
                compoundUnit: {}
            };
        finder("/ldml/units/unitLength/unit/unitPattern").forEach(function (unitPatternNode) {
            var unitNode = unitPatternNode.parent(),
                unitLengthNode = unitNode.parent(),
                unitLength = unitLengthNode.attr('type').value(),
                unitId = unitNode.attr('type').value().replace(/-([a-z])/g, function ($0, ch) { // year-future => yearFuture etc.
                return ch.toUpperCase();
            });
            unitPatterns.unit[unitLength] = unitPatterns.unit[unitLength] || {};
            unitPatterns.unit[unitLength][unitId] = unitPatterns.unit[unitLength][unitId] || {};
            var count = unitPatternNode.attr('count').value();
            unitPatterns.unit[unitLength][unitId][count] = unitPatterns.unit[unitLength][unitId][count] || unitPatternNode.text();
        });
        finder("/ldml/units/unitLength/compoundUnit/compoundUnitPattern").forEach(function (compoundUnitPatternNode) {
            var compoundUnitNode = compoundUnitPatternNode.parent(),
                compoundUnitId = compoundUnitNode.attr('type').value();
            unitPatterns.compoundUnit[compoundUnitId] = compoundUnitPatternNode.text();
        });
        return unitPatterns;
    },

    extractDelimiters: function (localeId) {
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            delimiters = {};
        finder("/ldml/delimiters/*").forEach(function (delimiterNode) {
            var type = delimiterNode.name();
            delimiters[type] = delimiters[type] || delimiterNode.text();
        });
        return delimiters;
    },

    extractListPatterns: function (localeId) {
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            listPatterns = {};
        finder("/ldml/listPatterns/listPattern/listPatternPart").forEach(function (listPatternPartNode) {
            var type = listPatternPartNode.attr('type').value();
            listPatterns[type] = listPatterns[type] || listPatternPartNode.text();
        });
        return listPatterns;
    },

    extractCharacters: function (localeId) {
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            characters = {
                exemplar: {},
                ellipsis: {}
            };
        finder("/ldml/characters/exemplarCharacters").forEach(function (exemplarCharactersNode) {
            var typeAttr = exemplarCharactersNode.attr('type'),
                type = (typeAttr && typeAttr.value()) || 'default';
            characters.exemplar[type] = characters.exemplar[type] || exemplarCharactersNode.text().replace(/^\[|\]$/g, '').split(" ");
        });
        finder("/ldml/characters/ellipsis").forEach(function (ellipsisNode) {
            var type = ellipsisNode.attr('type').value();
            characters.ellipsis[type] = characters.ellipsis[type] || ellipsisNode.text();
        });
        finder("/ldml/characters/moreInformation").forEach(function (moreInformationNode) {
            characters.moreInformation = characters.moreInformation || moreInformationNode.text();
        });
        return characters;
    },

    extractPluralRuleFunction: function (localeId) {
        var that = this,
            document = that.getDocument(Path.resolve(that.cldrPath, 'common', 'supplemental', 'plurals.xml')),
            subLocaleIds = expandLocaleIdToPrioritizedList(localeId),
            statementAsts = [];
        for (var i = 0 ; i < subLocaleIds.length ; i += 1) {
            var subLocaleId = subLocaleIds[i],
                matchLocalesXPathExpr =
                    "@locales = '" + subLocaleId + "' or " +
                    "starts-with(@locales, '" + subLocaleId + "') or " +
                    "contains(@locales, ' " + subLocaleId + " ') or " +
                    "(contains(@locales, ' " + subLocaleId + "') and substring-after(@locales, ' " + subLocaleId + "') = '')",
                pluralRulesNodes = document.find("/supplementalData/plurals/pluralRules[" + matchLocalesXPathExpr + "]"),
                cldrPluralRuleSet = new CldrPluralRuleSet();
            if (pluralRulesNodes.length > 0) {
                pluralRulesNodes[0].find("pluralRule").forEach(function (pluralRuleNode) {
                    cldrPluralRuleSet.addRule(pluralRuleNode.text(), pluralRuleNode.attr('count').value());
                });
                statementAsts = cldrPluralRuleSet.toJavaScriptFunctionBodyAst();
                break;
            }
        }
        return new Function("n", uglifyJs.uglify.gen_code(['toplevel', statementAsts]));
    },

    // 'types' is optional, defaults to all available
    extractRbnfFunctionByType: function (localeId, types) {
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'rbnf')),
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
            typesToAdd = types ? [].concat(types) : Object.keys(cldrRbnfRuleSetByType),
            rbnfFunctionByType = {};
        while (typesToAdd.length > 0) {
            var type = typesToAdd.shift();
            if (!(type in isAddedByType)) {
                isAddedByType[type] = true;
                var cldrRbnfRuleSet = cldrRbnfRuleSetByType[type];
                // Some rules aren't available in some locales (such as spellout-cardinal-financial).
                // The easiest thing is just to skip the missing ones here, even though it can produce
                // some broken function sets:
                if (cldrRbnfRuleSet) {
                    var result = cldrRbnfRuleSet.toFunctionAst();

                    rbnfFunctionByType[type] = new Function("n", uglifyJs.uglify.gen_code(['toplevel', result.functionAst[3]]));
                    Array.prototype.push.apply(typesToAdd, result.dependencies);
                }
            }
        }
        return rbnfFunctionByType;
    },

    extractDigitsByNumberSystemId: function () {
        var document = this.getDocument(Path.resolve(this.cldrPath, 'common', 'supplemental', 'numberingSystems.xml')),
            digitsByNumberSystemId = {};

        document.find('/supplementalData/numberingSystems/numberingSystem').forEach(function (numberingSystemNode) {
            var numberSystemId = numberingSystemNode.attr('id').value();
            if (numberingSystemNode.attr('type').value() === 'numeric') {
                digitsByNumberSystemId[numberSystemId] = numberingSystemNode.attr('digits').value().split(/(?:)/);
            } else {
                // type='algorithmic'
                var rulesAttributeFragments = numberingSystemNode.attr('rules').value().split('/'),
                    sourceLocaleId = rulesAttributeFragments.length === 3 ? normalizeLocaleId(rulesAttributeFragments[0]) : 'root',
                    ruleType = CldrRbnfRuleSet.getSafeRendererName(rulesAttributeFragments[rulesAttributeFragments.length - 1]);
                digitsByNumberSystemId[numberSystemId] = ruleType; // A string value means "use this rbnf renderer for the digits"
            }
        }, this);
        return digitsByNumberSystemId;
    }
};

module.exports = new Cldr(Path.resolve(__dirname, '../3rdparty/cldr/'));
module.exports.load = function (cldrPath) {
    return new Cldr(cldrPath);
};
