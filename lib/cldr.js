const Path = require('path');
const fs = require('fs');
const passError = require('passerror');
const memoizeAsync = require('memoizeasync');
const DOMParser = require('@xmldom/xmldom').DOMParser;
const xpath = require('xpath');
const seq = require('seq');
const normalizeLocaleId = require('./normalizeLocaleId');
const normalizeProperty = require('./normalizeProperty');
const convertObjectsWithIntegerKeysToArrays = require('./convertObjectsWithIntegerKeysToArrays');
const CldrPluralRuleSet = require('./CldrPluralRuleSet');
const CldrRbnfRuleSet = require('./CldrRbnfRuleSet');
const escodegen = require('escodegen');
const unicoderegexp = require('unicoderegexp');

function normalizeXPathQuery(xpathQuery) {
  const xpathQueryFragments = xpathQuery.split('/');
  for (let i = 0; i < xpathQueryFragments.length; i += 1) {
    if (
      i > 0 &&
      xpathQueryFragments[i] === '..' &&
      xpathQueryFragments[i - 1] !== '..'
    ) {
      xpathQueryFragments.splice(i - 1, 2);
      i -= 2;
    }
  }
  return xpathQueryFragments.join('/');
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
  fileNamesByTypeAndNormalizedLocaleId(type = 'main') {
    if (!this._fileNamesByTypeAndNormalizedLocaleId) {
      this._fileNamesByTypeAndNormalizedLocaleId = {};
    }
    if (
      typeof this._fileNamesByTypeAndNormalizedLocaleId[type] === 'undefined'
    ) {
      this._fileNamesByTypeAndNormalizedLocaleId[type] = {};
      let fileNames;
      try {
        fileNames = fs.readdirSync(Path.resolve(this.cldrPath, 'common', type));
      } catch (e) {
        if (e.code === 'ENOENT') {
          // Directory doesn't exist, just pretend it's empty.
          return;
        }
      }
      fileNames.forEach(function (fileName) {
        const matchFileName = fileName.match(/^(.*)\.xml$/);
        if (matchFileName) {
          this._fileNamesByTypeAndNormalizedLocaleId[type][
            normalizeLocaleId(matchFileName[1])
          ] = Path.resolve(this.cldrPath, 'common', type, fileName);
        }
      }, this);
    }
    return this._fileNamesByTypeAndNormalizedLocaleId[type];
  },

  get localeIds() {
    if (!this._localeIds) {
      this._localeIds = Object.keys(
        this.fileNamesByTypeAndNormalizedLocaleId('main')
      );
    }
    return this._localeIds;
  },

  get localeIdsSet() {
    if (!this._localeIdsSet) {
      this._localeIdsSet = new Set(this.localeIds);
    }
    return this._localeIdsSet;
  },

  checkValidLocaleId(localeId) {
    if (!this.localeIdsSet.has(normalizeLocaleId(localeId))) {
      throw new Error(`No data for locale id: ${localeId}`);
    }
  },

  get calendarIds() {
    if (!this._calendarIds) {
      this._calendarIds = [];
      xpath
        .select(
          '/ldmlBCP47/keyword/key[@name="ca"]/type',
          this.getDocument(
            Path.resolve(this.cldrPath, 'common', 'bcp47', 'calendar.xml')
          )
        )
        .forEach(function (keyNode) {
          let calendarId = keyNode.getAttribute('name');
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
      xpath
        .select(
          '/ldmlBCP47/keyword/key[@name="nu"]/type',
          this.getDocument(
            Path.resolve(this.cldrPath, 'common', 'bcp47', 'number.xml')
          )
        )
        .forEach(function (keyNode) {
          this._numberSystemIds.push(keyNode.getAttribute('name'));
        }, this);
    }
    return this._numberSystemIds;
  },

  get localesByParentLocale() {
    if (!this._localesByParentLocale) {
      this._localesByParentLocale = {};
      xpath
        .select(
          '/supplementalData/parentLocales/parentLocale',
          this.getDocument(
            Path.resolve(
              this.cldrPath,
              'common',
              'supplemental',
              'supplementalData.xml'
            )
          )
        )
        .forEach(function (parentLocaleNode) {
          this._localesByParentLocale[
            normalizeLocaleId(parentLocaleNode.getAttribute('parent'))
          ] = parentLocaleNode
            .getAttribute('locales')
            .split(' ')
            .map((localeId) => normalizeLocaleId(localeId));
        }, this);
    }
    return this._localesByParentLocale;
  },

  get windowsZonesByMapZone() {
    if (!this._windowsZonesByMapZone) {
      this._windowsZonesByMapZone = [];
      xpath
        .select(
          '/supplementalData/windowsZones/mapTimezones/mapZone',
          this.getDocument(
            Path.resolve(
              this.cldrPath,
              'common',
              'supplemental',
              'windowsZones.xml'
            )
          )
        )
        .forEach(function (keyNode) {
          keyNode
            .getAttribute('type')
            .split(/\s+/)
            .forEach(function (typeEntry) {
              this._windowsZonesByMapZone.push({
                name: typeEntry,
                territory: keyNode.getAttribute('territory'),
                timeZone: keyNode.getAttribute('other'),
              });
            }, this);
        }, this);
    }
    return this._windowsZonesByMapZone;
  },

  // Works both async and sync (omit cb):
  getDocument(fileName, cb) {
    const that = this;
    if (that.documentByFileName[fileName]) {
      if (cb) {
        process.nextTick(() => {
          cb(null, that.documentByFileName[fileName]);
        });
      } else {
        return that.documentByFileName[fileName];
      }
    } else {
      if (cb) {
        // Make sure not to load file more than once if it's being loaded when getDocument is called for the second time:
        that.memoizerByFileName[fileName] =
          that.memoizerByFileName[fileName] ||
          memoizeAsync((cb) => {
            fs.readFile(
              fileName,
              'utf-8',
              passError(cb, (xmlString) => {
                const document = new DOMParser().parseFromString(xmlString);
                that.documentByFileName[fileName] = document;
                cb(null, document);
              })
            );
          });
        that.memoizerByFileName[fileName](cb);
      } else {
        return (that.documentByFileName[
          fileName
        ] = new DOMParser().parseFromString(
          fs.readFileSync(fileName, 'utf-8')
        ));
      }
    }
  },

  resolveParentLocaleId(localeId) {
    localeId = normalizeLocaleId(localeId);
    if (!localeId) {
      return;
    }
    let parentLocaleId;
    Object.keys(this.localesByParentLocale).forEach(function (_parentLocaleId) {
      if (this.localesByParentLocale[_parentLocaleId].indexOf(localeId) > -1) {
        parentLocaleId = _parentLocaleId;
      }
    }, this);
    if (!parentLocaleId && /_[^_]+$/.test(localeId)) {
      parentLocaleId = localeId.replace(/_[^_]+$/, '');
    }
    return parentLocaleId;
  },

  extractWindowsZonesByTimeZone(timeZone) {
    if (!timeZone) {
      return;
    }
    return this.windowsZonesByMapZone.filter(
      (element) => element.timeZone.toLowerCase() === timeZone.toLowerCase()
    );
  },

  extractWindowsZonesByName(name) {
    if (!name) {
      return;
    }
    return this.windowsZonesByMapZone.filter(
      (element) => element.name.toLowerCase() === name.toLowerCase()
    );
  },

  expandLocaleIdToPrioritizedList(localeId) {
    localeId = normalizeLocaleId(localeId);
    if (!localeId) {
      return [];
    }
    const localeIds = [localeId];
    let parentLocaleId = this.resolveParentLocaleId(localeId);
    while (parentLocaleId) {
      localeIds.push(parentLocaleId);
      parentLocaleId = this.resolveParentLocaleId(parentLocaleId);
    }
    return localeIds;
  },

  getPrioritizedDocumentsForLocale(localeId, type) {
    this.checkValidLocaleId(localeId);
    const that = this;
    return that
      .expandLocaleIdToPrioritizedList(localeId)
      .concat('root')
      .map(
        (subLocaleId) =>
          that.fileNamesByTypeAndNormalizedLocaleId(type)[
            normalizeLocaleId(subLocaleId)
          ]
      )
      .filter((fileName) => !!fileName)
      .map((fileName) => that.getDocument(fileName));
  },

  preload(localeIds, cb) {
    const that = this;
    if (typeof localeIds === 'function') {
      cb = localeIds;
      localeIds = that.localeIds;
    }
    localeIds = (Array.isArray(localeIds) ? localeIds : [localeIds]).map(
      normalizeLocaleId
    );
    const neededLocaleById = { root: true };
    localeIds.forEach((localeId) => {
      that.expandLocaleIdToPrioritizedList(localeId).forEach((subLocaleId) => {
        neededLocaleById[subLocaleId] = true;
      });
    });
    const fileNames = [
      Path.resolve(that.cldrPath, 'common', 'supplemental', 'plurals.xml'),
      Path.resolve(
        that.cldrPath,
        'common',
        'supplemental',
        'numberingSystems.xml'
      ),
    ];
    Object.keys(neededLocaleById).forEach((localeId) => {
      ['main', 'rbnf'].forEach((type) => {
        const fileName = that.fileNamesByTypeAndNormalizedLocaleId(type)[
          localeId
        ];
        if (fileName) {
          fileNames.push(fileName);
        }
      });
    });
    seq(fileNames)
      .parEach(20, function (fileName) {
        that.getDocument(fileName, this);
      })
      .seq(() => {
        cb();
      })
      .catch(cb);
  },

  createFinder(prioritizedDocuments) {
    return function finder(xpathQuery) {
      const prioritizedResults = [];
      prioritizedDocuments.forEach((document, i) => {
        const resultsForLocaleDocument = xpath.select(xpathQuery, document);
        if (
          resultsForLocaleDocument.length === 0 &&
          i === prioritizedDocuments.length - 1
        ) {
          // We're in root and there were no results, look for alias elements in path:
          const queryFragments = xpathQuery.split('/');

          const poppedQueryFragments = [];
          while (queryFragments.length > 1) {
            const aliasNodes = xpath.select(
              queryFragments.join('/') + '/alias',
              document
            );
            if (aliasNodes.length > 0) {
              const aliasSpecifiedQuery = normalizeXPathQuery(
                queryFragments.join('/') +
                  '/' +
                  aliasNodes[0].getAttribute('path') +
                  '/' +
                  poppedQueryFragments.join('/')
              );
              Array.prototype.push.apply(
                prioritizedResults,
                finder(aliasSpecifiedQuery)
              );
              break;
            }
            poppedQueryFragments.unshift(queryFragments.pop());
          }
        } else {
          Array.prototype.push.apply(
            prioritizedResults,
            resultsForLocaleDocument
          );
        }
      });
      return prioritizedResults;
    };
  },

  extractLocaleDisplayPattern(localeId) {
    this.checkValidLocaleId(localeId);
    const finder = this.createFinder(
      this.getPrioritizedDocumentsForLocale(localeId, 'main')
    );

    const localeDisplayPattern = {};
    finder('/ldml/localeDisplayNames/localeDisplayPattern/*').forEach(
      (node) => {
        localeDisplayPattern[node.nodeName] = node.textContent;
      }
    );
    return localeDisplayPattern;
  },

  extractLanguageDisplayNames(localeId) {
    this.checkValidLocaleId(localeId);
    const finder = this.createFinder(
      this.getPrioritizedDocumentsForLocale(localeId, 'main')
    );

    const languageDisplayNames = {};
    finder('/ldml/localeDisplayNames/languages/language').forEach((node) => {
      const id = normalizeLocaleId(node.getAttribute('type'));
      languageDisplayNames[id] = languageDisplayNames[id] || node.textContent;
    });
    return languageDisplayNames;
  },

  extractTimeZoneDisplayNames(localeId) {
    this.checkValidLocaleId(localeId);
    const finder = this.createFinder(
      this.getPrioritizedDocumentsForLocale(localeId, 'main')
    );

    const timeZoneDisplayNames = {};
    finder('/ldml/dates/timeZoneNames/zone').forEach((zoneNode) => {
      const timeZoneId = zoneNode.getAttribute('type');

      const exemplarCityNodes = xpath.select('exemplarCity', zoneNode);

      let tzNameLocale;
      if (exemplarCityNodes.length > 0) {
        tzNameLocale = exemplarCityNodes[0].textContent;
      } else {
        const genericDisplayNameNodes = xpath.select('long/generic', zoneNode);
        if (genericDisplayNameNodes.length > 0) {
          tzNameLocale = genericDisplayNameNodes[0].textContent;
        } else {
          const longDisplayNameNodes = xpath.select('long/standard', zoneNode);
          if (longDisplayNameNodes.length > 0) {
            tzNameLocale = longDisplayNameNodes[0].textContent;
          }
        }
      }
      if (tzNameLocale) {
        timeZoneDisplayNames[timeZoneId] =
          timeZoneDisplayNames[timeZoneId] || tzNameLocale;
      }
    });
    return timeZoneDisplayNames;
  },

  extractTimeZoneFormats(localeId) {
    this.checkValidLocaleId(localeId);
    const finder = this.createFinder(
      this.getPrioritizedDocumentsForLocale(localeId, 'main')
    );

    const timeZoneFormats = {};
    [
      'hourFormat',
      'gmtFormat',
      'gmtZeroFormat',
      'regionFormat',
      'fallbackFormat',
      'fallbackRegionFormat',
    ].forEach((tagName) => {
      finder('/ldml/dates/timeZoneNames/' + tagName).forEach((node) => {
        const formatName = node.nodeName.replace(/Format$/, '');

        let value = node.textContent;
        if (formatName === 'hour') {
          value = value.split(';');
        }
        timeZoneFormats[formatName] = timeZoneFormats[formatName] || value;
      });
    });
    finder('/ldml/dates/timeZoneNames/regionFormat[@type]').forEach((node) => {
      const type = node.getAttribute('type');
      timeZoneFormats.regions = timeZoneFormats.regions || {};
      timeZoneFormats.regions[type] =
        timeZoneFormats.regions[type] || node.textContent;
    });
    return timeZoneFormats;
  },

  extractTerritoryDisplayNames(localeId) {
    this.checkValidLocaleId(localeId);
    const finder = this.createFinder(
      this.getPrioritizedDocumentsForLocale(localeId, 'main')
    );

    const territoryDisplayNames = {};
    finder('/ldml/localeDisplayNames/territories/territory').forEach(
      (territoryNode) => {
        let territoryId = territoryNode.getAttribute('type');
        const alternative = territoryNode.getAttribute('alt');
        if (alternative) {
          // Use the same format for alternative names as cldr-json (e.g. BA-alt-short)
          territoryId = `${territoryId}-alt-${alternative}`;
        }
        territoryDisplayNames[territoryId] =
          territoryDisplayNames[territoryId] || territoryNode.textContent;
      }
    );
    return territoryDisplayNames;
  },

  /**
   * Subdivisions are usually subnational administrative entities.
   * Codes follow the BCP47 standard, e.g. `usca` for California, USA.
   * Note that these codes are similar but not identical to ISO 3166-2 codes.
   * Unlike ISO 3166-2, CLDR never reuses a code.
   *
   * @param {string} localeId Locale or subdivision names
   * @returns {Object} A dictionary of subdivision codes and their names.
   *
   * @example
   * // returns 'Zealand'
   * cldr.extractSubdivisionDisplayNames('en').dk85
   */
  extractSubdivisionDisplayNames(localeId) {
    this.checkValidLocaleId(localeId);
    const finder = this.createFinder(
      this.getPrioritizedDocumentsForLocale(localeId, 'subdivisions')
    );
    const subdivisionDisplayNames = {};
    finder('/ldml/localeDisplayNames/subdivisions/subdivision').forEach(
      (node) => {
        const subdivisionId = node.getAttribute('type');
        subdivisionDisplayNames[subdivisionId] =
          subdivisionDisplayNames[subdivisionId] || node.textContent;
      }
    );
    return subdivisionDisplayNames;
  },

  /**
   * Subdivision aliases contain deprecated or alternative subdivision
   * codes. Note that the returned code may be either
   * a territory code, (such as 'cn71' => 'TW'), or a subdivision code.
   *
   * @returns {Object} A dictionary with replacement code and reason
   *
   * @example
   * // returns {replacement: 'cz71', reason: 'deprecated'}
   * cldr.extractSubdivisionAliases().czol
   *
   * // returns {replacement: 'GU', reason: 'overlong'}
   * cldr.extractSubdivisionAliases().usgu
   */
  extractSubdivisionAliases() {
    const finder = this.createFinder([
      this.getDocument(
        Path.resolve(
          this.cldrPath,
          'common',
          'supplemental',
          'supplementalMetadata.xml'
        )
      ),
    ]);

    const aliasData = {};

    finder('/supplementalData/metadata/alias/subdivisionAlias').forEach(
      (subdivisionAliasNode) => {
        const type = subdivisionAliasNode.getAttribute('type');
        aliasData[type] = {
          replacement: subdivisionAliasNode.getAttribute('replacement'),
          reason: subdivisionAliasNode.getAttribute('reason'),
        };
      }
    );

    return aliasData;
  },

  /**
   * Territory aliases contain deprecated or alternative nation/territory
   * codes.
   *
   * @returns {Object} A dictionary with replacement code and reason
   *
   * @example
   * // returns {replacement: 'MM', reason: 'deprecated'}
   * cldr.extractTerritorpAliases().BU
   */
  extractTerritoryAliases() {
    const finder = this.createFinder([
      this.getDocument(
        Path.resolve(
          this.cldrPath,
          'common',
          'supplemental',
          'supplementalMetadata.xml'
        )
      ),
    ]);

    const aliasData = {};

    finder('/supplementalData/metadata/alias/territoryAlias').forEach(
      (territoryAliasNode) => {
        const type = territoryAliasNode.getAttribute('type');
        aliasData[type] = {
          replacement: territoryAliasNode.getAttribute('replacement'),
          reason: territoryAliasNode.getAttribute('reason'),
        };
      }
    );

    return aliasData;
  },

  extractCurrencyInfoById(localeId) {
    this.checkValidLocaleId(localeId);
    const finder = this.createFinder(
      this.getPrioritizedDocumentsForLocale(localeId, 'main')
    );

    const currencyDisplayNameByCurrencyId = {};

    const currencyDisplayNameByCurrencyIdAndCount = {};

    const currencySymbolByCurrencyId = {};

    finder('/ldml/numbers/currencies/currency/displayName').forEach(
      (displayNameNode) => {
        const currencyId = displayNameNode.parentNode.getAttribute('type');

        const countAttribute = displayNameNode.getAttribute('count');
        if (countAttribute) {
          currencyDisplayNameByCurrencyIdAndCount[currencyId] =
            currencyDisplayNameByCurrencyIdAndCount[currencyId] || {};
          currencyDisplayNameByCurrencyIdAndCount[currencyId][countAttribute] =
            displayNameNode.textContent;
        } else {
          currencyDisplayNameByCurrencyId[currencyId] =
            currencyDisplayNameByCurrencyId[currencyId] ||
            displayNameNode.textContent;
        }
      }
    );

    finder('/ldml/numbers/currencies/currency/symbol').forEach((symbolNode) => {
      const currencyId = symbolNode.parentNode.getAttribute('type');
      currencySymbolByCurrencyId[currencyId] =
        currencySymbolByCurrencyId[currencyId] || symbolNode.textContent;
    });

    const currencyInfoById = {};
    Object.keys(currencyDisplayNameByCurrencyId).forEach((currencyId) => {
      currencyInfoById[currencyId] = Object.assign(
        {
          displayName: currencyDisplayNameByCurrencyId[currencyId],
          symbol: currencySymbolByCurrencyId[currencyId],
        },
        currencyDisplayNameByCurrencyIdAndCount[currencyId]
      );
    });
    return currencyInfoById;
  },

  extractScriptDisplayNames(localeId) {
    this.checkValidLocaleId(localeId);
    const finder = this.createFinder(
      this.getPrioritizedDocumentsForLocale(localeId, 'main')
    );

    const scriptDisplayNames = {};
    finder('/ldml/localeDisplayNames/scripts/script').forEach((scriptNode) => {
      const id = scriptNode.getAttribute('type');
      scriptDisplayNames[id] = scriptDisplayNames[id] || scriptNode.textContent;
    });
    return scriptDisplayNames;
  },

  extractVariantDisplayNames(localeId) {
    this.checkValidLocaleId(localeId);
    const finder = this.createFinder(
      this.getPrioritizedDocumentsForLocale(localeId, 'main')
    );

    const variantDisplayNames = {};
    finder('/ldml/localeDisplayNames/variants/variant').forEach(
      (variantNode) => {
        const id = variantNode.getAttribute('type');
        variantDisplayNames[id] =
          variantDisplayNames[id] || variantNode.textContent;
      }
    );
    return variantDisplayNames;
  },

  extractKeyTypes(localeId) {
    this.checkValidLocaleId(localeId);
    const finder = this.createFinder(
      this.getPrioritizedDocumentsForLocale(localeId, 'main')
    );

    const keyTypes = {};
    finder('/ldml/localeDisplayNames/keys/key').forEach((keyNode) => {
      const type = keyNode.getAttribute('type');
      keyTypes[type] = { displayName: keyNode.textContent };
    });
    finder('/ldml/localeDisplayNames/types/type').forEach((typeNode) => {
      const key = typeNode.getAttribute('key');

      const type = normalizeProperty(typeNode.getAttribute('type'));
      keyTypes[key] = keyTypes[key] || {};
      keyTypes[key].types = keyTypes[key].types || {};
      keyTypes[key].types[type] = typeNode.textContent;
    });
    return keyTypes;
  },

  extractMeasurementSystemNames(localeId) {
    this.checkValidLocaleId(localeId);
    const finder = this.createFinder(
      this.getPrioritizedDocumentsForLocale(localeId, 'main')
    );

    const measurementSystemNames = {};
    finder(
      '/ldml/localeDisplayNames/measurementSystemNames/measurementSystemName'
    ).forEach((measurementSystemNameNode) => {
      const id = measurementSystemNameNode.getAttribute('type');
      measurementSystemNames[id] =
        measurementSystemNames[id] || measurementSystemNameNode.textContent;
    });
    return measurementSystemNames;
  },

  extractCodePatterns(localeId) {
    this.checkValidLocaleId(localeId);
    const finder = this.createFinder(
      this.getPrioritizedDocumentsForLocale(localeId, 'main')
    );

    const codePatterns = {};
    finder('/ldml/localeDisplayNames/codePatterns/codePattern').forEach(
      (codePatternNode) => {
        const id = codePatternNode.getAttribute('type');
        codePatterns[id] = codePatterns[id] || codePatternNode.textContent;
      }
    );
    return codePatterns;
  },

  // Calendar extraction methods:

  extractEraNames(localeId, calendarId) {
    this.checkValidLocaleId(localeId);
    calendarId = calendarId || 'gregorian';
    const finder = this.createFinder(
      this.getPrioritizedDocumentsForLocale(localeId, 'main')
    );

    let eraNames;
    ['eraNames', 'eraAbbr'].forEach((eraType) => {
      const typeInOutput = { eraNames: 'wide', eraAbbr: 'abbreviated' }[
        eraType
      ];
      finder(
        "/ldml/dates/calendars/calendar[@type='" +
          calendarId +
          "']/eras/" +
          eraType +
          '/era'
      ).forEach((eraNode) => {
        const type = parseInt(eraNode.getAttribute('type'), 10);
        eraNames = eraNames || {};
        eraNames[typeInOutput] = eraNames[typeInOutput] || {};
        eraNames[typeInOutput][type] =
          eraNames[typeInOutput][type] || eraNode.textContent;
      });
    });
    return convertObjectsWithIntegerKeysToArrays(eraNames);
  },

  extractQuarterNames(localeId, calendarId) {
    this.checkValidLocaleId(localeId);
    calendarId = calendarId || 'gregorian';
    const finder = this.createFinder(
      this.getPrioritizedDocumentsForLocale(localeId, 'main')
    );

    let quarterNames;
    ['format', 'stand-alone'].forEach((quarterContext) => {
      const quarterContextCamelCase = normalizeProperty(quarterContext); // stand-alone => standAlone
      ['abbreviated', 'narrow', 'wide'].forEach((quarterWidth) => {
        finder(
          "/ldml/dates/calendars/calendar[@type='" +
            calendarId +
            "']/quarters/quarterContext[@type='" +
            quarterContext +
            "']/quarterWidth[@type='" +
            quarterWidth +
            "']/quarter"
        ).forEach((quarterNode) => {
          const quarterNo = parseInt(quarterNode.getAttribute('type'), 10) - 1;

          quarterNames = quarterNames || {};
          quarterNames[quarterContextCamelCase] =
            quarterNames[quarterContextCamelCase] || {};
          quarterNames[quarterContextCamelCase][quarterWidth] =
            quarterNames[quarterContextCamelCase][quarterWidth] || {};
          quarterNames[quarterContextCamelCase][quarterWidth][quarterNo] =
            quarterNames[quarterContextCamelCase][quarterWidth][quarterNo] ||
            quarterNode.textContent;
        });
      });
    });
    return convertObjectsWithIntegerKeysToArrays(quarterNames);
  },

  extractDayPeriods(localeId, calendarId) {
    this.checkValidLocaleId(localeId);
    calendarId = calendarId || 'gregorian';
    const finder = this.createFinder(
      this.getPrioritizedDocumentsForLocale(localeId, 'main')
    );

    let dayPeriods;
    ['format', 'stand-alone'].forEach((dayPeriodContext) => {
      const dayPeriodContextCamelCase = normalizeProperty(dayPeriodContext); // stand-alone => standAlone
      ['abbreviated', 'narrow', 'wide', 'short'].forEach((dayPeriodWidth) => {
        finder(
          "/ldml/dates/calendars/calendar[@type='" +
            calendarId +
            "']/dayPeriods/dayPeriodContext[@type='" +
            dayPeriodContext +
            "']/dayPeriodWidth[@type='" +
            dayPeriodWidth +
            "']/dayPeriod"
        ).forEach((dayPeriodNode) => {
          const type = dayPeriodNode.getAttribute('type');

          dayPeriods = dayPeriods || {};
          dayPeriods[dayPeriodContextCamelCase] =
            dayPeriods[dayPeriodContextCamelCase] || {};
          dayPeriods[dayPeriodContextCamelCase][dayPeriodWidth] =
            dayPeriods[dayPeriodContextCamelCase][dayPeriodWidth] || {};
          dayPeriods[dayPeriodContextCamelCase][dayPeriodWidth][type] =
            dayPeriods[dayPeriodContextCamelCase][dayPeriodWidth][type] ||
            dayPeriodNode.textContent;
        });
      });
    });
    return dayPeriods;
  },

  extractCyclicNames(localeId, calendarId) {
    this.checkValidLocaleId(localeId);
    calendarId = calendarId || 'gregorian';
    const finder = this.createFinder(
      this.getPrioritizedDocumentsForLocale(localeId, 'main')
    );

    let cyclicNames;
    ['dayParts', 'days', 'months', 'years', 'zodiacs'].forEach(
      (cyclicNameSet) => {
        ['format'].forEach((cyclicNameContext) => {
          ['abbreviated', 'narrow', 'wide'].forEach((cyclicNameWidth) => {
            finder(
              "/ldml/dates/calendars/calendar[@type='" +
                calendarId +
                "']/cyclicNameSets/cyclicNameSet[@type='" +
                cyclicNameSet +
                "']/cyclicNameContext[@type='" +
                cyclicNameContext +
                "']/cyclicNameWidth[@type='" +
                cyclicNameWidth +
                "']/cyclicName"
            ).forEach((cyclicNameNode) => {
              const type = cyclicNameNode.getAttribute('type');
              cyclicNames = cyclicNames || {};
              cyclicNames[cyclicNameSet] = cyclicNames[cyclicNameSet] || {};
              cyclicNames[cyclicNameSet][cyclicNameContext] =
                cyclicNames[cyclicNameSet][cyclicNameContext] || {};
              cyclicNames[cyclicNameSet][cyclicNameContext][cyclicNameWidth] =
                cyclicNames[cyclicNameSet][cyclicNameContext][
                  cyclicNameWidth
                ] || {};
              cyclicNames[cyclicNameSet][cyclicNameContext][cyclicNameWidth][
                type
              ] =
                cyclicNames[cyclicNameSet][cyclicNameContext][cyclicNameWidth][
                  type
                ] || cyclicNameNode.textContent;
            });
          });
        });
      }
    );
    return convertObjectsWithIntegerKeysToArrays(cyclicNames);
  },

  extractMonthNames(localeId, calendarId) {
    this.checkValidLocaleId(localeId);
    calendarId = calendarId || 'gregorian';
    const finder = this.createFinder(
      this.getPrioritizedDocumentsForLocale(localeId, 'main')
    );

    let monthNames;
    ['format', 'stand-alone'].forEach((monthContext) => {
      const monthContextCamelCase = normalizeProperty(monthContext); // stand-alone => standAlone
      ['abbreviated', 'narrow', 'wide'].forEach((monthWidth) => {
        finder(
          "/ldml/dates/calendars/calendar[@type='" +
            calendarId +
            "']/months/monthContext[@type='" +
            monthContext +
            "']/monthWidth[@type='" +
            monthWidth +
            "']/month"
        ).forEach((monthNode) => {
          const monthNo = parseInt(monthNode.getAttribute('type'), 10) - 1;
          monthNames = monthNames || {};
          monthNames[monthContextCamelCase] =
            monthNames[monthContextCamelCase] || {};
          monthNames[monthContextCamelCase][monthWidth] =
            monthNames[monthContextCamelCase][monthWidth] || {};
          monthNames[monthContextCamelCase][monthWidth][monthNo] =
            monthNames[monthContextCamelCase][monthWidth][monthNo] ||
            monthNode.textContent;
        });
      });
    });
    return convertObjectsWithIntegerKeysToArrays(monthNames);
  },

  extractMonthPatterns(localeId, calendarId) {
    this.checkValidLocaleId(localeId);
    calendarId = calendarId || 'gregorian';
    const finder = this.createFinder(
      this.getPrioritizedDocumentsForLocale(localeId, 'main')
    );

    let monthPatterns;
    ['format', 'numeric', 'stand-alone'].forEach((monthPatternContext) => {
      const monthPatternContextCamelCase = normalizeProperty(
        monthPatternContext
      ); // stand-alone => standAlone
      ['abbreviated', 'narrow', 'wide', 'all'].forEach((monthPatternWidth) => {
        finder(
          "/ldml/dates/calendars/calendar[@type='" +
            calendarId +
            "']/monthPatterns/monthPatternContext[@type='" +
            monthPatternContext +
            "']/monthPatternWidth[@type='" +
            monthPatternWidth +
            "']/monthPattern"
        ).forEach((monthPatternNode) => {
          const type = monthPatternNode.getAttribute('type');
          monthPatterns = monthPatterns || {};
          monthPatterns[monthPatternContextCamelCase] =
            monthPatterns[monthPatternContextCamelCase] || {};
          monthPatterns[monthPatternContextCamelCase][monthPatternWidth] =
            monthPatterns[monthPatternContextCamelCase][monthPatternWidth] ||
            {};
          monthPatterns[monthPatternContextCamelCase][monthPatternWidth][type] =
            monthPatterns[monthPatternContextCamelCase][monthPatternWidth][
              type
            ] || monthPatternNode.textContent;
        });
      });
    });
    return monthPatterns;
  },

  extractDayNames(localeId, calendarId) {
    this.checkValidLocaleId(localeId);
    calendarId = calendarId || 'gregorian';
    const finder = this.createFinder(
      this.getPrioritizedDocumentsForLocale(localeId, 'main')
    );

    const dayNoByCldrId = {
      sun: 0,
      mon: 1,
      tue: 2,
      wed: 3,
      thu: 4,
      fri: 5,
      sat: 6,
    };

    let dayNames;
    ['format', 'numeric', 'stand-alone'].forEach((dayContext) => {
      const dayContextCamelCase = normalizeProperty(dayContext); // stand-alone => standAlone
      ['abbreviated', 'narrow', 'wide', 'short'].forEach((dayWidth) => {
        finder(
          "/ldml/dates/calendars/calendar[@type='" +
            calendarId +
            "']/days/dayContext[@type='" +
            dayContext +
            "']/dayWidth[@type='" +
            dayWidth +
            "']/day"
        ).forEach((dayNode) => {
          const dayNo = dayNoByCldrId[dayNode.getAttribute('type')];
          dayNames = dayNames || {};
          dayNames[dayContextCamelCase] = dayNames[dayContextCamelCase] || {};
          dayNames[dayContextCamelCase][dayWidth] =
            dayNames[dayContextCamelCase][dayWidth] || {};
          dayNames[dayContextCamelCase][dayWidth][dayNo] =
            dayNames[dayContextCamelCase][dayWidth][dayNo] ||
            dayNode.textContent;
        });
      });
    });
    return convertObjectsWithIntegerKeysToArrays(dayNames);
  },

  extractFields(localeId) {
    this.checkValidLocaleId(localeId);
    const finder = this.createFinder(
      this.getPrioritizedDocumentsForLocale(localeId, 'main')
    );

    let fields;
    finder('/ldml/dates/fields/field/displayName').forEach(
      (fieldDisplayNameNode) => {
        const fieldName = fieldDisplayNameNode.parentNode.getAttribute('type');
        fields = fields || {};
        fields[fieldName] = fields[fieldName] || {};
        fields[fieldName].displayName =
          fields[fieldName].displayName || fieldDisplayNameNode.textContent;
      }
    );

    finder('/ldml/dates/fields/field/relative').forEach((fieldRelativeNode) => {
      const fieldName = fieldRelativeNode.parentNode.getAttribute('type');

      const type = fieldRelativeNode.getAttribute('type');
      fields = fields || {};
      fields[fieldName] = fields[fieldName] || {};
      fields[fieldName].relative = fields[fieldName].relative || {};
      fields[fieldName].relative[type] =
        fields[fieldName].relative[type] || fieldRelativeNode.textContent;
    });

    finder('/ldml/dates/fields/field/relativeTime/relativeTimePattern').forEach(
      (relativeTimePatternNode) => {
        const relativeTimeNode = relativeTimePatternNode.parentNode;

        const fieldName = relativeTimeNode.parentNode.getAttribute('type');

        const type = relativeTimeNode.getAttribute('type');

        const count = relativeTimePatternNode.getAttribute('count');
        fields = fields || {};
        fields[fieldName] = fields[fieldName] || {};
        fields[fieldName].relativeTime = fields[fieldName].relativeTime || {};
        fields[fieldName].relativeTime[type] =
          fields[fieldName].relativeTime[type] || {};
        fields[fieldName].relativeTime[type][count] =
          fields[fieldName].relativeTime[type][count] ||
          relativeTimePatternNode.textContent;
      }
    );
    return fields;
  },

  extractDateTimePatterns(localeId, calendarId) {
    this.checkValidLocaleId(localeId);
    calendarId = calendarId || 'gregorian';
    const finder = this.createFinder(
      this.getPrioritizedDocumentsForLocale(localeId, 'main')
    );

    let dateTimePatterns;
    finder(
      "/ldml/dates/calendars/calendar[@type='" +
        calendarId +
        "']/dateTimeFormats/dateTimeFormatLength/dateTimeFormat"
    ).forEach((dateTimeFormatNode) => {
      const dateTimeFormatLengthType = dateTimeFormatNode.parentNode.getAttribute(
        'type'
      );

      const patternNodes = xpath.select('pattern', dateTimeFormatNode);
      if (patternNodes.length !== 1) {
        throw new Error('Expected exactly one pattern in dateTimeFormatNode');
      }
      dateTimePatterns = dateTimePatterns || {};
      dateTimePatterns[dateTimeFormatLengthType] =
        dateTimePatterns[dateTimeFormatLengthType] ||
        patternNodes[0].textContent;
    });
    return dateTimePatterns;
  },

  extractDateOrTimeFormats(localeId, calendarId, dateOrTime) {
    this.checkValidLocaleId(localeId);
    calendarId = calendarId || 'gregorian';
    const finder = this.createFinder(
      this.getPrioritizedDocumentsForLocale(localeId, 'main')
    );

    let formats;
    finder(
      "/ldml/dates/calendars/calendar[@type='" +
        calendarId +
        "']/" +
        dateOrTime +
        'Formats/' +
        dateOrTime +
        'FormatLength/' +
        dateOrTime +
        'Format/*'
    ).forEach((patternNode) => {
      const type = patternNode.parentNode.parentNode.getAttribute('type');
      formats = formats || {};
      formats[type] = formats[type] || patternNode.textContent;
    });
    return formats;
  },

  extractDateFormats(localeId, calendarId) {
    this.checkValidLocaleId(localeId);
    return this.extractDateOrTimeFormats(localeId, calendarId, 'date');
  },

  extractTimeFormats(localeId, calendarId) {
    this.checkValidLocaleId(localeId);
    return this.extractDateOrTimeFormats(localeId, calendarId, 'time');
  },

  extractDateFormatItems(localeId, calendarId) {
    this.checkValidLocaleId(localeId);
    calendarId = calendarId || 'gregorian';
    const finder = this.createFinder(
      this.getPrioritizedDocumentsForLocale(localeId, 'main')
    );

    let dateFormatItems;
    finder(
      "/ldml/dates/calendars/calendar[@type='" +
        calendarId +
        "']/dateTimeFormats/availableFormats/dateFormatItem"
    ).forEach((dateFormatItemNode) => {
      const id = dateFormatItemNode.getAttribute('id');
      dateFormatItems = dateFormatItems || {};
      dateFormatItems[id] =
        dateFormatItems[id] || dateFormatItemNode.textContent;
    });
    return dateFormatItems;
  },

  extractDateIntervalFormats(localeId, calendarId) {
    this.checkValidLocaleId(localeId);
    calendarId = calendarId || 'gregorian';
    const finder = this.createFinder(
      this.getPrioritizedDocumentsForLocale(localeId, 'main')
    );

    let dateIntervalFormats;
    finder(
      "/ldml/dates/calendars/calendar[@type='" +
        calendarId +
        "']/dateTimeFormats/intervalFormats/intervalFormatItem"
    ).forEach((intervalFormatItemNode) => {
      const dateIntervalFormat = {};
      for (let i = 0; i < intervalFormatItemNode.childNodes.length; i += 1) {
        const greatestDifferenceNode = intervalFormatItemNode.childNodes[i];
        if (greatestDifferenceNode.nodeType !== 1) {
          // Skip whitespace node
          continue;
        }
        const greatestDifferenceIdAttribute = greatestDifferenceNode.getAttribute(
          'id'
        );
        const greatestDifferenceId = greatestDifferenceIdAttribute;
        dateIntervalFormat[greatestDifferenceId] =
          dateIntervalFormat[greatestDifferenceId] ||
          greatestDifferenceNode.textContent;
      }
      const id = intervalFormatItemNode.getAttribute('id');
      dateIntervalFormats = dateIntervalFormats || {};
      dateIntervalFormats[id] = dateIntervalFormats[id] || dateIntervalFormat;
    });
    return dateIntervalFormats;
  },

  extractDateIntervalFallbackFormat(localeId, calendarId) {
    this.checkValidLocaleId(localeId);
    calendarId = calendarId || 'gregorian';
    const finder = this.createFinder(
      this.getPrioritizedDocumentsForLocale(localeId, 'main')
    );

    let dateIntervalFallbackFormat;
    finder(
      "/ldml/dates/calendars/calendar[@type='" +
        calendarId +
        "']/dateTimeFormats/intervalFormats/intervalFormatFallback"
    ).forEach((intervalFormatFallbackNode) => {
      dateIntervalFallbackFormat =
        dateIntervalFallbackFormat || intervalFormatFallbackNode.textContent;
    });
    return dateIntervalFallbackFormat;
  },

  // Number extraction code:

  extractNumberSymbols(localeId, numberSystemId) {
    this.checkValidLocaleId(localeId);
    numberSystemId = numberSystemId || 'latn';
    const finder = this.createFinder(
      this.getPrioritizedDocumentsForLocale(localeId, 'main')
    );

    let numberSymbols;
    finder(
      "/ldml/numbers/symbols[@numberSystem = '" +
        numberSystemId +
        "']/*[name() != 'alias']"
    )
      .concat(finder("/ldml/numbers/symbols/*[name() != 'alias']"))
      .forEach((numberSymbolNode) => {
        const symbolId = numberSymbolNode.nodeName;
        numberSymbols = numberSymbols || {};
        numberSymbols[symbolId] =
          numberSymbols[symbolId] || numberSymbolNode.textContent;
      });
    return numberSymbols;
  },

  extractNumberFormats(localeId, numberSystemId) {
    this.checkValidLocaleId(localeId);
    numberSystemId = numberSystemId || 'latn';
    const finder = this.createFinder(
      this.getPrioritizedDocumentsForLocale(localeId, 'main')
    );

    let numberFormats;
    ['scientific', 'decimal', 'currency', 'percent'].forEach((formatType) => {
      ['full', 'long', 'medium', 'short'].forEach((length) => {
        finder(
          '/ldml/numbers/' +
            formatType +
            "Formats[@numberSystem = '" +
            numberSystemId +
            "']/" +
            formatType +
            "FormatLength[@type='" +
            length +
            "']/" +
            formatType +
            'Format/pattern'
        ).forEach((patternNode) => {
          const type = patternNode.getAttribute('type');

          const count = patternNode.getAttribute('count');
          numberFormats = numberFormats || {};
          numberFormats[formatType] = numberFormats[formatType] || {};
          numberFormats[formatType][length] =
            numberFormats[formatType][length] || {};
          numberFormats[formatType][length][type] =
            numberFormats[formatType][length][type] || {};
          numberFormats[formatType][length][type][count] =
            numberFormats[formatType][length][type][count] ||
            patternNode.textContent;
        });
      });
      finder(
        '/ldml/numbers/' +
          formatType +
          "Formats[@numberSystem = '" +
          numberSystemId +
          "']/" +
          formatType +
          'FormatLength[not(@type)]/' +
          formatType +
          'Format/pattern'
      ).forEach((patternNode) => {
        numberFormats = numberFormats || {};
        numberFormats[formatType] = numberFormats[formatType] || {};
        numberFormats[formatType].default =
          numberFormats[formatType].default || patternNode.textContent;
      });
      finder(
        '/ldml/numbers/' +
          formatType +
          "Formats[@numberSystem = '" +
          numberSystemId +
          "']/unitPattern"
      ).forEach((unitPatternNode) => {
        const count = unitPatternNode.getAttribute('count');
        numberFormats = numberFormats || {};
        numberFormats[formatType] = numberFormats[formatType] || {};
        numberFormats[formatType][count] =
          numberFormats[formatType][count] || unitPatternNode.textContent;
      });
    });

    finder(
      "/ldml/numbers/currencyFormats[@numberSystem = '" +
        numberSystemId +
        "']/currencySpacing"
    ).forEach((currencySpacingNode) => {
      numberFormats = numberFormats || {};
      numberFormats.currency = numberFormats.currency || {};
      numberFormats.currency.currencySpacing =
        numberFormats.currency.currencySpacing || {};

      ['before', 'after'].forEach((place) => {
        const placeData = (numberFormats.currency.currencySpacing[
          place + 'Currency'
        ] = numberFormats.currency.currencySpacing[place + 'Currency'] || {});

        ['currencyMatch', 'surroundingMatch', 'insertBetween'].forEach(
          (spacingPropertyName) => {
            const match = xpath.select(
              place + 'Currency/' + spacingPropertyName,
              currencySpacingNode
            );
            if (match.length > 0) {
              numberFormats.currency.currencySpacing[place + 'Currency'][
                spacingPropertyName
              ] = match[0].textContent;
            }
          }
        );

        ['currencyMatch', 'surroundingMatch'].forEach((spacingPropertyName) => {
          if (placeData[spacingPropertyName]) {
            placeData[
              spacingPropertyName
            ] = unicoderegexp.expandCldrUnicodeSetIdToCharacterClass(
              placeData[spacingPropertyName]
            );
          }
        });
      });
    });

    return numberFormats;
  },

  extractDefaultNumberSystemId(localeId) {
    this.checkValidLocaleId(localeId);
    const finder = this.createFinder(
      this.getPrioritizedDocumentsForLocale(localeId, 'main')
    );

    let defaultNumberSystemId;
    finder('/ldml/numbers/defaultNumberingSystem').forEach(
      (defaultNumberingSystemNode) => {
        defaultNumberSystemId =
          defaultNumberSystemId || defaultNumberingSystemNode.textContent;
      }
    );
    return defaultNumberSystemId;
  },

  extractUnitPatterns(localeId) {
    this.checkValidLocaleId(localeId);
    const finder = this.createFinder(
      this.getPrioritizedDocumentsForLocale(localeId, 'main')
    );

    const unitPatterns = {};
    finder('/ldml/units/unitLength/unit/unitPattern').forEach(
      (unitPatternNode) => {
        const unitNode = unitPatternNode.parentNode;

        const unitLength = unitNode.parentNode.getAttribute('type');

        const unitId = normalizeProperty(unitNode.getAttribute('type'));
        unitPatterns[unitLength] = unitPatterns[unitLength] || {};
        unitPatterns[unitLength].unit = unitPatterns[unitLength].unit || {};
        unitPatterns[unitLength].unit[unitId] =
          unitPatterns[unitLength].unit[unitId] || {};
        const count = unitPatternNode.getAttribute('count');
        unitPatterns[unitLength].unit[unitId][count] =
          unitPatterns[unitLength].unit[unitId][count] ||
          unitPatternNode.textContent;
      }
    );
    finder('/ldml/units/unitLength/compoundUnit/compoundUnitPattern').forEach(
      (compoundUnitPatternNode) => {
        const compoundUnitNode = compoundUnitPatternNode.parentNode;

        const unitLength = compoundUnitNode.parentNode.getAttribute('type');

        const compoundUnitId = compoundUnitNode.getAttribute('type');

        unitPatterns[unitLength].compoundUnit =
          unitPatterns[unitLength].compoundUnit || {};
        unitPatterns[unitLength].compoundUnit[compoundUnitId] =
          compoundUnitPatternNode.textContent;
      }
    );
    return unitPatterns;
  },

  extractDelimiters(localeId) {
    this.checkValidLocaleId(localeId);
    const finder = this.createFinder(
      this.getPrioritizedDocumentsForLocale(localeId, 'main')
    );

    const delimiters = {};
    finder('/ldml/delimiters/*').forEach((delimiterNode) => {
      const type = delimiterNode.nodeName;
      delimiters[type] = delimiters[type] || delimiterNode.textContent;
    });
    return delimiters;
  },

  extractListPatterns(localeId) {
    this.checkValidLocaleId(localeId);
    const finder = this.createFinder(
      this.getPrioritizedDocumentsForLocale(localeId, 'main')
    );

    const listPatterns = {};
    finder('/ldml/listPatterns/listPattern/listPatternPart').forEach(
      (listPatternPartNode) => {
        const listPatternTypeAttribute = listPatternPartNode.parentNode.getAttribute(
          'type'
        );

        const type = listPatternTypeAttribute
          ? normalizeProperty(listPatternTypeAttribute)
          : 'default';

        const part = listPatternPartNode.getAttribute('type');
        listPatterns[type] = listPatterns[type] || {};
        listPatterns[type][part] =
          listPatterns[type][part] || listPatternPartNode.textContent;
      }
    );
    return listPatterns;
  },

  extractCharacters(localeId) {
    this.checkValidLocaleId(localeId);
    const finder = this.createFinder(
      this.getPrioritizedDocumentsForLocale(localeId, 'main')
    );

    const characters = {
      exemplar: {},
      ellipsis: {},
    };
    finder('/ldml/characters/exemplarCharacters').forEach(
      (exemplarCharactersNode) => {
        const typeAttr = exemplarCharactersNode.getAttribute('type');

        const type = typeAttr || 'default';
        characters.exemplar[type] =
          characters.exemplar[type] ||
          exemplarCharactersNode.textContent.replace(/^\[|\]$/g, '').split(' ');
      }
    );
    finder('/ldml/characters/ellipsis').forEach((ellipsisNode) => {
      const type = ellipsisNode.getAttribute('type');
      characters.ellipsis[type] =
        characters.ellipsis[type] || ellipsisNode.textContent;
    });
    finder('/ldml/characters/moreInformation').forEach(
      (moreInformationNode) => {
        characters.moreInformation =
          characters.moreInformation || moreInformationNode.textContent;
      }
    );
    return characters;
  },

  /**
   * @param {string} localeId
   * @param {string} cardinalOrOrdinal - 'cardinal' or 'ordinal'
   * @returns {CldrPluralRuleSet} A set of plural rules
   */
  _extractPluralRules(localeId, cardinalOrOrdinal) {
    this.checkValidLocaleId(localeId);
    const that = this;

    const document = that.getDocument(
      Path.resolve(
        that.cldrPath,
        'common',
        'supplemental',
        cardinalOrOrdinal === 'ordinal' ? 'ordinals.xml' : 'plurals.xml'
      )
    );

    const subLocaleIds = that.expandLocaleIdToPrioritizedList(localeId);

    let pluralRules = new CldrPluralRuleSet();
    for (let i = 0; i < subLocaleIds.length; i += 1) {
      const subLocaleId = subLocaleIds[i];

      const matchLocalesXPathExpr =
        "@locales = '" +
        subLocaleId +
        "' or " +
        "starts-with(@locales, '" +
        subLocaleId +
        "') or " +
        "contains(@locales, ' " +
        subLocaleId +
        " ') or " +
        "substring(@locales, string-length(@locales) - string-length(' " +
        subLocaleId +
        "') + 1) = ' " +
        subLocaleId +
        "'";

      const pluralRulesNodes = xpath.select(
        '/supplementalData/plurals/pluralRules[' + matchLocalesXPathExpr + ']',
        document
      );

      const cldrPluralRuleSet = new CldrPluralRuleSet();
      if (pluralRulesNodes.length > 0) {
        xpath
          .select('pluralRule', pluralRulesNodes[0])
          .forEach((pluralRuleNode) => {
            cldrPluralRuleSet.addRule(
              pluralRuleNode.textContent,
              pluralRuleNode.getAttribute('count')
            );
          });
        pluralRules = cldrPluralRuleSet;
        break;
      }
    }
    return pluralRules;
  },

  _extractPluralRuleAst(localeId, cardinalOrOrdinal) {
    this.checkValidLocaleId(localeId);
    return this._extractPluralRules(
      localeId,
      cardinalOrOrdinal
    ).toJavaScriptFunctionBodyAst();
  },

  extractPluralClasses(localeId, cardinalOrOrdinal) {
    this.checkValidLocaleId(localeId);
    return this._extractPluralRules(
      localeId,
      cardinalOrOrdinal
    ).availablePluralClasses();
  },

  extractPluralRuleFunction(localeId, cardinalOrOrdinal) {
    this.checkValidLocaleId(localeId);
    // eslint-disable-next-line no-new-func
    return new Function(
      'val',
      escodegen.generate({
        type: 'Program',
        body: this._extractPluralRuleAst(localeId, cardinalOrOrdinal),
      })
    );
  },

  // 'types' is optional, defaults to all available
  extractRbnfFunctionByType(localeId, types) {
    this.checkValidLocaleId(localeId);
    const cardinalPluralRuleAst = this._extractPluralRuleAst(
      localeId,
      'cardinal'
    );
    const ordinalPluralRuleAst = this._extractPluralRuleAst(
      localeId,
      'ordinal'
    );
    const finder = this.createFinder(
      this.getPrioritizedDocumentsForLocale(localeId, 'rbnf')
    );

    const cldrRbnfRuleSetByType = {};
    for (const rbnfRuleNode of finder(
      '/ldml/rbnf/rulesetGrouping/ruleset/rbnfrule'
    )) {
      const type = CldrRbnfRuleSet.getSafeRendererName(
        rbnfRuleNode.parentNode.getAttribute('type')
      );

      const value = rbnfRuleNode.getAttribute('value');
      cldrRbnfRuleSetByType[type] =
        cldrRbnfRuleSetByType[type] ||
        new CldrRbnfRuleSet({
          type,
          cardinalPluralRuleAst,
          ordinalPluralRuleAst,
        });
      if (!cldrRbnfRuleSetByType[type].ruleByValue[value]) {
        const radixAttribute = rbnfRuleNode.getAttribute('radix');
        cldrRbnfRuleSetByType[type].ruleByValue[value] = {
          value,
          rbnf: rbnfRuleNode.textContent
            .replace(/;$/, '')
            .replace(/←/g, '<')
            .replace(/→/g, '>'),
          radix: radixAttribute,
        };
      }
    }

    const isAddedByType = {};

    const typesToAdd = types
      ? [].concat(types)
      : Object.keys(cldrRbnfRuleSetByType);

    const defaultNumberingSystem = this.extractDefaultNumberSystemId(localeId);
    const numberingSystem = this.extractNumberingSystem(defaultNumberingSystem);
    if (numberingSystem.type === 'algorithmic') {
      typesToAdd.push(numberingSystem.rules);
    }
    const zeroCharCode = '0'.charCodeAt(0);
    const rbnfFunctionByType = {
      // Provide a (bad) default number rendering implementation to avoid #13
      renderNumber(number) {
        if (numberingSystem.type === 'numeric') {
          return String(number)
            .split(/(?:)/)
            .map((ch) => {
              return (
                numberingSystem.digits[ch.charCodeAt(0) - zeroCharCode] || ch
              );
            })
            .join('');
        } else {
          // numberingSystem.type === 'algorithmic'
          return this[numberingSystem.rules](number);
        }
      },
    };
    while (typesToAdd.length > 0) {
      const type = typesToAdd.shift();
      if (!(type in isAddedByType)) {
        isAddedByType[type] = true;
        const cldrRbnfRuleSet = cldrRbnfRuleSetByType[type];
        // Some rules aren't available in some locales (such as spellout-cardinal-financial).
        // The easiest thing is just to skip the missing ones here, even though it can produce
        // some broken function sets:
        if (cldrRbnfRuleSet) {
          const result = cldrRbnfRuleSet.toFunctionAst();
          // eslint-disable-next-line no-new-func
          rbnfFunctionByType[type] = new Function(
            'n',
            escodegen.generate({
              type: 'Program',
              body: result.functionAst.body.body,
            })
          );
          Array.prototype.push.apply(typesToAdd, result.dependencies);
        }
      }
    }
    return rbnfFunctionByType;
  },

  extractNumberingSystem(numberingSystemId) {
    const document = this.getDocument(
      Path.resolve(
        this.cldrPath,
        'common',
        'supplemental',
        'numberingSystems.xml'
      )
    );

    const numberingSystemNode = xpath.select1(
      `/supplementalData/numberingSystems/numberingSystem[@id="${numberingSystemId}"]`,
      document
    );

    if (!numberingSystemNode) {
      throw new Error(`Unknown numbering system: ${numberingSystemId}`);
    }
    const type = numberingSystemNode.getAttribute('type');
    const numberingSystem = {
      type,
    };
    if (type === 'numeric') {
      numberingSystem.digits = numberingSystemNode
        .getAttribute('digits')
        .split(/(?:)/u);
    } else {
      // type='algorithmic'
      const rulesAttributeFragments = numberingSystemNode
        .getAttribute('rules')
        .split('/');

      numberingSystem.rules = CldrRbnfRuleSet.getSafeRendererName(
        rulesAttributeFragments[rulesAttributeFragments.length - 1]
      );
      if (rulesAttributeFragments.length > 1) {
        // Eg. [ "zh", "SpelloutRules", "spellout-numbering-days" ]
        numberingSystem.locale = rulesAttributeFragments[0];
      }
    }
    return numberingSystem;
  },

  // Deprecated
  extractDigitsByNumberSystemId() {
    const document = this.getDocument(
      Path.resolve(
        this.cldrPath,
        'common',
        'supplemental',
        'numberingSystems.xml'
      )
    );

    const digitsByNumberSystemId = {};

    xpath
      .select('/supplementalData/numberingSystems/numberingSystem', document)
      .forEach((numberingSystemNode) => {
        const numberSystemId = numberingSystemNode.getAttribute('id');
        if (numberingSystemNode.getAttribute('type') === 'numeric') {
          digitsByNumberSystemId[
            numberSystemId
          ] = numberingSystemNode.getAttribute('digits').split(/(?:)/u);
        } else {
          // type='algorithmic'
          const rulesAttributeFragments = numberingSystemNode
            .getAttribute('rules')
            .split('/');

          const ruleType = CldrRbnfRuleSet.getSafeRendererName(
            rulesAttributeFragments[rulesAttributeFragments.length - 1]
          );
          digitsByNumberSystemId[numberSystemId] = ruleType; // A string value means "use this rbnf renderer for the digits"
        }
      }, this);
    return digitsByNumberSystemId;
  },

  extractLayout(localeId) {
    this.checkValidLocaleId(localeId);
    const finder = this.createFinder(
      this.getPrioritizedDocumentsForLocale(localeId, 'main')
    );

    const layout = {};
    for (const leafNode of finder('/ldml/layout/*/*')) {
      const type = leafNode.nodeName;

      const parentType = leafNode.parentNode.nodeName;
      layout[parentType] = layout[parentType] || {};
      layout[parentType][type] =
        layout[parentType][type] || leafNode.textContent;
    }
    return layout;
  },

  extractTerritories() {
    const finder = this.createFinder([
      this.getDocument(
        Path.resolve(
          this.cldrPath,
          'common',
          'supplemental',
          'supplementalData.xml'
        )
      ),
    ]);

    const territoryInfoByTerritoryId = {};
    for (const territoryCodeNode of finder(
      '/supplementalData/codeMappings/territoryCodes'
    )) {
      const type = territoryCodeNode.getAttribute('type');
      const numericCode = territoryCodeNode.getAttribute('numeric');
      const alpha3Code = territoryCodeNode.getAttribute('alpha3');

      const countryInfo = {
        alpha2Code: type, // ISO 3166-1 alpha-2
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
    }

    return territoryInfoByTerritoryId;
  },

  extractTerritoryInfo() {
    const finder = this.createFinder([
      this.getDocument(
        Path.resolve(
          this.cldrPath,
          'common',
          'supplemental',
          'supplementalData.xml'
        )
      ),
    ]);

    const territoryInfoByTerritoryId = {};
    for (const territoryNode of finder(
      '/supplementalData/territoryInfo/territory'
    )) {
      const territoryId = territoryNode.getAttribute('type');
      territoryInfoByTerritoryId[territoryId] = {
        id: territoryId,
        gdp: parseInt(territoryNode.getAttribute('gdp'), 10),
        literacyPercent: parseFloat(
          territoryNode.getAttribute('literacyPercent')
        ),
        population: parseInt(territoryNode.getAttribute('population'), 10),
        languages: [],
      };
    }
    for (const languagePopulationNode of finder(
      '/supplementalData/territoryInfo/territory/languagePopulation'
    )) {
      const territoryId = languagePopulationNode.parentNode.getAttribute(
        'type'
      );
      const languageInfo = {
        id: languagePopulationNode.getAttribute('type'),
        populationPercent: parseFloat(
          languagePopulationNode.getAttribute('populationPercent')
        ),
      };
      const officialStatus = languagePopulationNode.getAttribute(
        'officialStatus'
      );
      if (officialStatus) {
        languageInfo.officialStatus = officialStatus;
      }
      const writingPercent = languagePopulationNode.getAttribute(
        'writingPercent'
      );
      if (writingPercent) {
        languageInfo.writingPercent = parseFloat(writingPercent);
      }
      territoryInfoByTerritoryId[territoryId].languages.push(languageInfo);
    }
    return territoryInfoByTerritoryId;
  },

  extractTerritoryContainmentGroups() {
    const finder = this.createFinder([
      this.getDocument(
        Path.resolve(
          this.cldrPath,
          'common',
          'supplemental',
          'supplementalData.xml'
        )
      ),
    ]);

    const territoryContainmentGroups = {};

    const isSeenByType = {};
    const parentRegionIdByType = {};

    for (const groupNode of finder(
      '/supplementalData/territoryContainment/group'
    )) {
      const type = groupNode.getAttribute('type');
      const contains = groupNode.getAttribute('contains').split(' ');

      if (!isSeenByType[type]) {
        // Only look at the first occurence of a 'type', the first one overrides any items after it with the same type
        isSeenByType[type] = true;

        territoryContainmentGroups[type] = {
          type,
          contains,
        };

        contains.forEach((id) => {
          parentRegionIdByType[id] = type;
        });
      }
    }

    for (const type of Object.keys(territoryContainmentGroups)) {
      // Territory containment groups that are not themselves somehow linked to the root world group '001', are not exposed because they're not part of the tree structure
      if (!(type in parentRegionIdByType)) {
        if (type !== '001') {
          delete territoryContainmentGroups[type];
        }
      } else {
        territoryContainmentGroups[type].parent = parentRegionIdByType[type];
      }
    }

    return territoryContainmentGroups;
  },

  extractSubdivisionContainmentGroups() {
    const finder = this.createFinder([
      this.getDocument(
        Path.resolve(
          this.cldrPath,
          'common',
          'supplemental',
          'subdivisions.xml'
        )
      ),
    ]);

    const subdivisionContainmentGroups = {};
    const parentRegionIdByType = {};

    for (const groupNode of finder(
      '/supplementalData/subdivisionContainment/subgroup'
    )) {
      const type = groupNode.getAttribute('type');
      const contains = groupNode.getAttribute('contains').split(' ');

      subdivisionContainmentGroups[type] = {
        type,
        contains,
      };

      for (const id of contains) {
        parentRegionIdByType[id] = type;
      }
    }

    for (const type of Object.keys(subdivisionContainmentGroups)) {
      if (typeof parentRegionIdByType[type] !== 'undefined') {
        subdivisionContainmentGroups[type].parent = parentRegionIdByType[type];
      }
    }

    return subdivisionContainmentGroups;
  },

  extractLanguageSupplementalData() {
    const finder = this.createFinder([
      this.getDocument(
        Path.resolve(
          this.cldrPath,
          'common',
          'supplemental',
          'supplementalData.xml'
        )
      ),
    ]);

    const languageData = {};

    for (const languageNode of finder(
      '/supplementalData/languageData/language'
    )) {
      const type = languageNode.getAttribute('type');
      const isSecondary = languageNode.getAttribute('alt') === 'secondary';
      let record;

      if (!languageData[type]) {
        languageData[type] = record = {};
      }

      if (isSecondary) {
        languageData[type].secondary = record = {};
      }

      const scriptsAttr = languageNode.getAttribute('scripts');
      if (scriptsAttr) {
        record.scripts = scriptsAttr.split(' ');
      }

      const territoriesAttr = languageNode.getAttribute('territories');
      if (territoriesAttr) {
        record.territories = territoriesAttr.split(' ');
      }
    }

    return languageData;
  },

  extractLanguageSupplementalMetadata() {
    const finder = this.createFinder([
      this.getDocument(
        Path.resolve(
          this.cldrPath,
          'common',
          'supplemental',
          'supplementalMetadata.xml'
        )
      ),
    ]);

    const languageData = {};

    for (const languageAliasNode of finder(
      '/supplementalData/metadata/alias/languageAlias'
    )) {
      const type = languageAliasNode.getAttribute('type');
      languageData[type] = {
        replacement: languageAliasNode.getAttribute('replacement'),
        reason: languageAliasNode.getAttribute('reason'),
      };
    }

    return languageData;
  },

  /**
   * Weekdata contains various week related info, grouped by territory or locale
   * Defaults are indicated by territory="001" or locale="und"
   *
   * https://www.unicode.org/reports/tr35/tr35-55/tr35-dates.html#Week_Data
   */
  extractWeekData() {
    const finder = this.createFinder([
      this.getDocument(
        Path.resolve(
          this.cldrPath,
          'common',
          'supplemental',
          'supplementalData.xml'
        )
      ),
    ]);

    const weekData = {
      minDays: [],
      firstDay: [],
      weekendStart: [],
      weekendEnd: [],
      weekOfPreference: [],
    };

    for (const minDaysNode of finder('/supplementalData/weekData/minDays')) {
      const territories = minDaysNode
        .getAttribute('territories')
        .split(/\s+/)
        .filter((x) => x);
      const count = minDaysNode.getAttribute('count');
      weekData.minDays.push({
        territories,
        count,
      });
    }

    for (const firstDayNode of finder('/supplementalData/weekData/firstDay')) {
      const territories = firstDayNode
        .getAttribute('territories')
        .split(/\s+/)
        .filter((x) => x);
      const day = firstDayNode.getAttribute('day');
      const alt = firstDayNode.getAttribute('alt');
      weekData.firstDay.push({
        territories,
        day,
        variant: alt === 'variant',
      });
    }

    for (const weekendStartNode of finder(
      '/supplementalData/weekData/weekendStart'
    )) {
      const territories = weekendStartNode
        .getAttribute('territories')
        .split(/\s+/)
        .filter((x) => x);
      const day = weekendStartNode.getAttribute('day');
      weekData.weekendStart.push({
        territories,
        day,
      });
    }

    for (const weekendEndNode of finder(
      '/supplementalData/weekData/weekendEnd'
    )) {
      const territories = weekendEndNode
        .getAttribute('territories')
        .split(/\s+/)
        .filter((x) => x);
      const day = weekendEndNode.getAttribute('day');
      weekData.weekendEnd.push({
        territories,
        day,
      });
    }

    for (const weekOfPreferenceNode of finder(
      '/supplementalData/weekData/weekOfPreference'
    )) {
      const locales = weekOfPreferenceNode.getAttribute('locales').split(/\s+/);
      const ordering = weekOfPreferenceNode.getAttribute('ordering');
      weekData.weekOfPreference.push({
        locales,
        ordering,
      });
    }

    return weekData;
  },

  extractTextToSpeechCharacterLabels(localeId) {
    this.checkValidLocaleId(localeId);
    const finder = this.createFinder(
      this.getPrioritizedDocumentsForLocale(localeId, 'annotations')
    );

    const characterLabels = {};
    for (const node of finder('/ldml/annotations/annotation[@type="tts"]')) {
      characterLabels[node.getAttribute('cp')] =
        characterLabels[node.getAttribute('cp')] || node.textContent;
    }

    return characterLabels;
  },

  extractDerivedTextToSpeechCharacterLabels(localeId) {
    this.checkValidLocaleId(localeId);
    const finder = this.createFinder(
      this.getPrioritizedDocumentsForLocale(localeId, 'annotationsDerived')
    );

    const characterLabels = {};
    for (const node of finder('/ldml/annotations/annotation[@type="tts"]')) {
      characterLabels[node.getAttribute('cp')] =
        characterLabels[node.getAttribute('cp')] || node.textContent;
    }

    return characterLabels;
  },

  extractAllTextToSpeechCharacterLabels(localeId) {
    return {
      ...this.extractDerivedTextToSpeechCharacterLabels(localeId),
      ...this.extractTextToSpeechCharacterLabels(localeId),
    };
  },
};

module.exports = new Cldr(Path.resolve(__dirname, '../3rdparty/cldr/'));
module.exports.load = (cldrPath) => new Cldr(cldrPath);
