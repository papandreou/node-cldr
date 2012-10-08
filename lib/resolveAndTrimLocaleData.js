var _ = require('underscore');

module.exports = function resolveAndTrimLocaleData(localeData, options) {
    // Convert localeData.(day|Month)Names.<context>.<width> from objects to arrays:
    ['day', 'month'].forEach(function (dayOrMonth) {
        if ((dayOrMonth + 'Names') in localeData) {
            Object.keys(localeData[dayOrMonth + 'Names']).forEach(function (context) {
                Object.keys(localeData[dayOrMonth + 'Names'][context]).forEach(function (width) {
                    var dayOrMonthArray = new Array(dayOrMonth === 'day' ? 7 : 12);
                    Object.keys(localeData[dayOrMonth + 'Names'][context][width]).forEach(function (dayOrMonthNoStr) {
                        dayOrMonthArray[parseInt(dayOrMonthNoStr, 10)] = localeData[dayOrMonth + 'Names'][context][width][dayOrMonthNoStr];
                    });
                    localeData[dayOrMonth + 'Names'][context][width] = dayOrMonthArray;
                    // Convert undefined to null so UglifyJS doesn't barf (some versions of CLDR are buggy):
                    for (var i = 0 ; i < dayOrMonthArray.length ; i += 1) {
                        localeData[dayOrMonth + 'Names'][context][width][i] = localeData[dayOrMonth + 'Names'][context][width][i] || null;
                    }
                });
            });
        }
    });

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

    if (options.dateFormats) {
        if (localeData.dateTimePatterns && localeData.defaultDateTimePatternName) {
            localeData.defaultDateTimePattern = localeData.dateTimePatterns[localeData.defaultDateTimePatternName];
        }

        if (localeData.dateFormats) {
            ['short', 'medium', 'long', 'full'].forEach(function (length) {
               localeData.dateFormats.basic[length + 'DateTime'] = localeData.dateTimePatterns[length]
                   .replace(/\{0\}/g, localeData.dateFormats.basic[length + 'Time'])
                   .replace(/\{1\}/g, localeData.dateFormats.basic[length + 'Date']);
            });
        }
        // Inspied by date_parts_order in DateTime::Locale::Base:
        localeData.datePartsOrder = localeData.dateFormats.basic.shortDate.replace(/[^dmy]/gi, '').toLowerCase().replace(/(\w)\1+/g, "$1");
    } else if (!options.dateIntervalFormats) {
        delete localeData.dateFormats;
        delete localeData.defaultDateTimePatternName;
    }
    delete localeData.dateTimePatterns;

    if (!options.delimiters) {
        delete localeData.delimiters;
    }

    if (!options.fields) {
        delete localeData.fields;
    }

    if (!options.listPatterns) {
        delete localeData.listPatterns;
    }

    if (!options.exemplarCharacters) {
        delete localeData.exemplarCharacters;
    }

    if (!options.dateIntervalFormats) {
        delete localeData.dateIntervalFormats;
        delete localeData.dateIntervalFallbackFormat;
    }

    if (!options.numberFormats) {
        delete localeData.numberSymbols;
    }

    if (!options.unitPatterns) {
        delete localeData.unitPatterns;
    }
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
    'unitPatterns',
    'numberFormats',
    'dateFormats',
    'dateIntervalFormats',
    'exemplarCharacters'
];
