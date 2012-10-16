var _ = require('underscore');

module.exports = function resolveAndTrimLocaleData(localeData, options) {
    if (options.locales && localeData.localeDisplayNames) {
        localeData.locales = Object.keys(localeData.localeDisplayNames).filter(function (localeId) {
            return !options.localesIncludedOnly || options.targetLocaleIds.indexOf(localeId) !== -1;
        }).map(function (localeId) {
            var nativeDisplayName = options.nativeDisplayNameByLocaleId[localeId],
                displayName = localeData.localeDisplayNames[localeId],
                obj = {
                    id: localeId,
                    displayName: displayName
                };
            if (nativeDisplayName && nativeDisplayName !== displayName) {
                obj.nativeDisplayName = nativeDisplayName;
            }
            return obj;
        });
    }
    delete localeData.localeDisplayNames;

    if (options.timeZones && localeData.timeZoneDisplayNames) {
        localeData.timeZones = Object.keys(localeData.timeZoneDisplayNames).filter(function (timeZoneId) {
            return timeZoneId in options.utcStandardOffsetSecondsByTimeZoneId && timeZoneId in options.territoryIdByTimeZoneId;
        }).map(function (timeZoneId) {
            var utcStandardOffsetSeconds = options.utcStandardOffsetSecondsByTimeZoneId[timeZoneId],
                territoryId = options.territoryIdByTimeZoneId[timeZoneId];
            return {
                id: timeZoneId,
                regionId: options.numericRegionIdByTerritoryId[territoryId] || null,
                utcStandardOffsetSeconds: utcStandardOffsetSeconds,
                displayName: localeData.timeZoneDisplayNames[timeZoneId],
                countryId: territoryId
            };
        }).sort(function (a, b) {
            return ((typeof b.utcStandardOffsetSeconds === 'number') - (typeof a.utcStandardOffsetSeconds === 'number')) ||
                a.utcStandardOffsetSeconds - b.utcStandardOffsetSeconds ||
                (a.displayName < b.displayName ? -1 : (b.displayName < a.displayName ? 1 : 0));
        });
    }
    delete localeData.timeZoneDisplayNames;

    if (options.countries && localeData.territoryDisplayNames) {
        localeData.countries = Object.keys(localeData.territoryDisplayNames).sort().filter(function (territoryId) {
            var countryInfo = options.countryInfoByTerritoryId[territoryId];
            return countryInfo && !countryInfo.isHistorical && !countryInfo.isSubdivision;
        }).sort(function (a, b) {
            return localeData.territoryDisplayNames[a] < localeData.territoryDisplayNames[b] ? -1 :
                (localeData.territoryDisplayNames[a] > localeData.territoryDisplayNames[b] ? 1 : 0);
        }).map(function (territoryId) {
            return {
                id: territoryId,
                regionId: options.numericRegionIdByTerritoryId[territoryId] || null,
                displayName: localeData.territoryDisplayNames[territoryId],
                hasTimeZones: options.numTimeZonesByTerritoryId[territoryId] > 0
            };
        });
    }

    if (options.regions && localeData.territoryDisplayNames) {
        localeData.regions = Object.keys(localeData.territoryDisplayNames).filter(function (territoryId) {
            return /^\d{3}/.test(territoryId);
        }).sort(function (a, b) {
            return localeData.territoryDisplayNames[a] < localeData.territoryDisplayNames[b] ? -1 :
                (localeData.territoryDisplayNames[a] > localeData.territoryDisplayNames[b] ? 1 : 0);
        }).map(function (territoryId) {
            return {
                id: territoryId,
                displayName: localeData.territoryDisplayNames[territoryId]
            };
        });
    }
    delete localeData.territoryDisplayNames;

    if (options.currencies) {
        localeData.currencies = Object.keys(localeData.currencyDisplayNames).sort(function (a, b) {
            return localeData.currencyDisplayNames[a] < localeData.currencyDisplayNames[b] ? -1 :
                (localeData.currencyDisplayNames[a] > localeData.currencyDisplayNames[b] ? 1 : 0);
        }).map(function (currencyId) {
            return _.extend({
                id: currencyId,
                displayName: localeData.currencyDisplayNames[currencyId]
            }, localeData.currencyDisplayNamesCount[currencyId]);
        });
    }
    delete localeData.currencyDisplayNames;
    delete localeData.currencyDisplayNamesCount;

    if (options.scripts) {
        localeData.scripts = Object.keys(localeData.scriptDisplayNames).sort(function (a, b) {
            return localeData.scriptDisplayNames[a] < localeData.scriptDisplayNames[b] ? -1 :
                (localeData.scriptDisplayNames[a] > localeData.scriptDisplayNames[b] ? 1 : 0);
        }).map(function (scriptId) {
            return {
                id: scriptId,
                displayName: localeData.scriptDisplayNames[scriptId]
            };
        });
    }
    delete localeData.scriptDisplayNames;

    Object.keys(localeData.calendars).forEach(function (calendarId) {
        if (options.dateFormats) {
            if (localeData.calendars[calendarId].dateTimePatterns && localeData.calendars[calendarId].defaultDateTimePatternName) {
                localeData.calendars[calendarId].defaultDateTimePattern = localeData.calendars[calendarId].dateTimePatterns[localeData.defaultDateTimePatternName];
            }

            if (localeData.calendars[calendarId].dateFormats) {
                ['short', 'medium', 'long', 'full'].forEach(function (length) {
                    if (localeData.calendars[calendarId].dateTimePatterns) {
                        localeData.calendars[calendarId].dateFormats.basic[length + 'DateTime'] = localeData.calendars[calendarId].dateTimePatterns[length]
                            .replace(/\{0\}/g, localeData.calendars[calendarId].dateFormats.basic[length + 'Time'])
                            .replace(/\{1\}/g, localeData.calendars[calendarId].dateFormats.basic[length + 'Date']);
                    }
                });
            }
            // Inspired by date_parts_order in DateTime::Locale::Base:
            if (localeData.calendars[calendarId].dateFormats) {
                localeData.calendars[calendarId].datePartsOrder = localeData.calendars[calendarId].dateFormats.basic.shortDate.replace(/[^dmy]/gi, '').toLowerCase().replace(/(\w)\1+/g, "$1");
            }
        } else if (!options.dateIntervalFormats) {
            delete localeData.calendars[calendarId].dateFormats;
            delete localeData.calendars[calendarId].defaultDateTimePatternName;
            if (!options.dayNames) {
                delete localeData.calendars[calendarId].dayNames;
            }
            if (!options.monthNames) {
                delete localeData.calendars[calendarId].monthNames;
            }
            if (!options.quarterNames) {
                delete localeData.calendars[calendarId].quarterNames;
            }
            if (!options.eraNames) {
                delete localeData.calendars[calendarId].eraNames;
            }
        }

        delete localeData.calendars[calendarId].dateTimePatterns;

        if (!options.dateIntervalFormats) {
            delete localeData.calendars[calendarId].dateIntervalFormats;
            delete localeData.calendars[calendarId].dateIntervalFallbackFormat;
        }
        if (!options.fields) {
            delete localeData.calendars[calendarId].fields;
        }

        if (Object.keys(localeData.calendars[calendarId]).length === 0) {
            delete localeData.calendars[calendarId];
        }
    });

    if (Object.keys(localeData.calendars).length === 0) {
        delete localeData.calendars;
    }

    if (!options.delimiters) {
        delete localeData.delimiters;
    }

    if (!options.listPatterns) {
        delete localeData.listPatterns;
    }

    if (!options.exemplarCharacters) {
        delete localeData.exemplarCharacters;
    }

    if (!options.numberFormats) {
        delete localeData.numberSymbols;
    }

    if (!options.unitPatterns) {
        delete localeData.unitPatterns;
    }

    // Convert objects with all integral keys starting from 0 to arrays:
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
                    resultObj[key] = convert(obj[key]);
                });
                return resultObj;
            }
        } else {
            return obj;
        }
    }(localeData));

    return localeData;
};

module.exports.availableOptionNames = [
    'locales',
    'localesIncludedOnly',
    'countries',
    'regions',
    'timeZones',
    'currencies',
    'scripts',
    'fields',
    'delimiters',
    'unitPatterns',
    'listPatterns',
    'numberFormats',
    'dateFormats',
    'dateIntervalFormats',
    'dayNames',
    'monthNames',
    'quarterNames',
    'eraNames',
    'exemplarCharacters'
];
