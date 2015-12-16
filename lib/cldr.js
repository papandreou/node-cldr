var Path = require('path'),
    fs = require('fs'),
    _ = require('underscore'),
    passError = require('passerror'),
    memoizeAsync = require('./memoizeAsync'),
    dom = require('xmldom').DOMParser,
    xpath = require('xpath'),
    seq = require('seq'),
    normalizeLocaleId = require('./normalizeLocaleId'),
    normalizeProperty = require('./normalizeProperty'),
    convertObjectsWithIntegerKeysToArrays = require('./convertObjectsWithIntegerKeysToArrays'),
    CldrPluralRuleSet = require('./CldrPluralRuleSet'),
    CldrRbnfRuleSet = require('./CldrRbnfRuleSet'),
    uglifyJs = require('uglify-js'),
    unicoderegexp = require('unicoderegexp');

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
    localeId = normalizeLocaleId(localeId);
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
            xpath.select('/ldmlBCP47/keyword/key[@name="ca"]/type', this.getDocument(Path.resolve(this.cldrPath, 'common', 'bcp47', 'calendar.xml'))).forEach(function (keyNode) {
                var calendarId = keyNode.getAttribute('name');
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
            xpath.select('/ldmlBCP47/keyword/key[@name="nu"]/type', this.getDocument(Path.resolve(this.cldrPath, 'common', 'bcp47', 'number.xml'))).forEach(function (keyNode) {
                this._numberSystemIds.push(keyNode.getAttribute('name'));
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
                        var document = new dom().parseFromString(xmlString);
                        that.documentByFileName[fileName] = document;
                        cb(null, document);
                    }));
                });
                that.memoizerByFileName[fileName](cb);
            } else {
                return that.documentByFileName[fileName] = new dom().parseFromString(fs.readFileSync(fileName, 'utf-8'));
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
                var resultsForLocaleDocument = xpath.select(xpathQuery, document);
                if (resultsForLocaleDocument.length === 0 && i === (prioritizedDocuments.length - 1)) {
                    // We're in root and there were no results, look for alias elements in path:
                    var queryFragments = xpathQuery.split('/'),
                        poppedQueryFragments = [];
                    while (queryFragments.length > 1) {
                        var aliasNodes = xpath.select(queryFragments.join('/') + '/alias', document);
                        if (aliasNodes.length > 0) {
                            var aliasSpecifiedQuery = normalizeXPathQuery(queryFragments.join('/') + '/' + aliasNodes[0].getAttribute('path') + '/' + poppedQueryFragments.join('/'));
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

    extractLocaleDisplayPattern: function (localeId) {
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            localeDisplayPattern = {};
        finder("/ldml/localeDisplayNames/localeDisplayPattern/*").forEach(function (node) {
            localeDisplayPattern[node.nodeName] = node.textContent;
        });
        return localeDisplayPattern;
    },

    extractLanguageDisplayNames: function (localeId) {
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            languageDisplayNames = {};
        finder('/ldml/localeDisplayNames/languages/language').forEach(function (node) {
            var id = normalizeLocaleId(node.getAttribute('type'));
            languageDisplayNames[id] = languageDisplayNames[id] || node.textContent;
        });
        return languageDisplayNames;
    },

    extractTimeZoneDisplayNames: function (localeId) {
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            timeZoneDisplayNames = {};
        finder("/ldml/dates/timeZoneNames/zone").forEach(function (zoneNode) {
            var timeZoneId = zoneNode.getAttribute('type'),
                exemplarCityNodes = xpath.select("exemplarCity", zoneNode),
                tzNameLocale;
            if (exemplarCityNodes.length > 0) {
                tzNameLocale = exemplarCityNodes[0].textContent;
            } else {
                var genericDisplayNameNodes = xpath.select("long/generic", zoneNode);
                if (genericDisplayNameNodes.length > 0) {
                    tzNameLocale = genericDisplayNameNodes[0].textContent;
                } else {
                    var longDisplayNameNodes = xpath.select("long/standard", zoneNode);
                    if (longDisplayNameNodes.length > 0) {
                        tzNameLocale = longDisplayNameNodes[0].textContent;
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
                var formatName = node.nodeName.replace(/Format$/, ''),
                    value = node.textContent;
                if (formatName === 'hour') {
                    value = value.split(';');
                }
                timeZoneFormats[formatName] = timeZoneFormats[formatName] || value;
            });
        });
        finder("/ldml/dates/timeZoneNames/regionFormat[@type]").forEach(function (node) {
            var type = node.getAttribute('type');
            timeZoneFormats.regions = timeZoneFormats.regions || {};
            timeZoneFormats.regions[type] = timeZoneFormats.regions[type] || node.textContent;
        });
        return timeZoneFormats;
    },

    extractTerritoryDisplayNames: function (localeId) {
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            territoryDisplayNames = {};
        finder("/ldml/localeDisplayNames/territories/territory").forEach(function (territoryNode) {
            var territoryId = territoryNode.getAttribute('type');
            territoryDisplayNames[territoryId] = territoryDisplayNames[territoryId] || territoryNode.textContent;
        });
        return territoryDisplayNames;
    },

    extractCurrencyInfoById: function (localeId) {
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            currencyDisplayNameByCurrencyId = {},
            currencyDisplayNameByCurrencyIdAndCount = {},
            currencySymbolByCurrencyId = {};

        finder("/ldml/numbers/currencies/currency/displayName").forEach(function (displayNameNode) {
            var currencyId = displayNameNode.parentNode.getAttribute('type'),
                countAttribute = displayNameNode.getAttribute('count');
            if (countAttribute) {                currencyDisplayNameByCurrencyIdAndCount[currencyId] = currencyDisplayNameByCurrencyIdAndCount[currencyId] || {};
                currencyDisplayNameByCurrencyIdAndCount[currencyId][countAttribute] = displayNameNode.textContent;
            } else {
                currencyDisplayNameByCurrencyId[currencyId] = currencyDisplayNameByCurrencyId[currencyId] || displayNameNode.textContent;
            }
        });

        finder("/ldml/numbers/currencies/currency/symbol").forEach(function (symbolNode) {
            var currencyId = symbolNode.parentNode.getAttribute('type');
            currencySymbolByCurrencyId[currencyId] = currencySymbolByCurrencyId[currencyId] || symbolNode.textContent;
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
            var id = scriptNode.getAttribute('type');
            scriptDisplayNames[id] = scriptDisplayNames[id] || scriptNode.textContent;
        });
        return scriptDisplayNames;
    },

    extractKeyTypes: function (localeId) {
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            keyTypes = {};
        finder('/ldml/localeDisplayNames/keys/key').forEach(function (keyNode) {
            var type = keyNode.getAttribute('type');
            keyTypes[type] = { displayName: keyNode.textContent };
        });
        finder('/ldml/localeDisplayNames/types/type').forEach(function (typeNode) {
            var key = typeNode.getAttribute('key'),
                type = normalizeProperty(typeNode.getAttribute('type'));
            keyTypes[key] = keyTypes[key] || {};
            keyTypes[key].types = keyTypes[key].types || {};
            keyTypes[key].types[type] = typeNode.textContent;
        });
        return keyTypes;
    },

    extractTransformNames: function (localeId) {
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            transformNames = {};
        finder("/ldml/localeDisplayNames/transformNames/transformName").forEach(function (transformNameNode) {
            var id = transformNameNode.getAttribute('type');
            transformNames[id] = transformNames[id] || transformNameNode.textContent;
        });
        return transformNames;
    },

    extractMeasurementSystemNames: function (localeId) {
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            measurementSystemNames = {};
        finder("/ldml/localeDisplayNames/measurementSystemNames/measurementSystemName").forEach(function (measurementSystemNameNode) {
            var id = measurementSystemNameNode.getAttribute('type');
            measurementSystemNames[id] = measurementSystemNames[id] || measurementSystemNameNode.textContent;
        });
        return measurementSystemNames;
    },

    extractCodePatterns: function (localeId) {
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            codePatterns = {};
        finder("/ldml/localeDisplayNames/codePatterns/codePattern").forEach(function (codePatternNode) {
            var id = codePatternNode.getAttribute('type');
            codePatterns[id] = codePatterns[id] || codePatternNode.textContent;
        });
        return codePatterns;
    },

    // Calendar extraction methods:

    extractEraNames: function (localeId, calendarId) {
        calendarId = calendarId || 'gregorian';
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            eraNames;
        ['eraNames', 'eraAbbr'].forEach(function (eraType) {
            var typeInOutput = {eraNames: 'wide', eraAbbr: 'abbreviated'}[eraType];
            finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/eras/" + eraType + "/era").forEach(function (eraNode) {
                var type = parseInt(eraNode.getAttribute('type'), 10);
                eraNames = eraNames || {};
                eraNames[typeInOutput] = eraNames[typeInOutput] || {};
                eraNames[typeInOutput][type] = eraNames[typeInOutput][type] || eraNode.textContent;
            });
        });
        return convertObjectsWithIntegerKeysToArrays(eraNames);
    },

    extractQuarterNames: function (localeId, calendarId) {
        calendarId = calendarId || 'gregorian';
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            quarterNames;
        ['format', 'stand-alone'].forEach(function (quarterContext) {
            var quarterContextCamelCase = normalizeProperty(quarterContext); // stand-alone => standAlone
            ['abbreviated', 'narrow', 'wide'].forEach(function (quarterWidth) {
                finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/quarters/quarterContext[@type='" + quarterContext + "']/quarterWidth[@type='" + quarterWidth + "']/quarter").forEach(function (quarterNode) {
                    var quarterNo = parseInt(quarterNode.getAttribute('type'), 10) - 1;

                    quarterNames = quarterNames || {};
                    quarterNames[quarterContextCamelCase] = quarterNames[quarterContextCamelCase] || {};
                    quarterNames[quarterContextCamelCase][quarterWidth] = quarterNames[quarterContextCamelCase][quarterWidth] || {};
                    quarterNames[quarterContextCamelCase][quarterWidth][quarterNo] = quarterNames[quarterContextCamelCase][quarterWidth][quarterNo] || quarterNode.textContent;
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
            var dayPeriodContextCamelCase = normalizeProperty(dayPeriodContext); // stand-alone => standAlone
            ['abbreviated', 'narrow', 'wide', 'short'].forEach(function (dayPeriodWidth) {
                finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/dayPeriods/dayPeriodContext[@type='" + dayPeriodContext + "']/dayPeriodWidth[@type='" + dayPeriodWidth + "']/dayPeriod").forEach(function (dayPeriodNode) {
                    var type = dayPeriodNode.getAttribute('type');

                    dayPeriods = dayPeriods || {};
                    dayPeriods[dayPeriodContextCamelCase] = dayPeriods[dayPeriodContextCamelCase] || {};
                    dayPeriods[dayPeriodContextCamelCase][dayPeriodWidth] =
                        dayPeriods[dayPeriodContextCamelCase][dayPeriodWidth] || {};
                    dayPeriods[dayPeriodContextCamelCase][dayPeriodWidth][type] =
                        dayPeriods[dayPeriodContextCamelCase][dayPeriodWidth][type] || dayPeriodNode.textContent;
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
                        var type = cyclicNameNode.getAttribute('type');
                        cyclicNames = cyclicNames || {};
                        cyclicNames[cyclicNameSet] = cyclicNames[cyclicNameSet] || {};
                        cyclicNames[cyclicNameSet][cyclicNameContext] = cyclicNames[cyclicNameSet][cyclicNameContext] || {};
                        cyclicNames[cyclicNameSet][cyclicNameContext][cyclicNameWidth] = cyclicNames[cyclicNameSet][cyclicNameContext][cyclicNameWidth] || {};
                        cyclicNames[cyclicNameSet][cyclicNameContext][cyclicNameWidth][type] = cyclicNames[cyclicNameSet][cyclicNameContext][cyclicNameWidth][type] || cyclicNameNode.textContent;
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
            var monthContextCamelCase = normalizeProperty(monthContext); // stand-alone => standAlone
            ['abbreviated', 'narrow', 'wide'].forEach(function (monthWidth) {
                finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/months/monthContext[@type='" + monthContext + "']/monthWidth[@type='" + monthWidth + "']/month").forEach(function (monthNode) {
                    var monthNo = parseInt(monthNode.getAttribute('type'), 10) - 1;
                    monthNames = monthNames || {};
                    monthNames[monthContextCamelCase] = monthNames[monthContextCamelCase] || {};
                    monthNames[monthContextCamelCase][monthWidth] = monthNames[monthContextCamelCase][monthWidth] || {};
                    monthNames[monthContextCamelCase][monthWidth][monthNo] =
                        monthNames[monthContextCamelCase][monthWidth][monthNo] || monthNode.textContent;
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
            var monthPatternContextCamelCase = normalizeProperty(monthPatternContext); // stand-alone => standAlone
            ['abbreviated', 'narrow', 'wide', 'all'].forEach(function (monthPatternWidth) {
                finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/monthPatterns/monthPatternContext[@type='" + monthPatternContext + "']/monthPatternWidth[@type='" + monthPatternWidth + "']/monthPattern").forEach(function (monthPatternNode) {
                    var type = monthPatternNode.getAttribute('type');
                    monthPatterns = monthPatterns || {};
                    monthPatterns[monthPatternContextCamelCase] = monthPatterns[monthPatternContextCamelCase] || {};
                    monthPatterns[monthPatternContextCamelCase][monthPatternWidth] =
                        monthPatterns[monthPatternContextCamelCase][monthPatternWidth] || {};
                    monthPatterns[monthPatternContextCamelCase][monthPatternWidth][type] =
                        monthPatterns[monthPatternContextCamelCase][monthPatternWidth][type] || monthPatternNode.textContent;
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
            var dayContextCamelCase = normalizeProperty(dayContext); // stand-alone => standAlone
            ['abbreviated', 'narrow', 'wide', 'short'].forEach(function (dayWidth) {
                finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/days/dayContext[@type='" + dayContext + "']/dayWidth[@type='" + dayWidth + "']/day").forEach(function (dayNode) {
                    var dayNo = dayNoByCldrId[dayNode.getAttribute('type')];
                    dayNames = dayNames || {};
                    dayNames[dayContextCamelCase] = dayNames[dayContextCamelCase] || {};
                    dayNames[dayContextCamelCase][dayWidth] = dayNames[dayContextCamelCase][dayWidth] || {};
                    dayNames[dayContextCamelCase][dayWidth][dayNo] = dayNames[dayContextCamelCase][dayWidth][dayNo] || dayNode.textContent;
                });
            });
        });
        return convertObjectsWithIntegerKeysToArrays(dayNames);
    },

    extractFields: function (localeId) {
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            fields;
        finder("/ldml/dates/fields/field/displayName").forEach(function (fieldDisplayNameNode) {
            var fieldName = fieldDisplayNameNode.parentNode.getAttribute('type');
            fields = fields || {};
            fields[fieldName] = fields[fieldName] || {};
            fields[fieldName].displayName = fields[fieldName].displayName || fieldDisplayNameNode.textContent;
        });

        finder("/ldml/dates/fields/field/relative").forEach(function (fieldRelativeNode) {
            var fieldName = fieldRelativeNode.parentNode.getAttribute('type'),
                type = fieldRelativeNode.getAttribute('type');
            fields = fields || {};
            fields[fieldName] = fields[fieldName] || {};
            fields[fieldName].relative = fields[fieldName].relative || {};
            fields[fieldName].relative[type] = fields[fieldName].relative[type] || fieldRelativeNode.textContent;
        });

        finder("/ldml/dates/fields/field/relativeTime/relativeTimePattern").forEach(function (relativeTimePatternNode) {
            var relativeTimeNode = relativeTimePatternNode.parentNode,
                fieldName = relativeTimeNode.parentNode.getAttribute('type'),
                type = relativeTimeNode.getAttribute('type'),
                count = relativeTimePatternNode.getAttribute('count');
            fields = fields || {};
            fields[fieldName] = fields[fieldName] || {};
            fields[fieldName].relativeTime = fields[fieldName].relativeTime || {};
            fields[fieldName].relativeTime[type] = fields[fieldName].relativeTime[type] || {};
            fields[fieldName].relativeTime[type][count] = fields[fieldName].relativeTime[type][count] || relativeTimePatternNode.textContent
        });
        return fields;
    },

    extractDateTimePatterns: function (localeId, calendarId) {
        calendarId = calendarId || 'gregorian';
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            dateTimePatterns;
        finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/dateTimeFormats/dateTimeFormatLength/dateTimeFormat").forEach(function (dateTimeFormatNode) {
            var dateTimeFormatLengthType = dateTimeFormatNode.parentNode.getAttribute('type'),
                patternNodes = xpath.select("pattern", dateTimeFormatNode);
            if (patternNodes.length !== 1) {
                throw new Error('Expected exactly one pattern in dateTimeFormatNode');
            }
            dateTimePatterns = dateTimePatterns || {};
            dateTimePatterns[dateTimeFormatLengthType] = dateTimePatterns[dateTimeFormatLengthType] || patternNodes[0].textContent;
        });
        return dateTimePatterns;
    },

    extractDateOrTimeFormats: function (localeId, calendarId, dateOrTime) {
        calendarId = calendarId || 'gregorian';
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            formats;
        finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/" + dateOrTime + "Formats/" + dateOrTime + "FormatLength/" + dateOrTime + "Format/*").forEach(function (patternNode) {
            var type = patternNode.parentNode.parentNode.getAttribute('type');
            formats = formats || {};
            formats[type] = formats[type] || patternNode.textContent;
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
            var id = dateFormatItemNode.getAttribute('id');
            dateFormatItems = dateFormatItems || {};
            dateFormatItems[id] = dateFormatItems[id] || dateFormatItemNode.textContent;
        });
        return dateFormatItems;
    },

    extractDateIntervalFormats: function (localeId, calendarId) {
        calendarId = calendarId || 'gregorian';
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            dateIntervalFormats;
        finder("/ldml/dates/calendars/calendar[@type='" + calendarId + "']/dateTimeFormats/intervalFormats/intervalFormatItem").forEach(function (intervalFormatItemNode) {
            var dateIntervalFormat = {};
            for (var i = 0 ; i < intervalFormatItemNode.childNodes.length ; i += 1) {
                var greatestDifferenceNode = intervalFormatItemNode.childNodes[i];
                if (greatestDifferenceNode.nodeType !== 1) {
                    // Skip whitespace node
                    continue;
                }
                var greatestDifferenceIdAttribute = greatestDifferenceNode.getAttribute('id');
                var greatestDifferenceId = greatestDifferenceIdAttribute;
                dateIntervalFormat[greatestDifferenceId] = dateIntervalFormat[greatestDifferenceId] || greatestDifferenceNode.textContent;
            }
            var id = intervalFormatItemNode.getAttribute('id');
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
            dateIntervalFallbackFormat = dateIntervalFallbackFormat || intervalFormatFallbackNode.textContent;
        });
        return dateIntervalFallbackFormat;
    },

    // Number extraction code:

    extractNumberSymbols: function (localeId, numberSystemId) {
        numberSystemId = numberSystemId || 'latn';
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            numberSymbols;
        finder("/ldml/numbers/symbols[@numberSystem = '" + numberSystemId + "']/*[name() != 'alias']").concat(finder("/ldml/numbers/symbols/*[name() != 'alias']")).forEach(function (numberSymbolNode) {
            var symbolId = numberSymbolNode.nodeName;
            numberSymbols = numberSymbols || {};
            numberSymbols[symbolId] = numberSymbols[symbolId] || numberSymbolNode.textContent;
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
                    var type = patternNode.getAttribute('type'),
                        count = patternNode.getAttribute('count');
                    numberFormats = numberFormats || {};
                    numberFormats[formatType] = numberFormats[formatType] || {};
                    numberFormats[formatType][length] = numberFormats[formatType][length] || {};
                    numberFormats[formatType][length][type] = numberFormats[formatType][length][type] || {};
                    numberFormats[formatType][length][type][count] = numberFormats[formatType][length][type][count] || patternNode.textContent;
                });
            });
            finder("/ldml/numbers/" + formatType + "Formats[@numberSystem = '" + numberSystemId + "']/" + formatType + "FormatLength[not(@type)]/" + formatType + "Format/pattern").forEach(function (patternNode) {
                numberFormats = numberFormats || {};
                numberFormats[formatType] = numberFormats[formatType] || {};
                numberFormats[formatType].default = numberFormats[formatType].default || patternNode.textContent;
            });
            finder("/ldml/numbers/" + formatType + "Formats[@numberSystem = '" + numberSystemId + "']/unitPattern").forEach(function (unitPatternNode) {
                var count = unitPatternNode.getAttribute('count');
                numberFormats = numberFormats || {};
                numberFormats[formatType] = numberFormats[formatType] || {};
                numberFormats[formatType][count] = numberFormats[formatType][count] || unitPatternNode.textContent;
            });
        });

        finder("/ldml/numbers/currencyFormats[@numberSystem = '" + numberSystemId + "']/currencySpacing").forEach(function (currencySpacingNode) {
            numberFormats = numberFormats || {};
            numberFormats.currency = numberFormats.currency || {};
            numberFormats.currency.currencySpacing = numberFormats.currency.currencySpacing || {};

            ['before', 'after'].forEach(function (place) {
                var placeData = numberFormats.currency.currencySpacing[place + 'Currency'] = numberFormats.currency.currencySpacing[place + 'Currency'] || {};

                ['currencyMatch', 'surroundingMatch', 'insertBetween'].forEach(function (spacingPropertyName) {
                    var match = xpath.select(place + "Currency/" + spacingPropertyName, currencySpacingNode);
                    if (match.length > 0) {
                        numberFormats.currency.currencySpacing[place + 'Currency'][spacingPropertyName] = match[0].textContent;
                    }
                });

                ['currencyMatch', 'surroundingMatch'].forEach(function (spacingPropertyName) {
                    if (placeData[spacingPropertyName]) {
                        placeData[spacingPropertyName] = unicoderegexp.expandCldrUnicodeSetIdToCharacterClass(placeData[spacingPropertyName]);
                    }
                });
            });
        });

        return numberFormats;
    },

    extractDefaultNumberSystemId: function (localeId) {
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            defaultNumberSystemId;
        finder('/ldml/numbers/defaultNumberingSystem').forEach(function (defaultNumberingSystemNode) {
            defaultNumberSystemId = defaultNumberSystemId || defaultNumberingSystemNode.textContent;
        });
        return defaultNumberSystemId;
    },

    extractUnitPatterns: function (localeId) {
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            unitPatterns = {};
        finder("/ldml/units/unitLength/unit/unitPattern").forEach(function (unitPatternNode) {
            var unitNode = unitPatternNode.parentNode,
                unitLength = unitNode.parentNode.getAttribute('type'),
                unitId = normalizeProperty(unitNode.getAttribute('type'));
            unitPatterns[unitLength] = unitPatterns[unitLength] || {};
            unitPatterns[unitLength].unit = unitPatterns[unitLength].unit || {};
            unitPatterns[unitLength].unit[unitId] = unitPatterns[unitLength].unit[unitId] || {};
            var count = unitPatternNode.getAttribute('count');
            unitPatterns[unitLength].unit[unitId][count] = unitPatterns[unitLength].unit[unitId][count] || unitPatternNode.textContent;
        });
        finder("/ldml/units/unitLength/compoundUnit/compoundUnitPattern").forEach(function (compoundUnitPatternNode) {
            var compoundUnitNode = compoundUnitPatternNode.parentNode,
                unitLength = compoundUnitNode.parentNode.getAttribute('type'),
                compoundUnitId = compoundUnitNode.getAttribute('type');

            unitPatterns[unitLength].compoundUnit = unitPatterns[unitLength].compoundUnit || {};
            unitPatterns[unitLength].compoundUnit[compoundUnitId] = compoundUnitPatternNode.textContent;
        });
        return unitPatterns;
    },

    extractDelimiters: function (localeId) {
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            delimiters = {};
        finder("/ldml/delimiters/*").forEach(function (delimiterNode) {
            var type = delimiterNode.nodeName;
            delimiters[type] = delimiters[type] || delimiterNode.textContent;
        });
        return delimiters;
    },

    extractListPatterns: function (localeId) {
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            listPatterns = {};
        finder("/ldml/listPatterns/listPattern/listPatternPart").forEach(function (listPatternPartNode) {
            var listPatternTypeAttribute = listPatternPartNode.parentNode.getAttribute('type'),
                type = listPatternTypeAttribute ? normalizeProperty(listPatternTypeAttribute) : 'default',
                part = listPatternPartNode.getAttribute('type');
            listPatterns[type] = listPatterns[type] || {};
            listPatterns[type][part] = listPatterns[type][part] || listPatternPartNode.textContent;
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
            var typeAttr = exemplarCharactersNode.getAttribute('type'),
                type = typeAttr || 'default';
            characters.exemplar[type] = characters.exemplar[type] || exemplarCharactersNode.textContent.replace(/^\[|\]$/g, '').split(" ");
        });
        finder("/ldml/characters/ellipsis").forEach(function (ellipsisNode) {
            var type = ellipsisNode.getAttribute('type');
            characters.ellipsis[type] = characters.ellipsis[type] || ellipsisNode.textContent;
        });
        finder("/ldml/characters/moreInformation").forEach(function (moreInformationNode) {
            characters.moreInformation = characters.moreInformation || moreInformationNode.textContent;
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
                    "substring(@locales, string-length(@locales) - string-length(' " + subLocaleId + "') + 1) = ' " + subLocaleId + "'",
                pluralRulesNodes = xpath.select("/supplementalData/plurals/pluralRules[" + matchLocalesXPathExpr + "]", document),
                cldrPluralRuleSet = new CldrPluralRuleSet();
            if (pluralRulesNodes.length > 0) {
                xpath.select("pluralRule", pluralRulesNodes[0]).forEach(function (pluralRuleNode) {
                    cldrPluralRuleSet.addRule(pluralRuleNode.textContent, pluralRuleNode.getAttribute('count'));
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
            var type = CldrRbnfRuleSet.getSafeRendererName(rbnfRuleNode.parentNode.getAttribute('type')),
                value = rbnfRuleNode.getAttribute('value');
            cldrRbnfRuleSetByType[type] = cldrRbnfRuleSetByType[type] || new CldrRbnfRuleSet({type: type});
            if (!cldrRbnfRuleSetByType[type].ruleByValue[value]) {
                var radixAttribute = rbnfRuleNode.getAttribute('radix');
                cldrRbnfRuleSetByType[type].ruleByValue[value] = {
                    value: value,
                    rbnf: rbnfRuleNode.textContent.replace(/;$/, '').replace(/←/g, '<').replace(/→/g, '>'),
                    radix: radixAttribute
                };
            }
        });
        var isAddedByType = {},
            typesToAdd = types ? [].concat(types) : Object.keys(cldrRbnfRuleSetByType),
            rbnfFunctionByType = {
                renderNumber: String // Provide a (bad) default number rendering implementation to avoid #13
            };
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

        xpath.select('/supplementalData/numberingSystems/numberingSystem', document).forEach(function (numberingSystemNode) {
            var numberSystemId = numberingSystemNode.getAttribute('id');
            if (numberingSystemNode.getAttribute('type') === 'numeric') {
                digitsByNumberSystemId[numberSystemId] = numberingSystemNode.getAttribute('digits').split(/(?:)/);
            } else {
                // type='algorithmic'
                var rulesAttributeFragments = numberingSystemNode.getAttribute('rules').split('/'),
                    sourceLocaleId = rulesAttributeFragments.length === 3 ? normalizeLocaleId(rulesAttributeFragments[0]) : 'root',
                    ruleType = CldrRbnfRuleSet.getSafeRendererName(rulesAttributeFragments[rulesAttributeFragments.length - 1]);
                digitsByNumberSystemId[numberSystemId] = ruleType; // A string value means "use this rbnf renderer for the digits"
            }
        }, this);
        return digitsByNumberSystemId;
    },

    extractLayout: function (localeId) {
        var finder = this.createFinder(this.getPrioritizedDocumentsForLocale(localeId, 'main')),
            layout = {};
        finder("/ldml/layout/*/*").forEach(function (leafNode) {
            var type = leafNode.nodeName,
                parentType = leafNode.parentNode.nodeName;
            layout[parentType] = layout[parentType] || {};
            layout[parentType][type] = layout[parentType][type] || leafNode.textContent;
        });
        return layout;
    },

    extractTerritories: function () {
        var finder = this.createFinder([this.getDocument(Path.resolve(this.cldrPath, 'common', 'supplemental', 'supplementalData.xml'))]);

        var territoryInfoByTerritoryId = {};
        finder("/supplementalData/codeMappings/territoryCodes").forEach(function (territoryCodeNode) {
            var type = territoryCodeNode.getAttribute('type');
            var numericCode = territoryCodeNode.getAttribute('numeric');
            var alpha3Code = territoryCodeNode.getAttribute('alpha3');

            var countryInfo = {
                alpha2Code: type // ISO 3166-1 alpha-2
            };

            if (alpha3Code) {
                // ISO 3166-1 alpha-3
                countryInfo.alpha3Code = alpha3Code;
            }

            if (numericCode) {
                // UN M.49 / ISO-3166-1 numeric-3
                // A numeric code may be reused by another country, e.g. Zaire and the DRC both have numeric code 180, but only the DRC currently exists
                // Entries without a numeric code are few, which are usually exceptional reservations in ISO 3166-1 alpha-2. Example: IC, Canary Islands
                countryInfo.numericCode = numericCode;
            }

            territoryInfoByTerritoryId[type] = countryInfo;
        });

        return territoryInfoByTerritoryId;
    },

    extractTerritoryContainmentGroups: function () {
        var finder = this.createFinder([this.getDocument(Path.resolve(this.cldrPath, 'common', 'supplemental', 'supplementalData.xml'))]);

        var territoryContainmentGroups = {};

        var isSeenByType = {};
        var parentRegionIdByType = {};

        finder("/supplementalData/territoryContainment/group").forEach(function (groupNode) {
            var type = groupNode.getAttribute('type');
            var contains = groupNode.getAttribute('contains').split(' ');

            if (!isSeenByType[type]) { // Only look at the first occurence of a 'type', the first one overrides any items after it with the same type
                isSeenByType[type] = true;

                territoryContainmentGroups[type] = {
                    type: type,
                    contains: contains
                };

                contains.forEach(function (id) {
                    parentRegionIdByType[id] = type;
                });
            }
        });

        Object.keys(territoryContainmentGroups).forEach(function (type) {
            // Territory containment groups that are not themselves somehow linked to the root world group '001', are not exposed because they're not part of the tree structure
            if (type !== '001') {
                if (!(type in parentRegionIdByType)) {
                    delete territoryContainmentGroups[type];
                } else {
                    territoryContainmentGroups[type].parent = parentRegionIdByType[type];
                }
            }
        });

        return territoryContainmentGroups;
    },

    extractWorldInfo: function () {
        // Extract data
        var territoryInfoByTerritoryId = this.extractTerritories();
        var territoryContainmentGroups = this.extractTerritoryContainmentGroups();

        // Build convenience arrays
        var numericTerritoryIdByAlpha2Code = {};
        Object.keys(territoryInfoByTerritoryId).forEach(function (type) {
            var numericCode = territoryInfoByTerritoryId[type].numericCode;

            if (numericCode) {
                numericTerritoryIdByAlpha2Code[type] = numericCode;
            }
        });

        var containedTerritoriesByNumericTerritoryId = {};
        var containedTerritoriesByAlpha2TerritoryId = {};

        var parentRegionIdByTerritoryId = {};
        var numericRegionIdByTerritoryId = {};
        var alpha2CodeByNumericTerritoryId = {};

        // Process territory containment data, get knowledge about territories
        Object.keys(territoryContainmentGroups).forEach(function (type) {
            var group = territoryContainmentGroups[type];

            if (type in territoryInfoByTerritoryId) {
                territoryInfoByTerritoryId[type].isSubdivided = true;
            }

            if (/^\d+$/.test(type) && !(type in alpha2CodeByNumericTerritoryId)) {
                alpha2CodeByNumericTerritoryId[type] = null;
            }

            group.contains.forEach(function (id) {
                var numeric;
                if (/^\d+$/.test(id)) {
                    numeric = id;
                    if (!(id in alpha2CodeByNumericTerritoryId)) {
                        alpha2CodeByNumericTerritoryId[id] = null;
                    }
                } else {
                    if (id in numericTerritoryIdByAlpha2Code) {
                        numeric = numericTerritoryIdByAlpha2Code[id];
                        alpha2CodeByNumericTerritoryId[numeric] = id;
                    }

                    containedTerritoriesByAlpha2TerritoryId[id] = true
                }

                if (numeric !== undefined && /^\d+$/.test(type)) {
                    if (!(numeric in parentRegionIdByTerritoryId)) {
                        parentRegionIdByTerritoryId[numeric] = type;
                    }

                    if (/^[A-Z]+$/.test(id) && !(id in numericRegionIdByTerritoryId)) {
                        numericRegionIdByTerritoryId[id] = type;
                    }
                }
            });
        });

        // Remove historical regions, exceptional reservations, and other unused codes.
        Object.keys(territoryInfoByTerritoryId).forEach(function (territoryId) {
            var numeric;
            if (territoryId in numericTerritoryIdByAlpha2Code) {
                numeric = numericTerritoryIdByAlpha2Code[territoryId];
            }

            if (!containedTerritoriesByAlpha2TerritoryId[territoryId]) {
                delete numericRegionIdByTerritoryId[territoryId];
                delete territoryInfoByTerritoryId[territoryId];
            }
        });

        return {
            alpha2CodeByNumericTerritoryId: alpha2CodeByNumericTerritoryId,
            territoryInfoByTerritoryId: territoryInfoByTerritoryId,
            parentRegionIdByTerritoryId: parentRegionIdByTerritoryId,
            numericRegionIdByTerritoryId: numericRegionIdByTerritoryId
        };
    }
};

module.exports = new Cldr(Path.resolve(__dirname, '../3rdparty/cldr/'));
module.exports.load = function (cldrPath) {
    return new Cldr(cldrPath);
};
