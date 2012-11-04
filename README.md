cldr
====

A module that allows you to extract a bunch of locale-specific
information from the <a href="http://cldr.unicode.org/">Unicode
CLDR</a> (Common Localization Data Repository), including:

* Date, time, and date-time formats
* Date interval formats
* Number formats, symbols, and digits for all number systems
* Exemplar and ellipsis characters
* Day names, month names, quarter names, era names, and cyclic names
* Patterns for rendering lists of items
* Display names for languages, time zones, territories, scripts and currencies
* Plural rule functions (converted to JavaScript functions)
* Rule-based number formatting functions (converted to JavaScript functions)

The extraction code was originally written for <a
href="https://github.com/papandreou/inter">inter i18n library</a>, but can be
used on its own.

To understand the data itself, you might need to dive into the <a
href="http://www.unicode.org/reports/tr35/tr35-29.html">LDML
specification</a>, which describes the schema of the CLDR XML files.

Tested with CLDR releases 22 and 22.1.

Usage
=====

Make sure you have <a href="http://nodejs.org/">node.js</a> and <a
href="http://npmjs.org/">npm</a> installed, then run:

```
$ npm install cldr
```

Next up you need to download a <a
href="http://cldr.unicode.org/index/downloads">CLDR release</a> (look
for `core.zip`) or checkout the <a
href="http://unicode.org/repos/cldr/">Subversion repo</a>.

Now you're ready to create a node-cldr instance and take it for a
spin:

```javascript
var cldr = require('cldr')('/path/to/cldr/release');

console.log(cldr.extractTerritoryDisplayNames('fr'));
```

Output:

```
{ '142': 'Asie',
  '143': 'Asie centrale',
  '145': 'Asie occidentale',
  '150': 'Europe',
  [...]
  YT: 'Mayotte',
  ZA: 'Afrique du Sud',
  ZM: 'Zambie',
  ZW: 'Zimbabwe',
  ZZ: 'région indéterminée' }
```

Properties
==========

### cldr.localeIds ###

An array of locale ids for which data is available (656 in CLDR
release 22.1). The locale ids are "normalized" to be all lower case
with underscores separating the fragments. However, all methods that
take a locale id as a parameter will accept any casing and both `-`
and `_` as separators.

### cldr.calendarIds ###

An array of calendar ids for which data is available. In CLDR release
22.1:

```javascript
[ 'buddhist', 'chinese', 'coptic', 'dangi', 'ethioaa', 'ethiopic',
  'gregory', 'hebrew', 'indian', 'islamic','islamicc', 'iso8601',
  'japanese', 'persian', 'roc' ]
```

### cldr.numberSystemIds ###

An array of number system ids for which data is available. In CLDR
release 22.1:

```javascript
[ 'arab', 'arabext', 'armn', 'armnlow', 'bali', 'beng', 'brah',
  'cakm', 'cham', 'deva', 'ethi', 'finance', 'fullwide', 'geor',
  'grek', 'greklow', 'gujr', 'guru', 'hanidec', 'hans', 'hansfin',
  'hant', 'hantfin', 'hebr', 'java', 'jpan', 'jpanfin', 'kali',
  'khmr', 'knda', 'lana', 'lanatham', 'laoo', 'latn', 'lepc',
  'limb', 'mlym', 'mong', 'mtei', 'mymr', 'mymrshan', 'native',
  'nkoo', 'olck', 'orya', 'osma', 'roman', 'romanlow', 'saur',
  'shrd', 'sora', 'sund', 'takr', 'talu', 'taml', 'tamldec',
  'telu', 'thai', 'tibt', 'traditio', 'vaii' ]
```

Methods
=======

All the data extraction methods are synchronous, which means that XML
documents that haven't already been loaded will be loaded using
`fs.readFileSync`. The reasoning behind this is that the API would be
awkward if all the extraction methods had to take callbacks. Also,
`node-cldr` is unlikely to be used in a setting where performance is
critical. However, if for some reason you want to avoid the
synchronous loads, you can use `cldr.load(<arrayOfLocaleIds>, cb)` to
load all the needed data in parallel before starting the extraction
itself. Then all the needed documents will be loaded and ready.

### cldr.extractLanguageDisplayNames(localeId='root') ###

Extract a locale ID => display name hash for a locale:

```javascript
cldr.extractLanguageDisplayNames('it').en
'inglese'
```

### cldr.extractTimeZoneDisplayNames(localeId='root') ###

Extract a time zone ID (Olson) => display name hash for a locale:

```javascript
cldr.extractTimeZoneDisplayNames('it')['Europe/Gibraltar']
'Gibilterra'
```

### cldr.extractTimeZoneFormats(localeId='root'='root') ###

Extract a hash with ICU formats for displaying information about a
time zone in a locale:

```javascript
cldr.extractTimeZoneFormats('da');
{ hour: [ '+HH.mm', '-HH.mm' ],
  gmt: 'GMT{0}',
  gmtZero: 'GMT',
  region: 'Tidszone for {0}',
  fallback: '{1} ({0})',
  fallbackRegion: 'Tidszone for {1} ({0})' }
```

### cldr.extractTerritoryDisplayNames(localeId='root') ###

Extract a territory ID => display name hash for a locale:

```javascript
cldr.extractTerritoryDisplayNames('fr').US;
'États-Unis'
```

### cldr.extractCurrencyInfoById(localeId='root') ###

Extract hash with currency ID keys mapping to currency info objects
for a locale:

```javascript
cldr.extractCurrencyInfoById('es').YUN;
{ displayName: 'dinar convertible yugoslavo',
  symbol: undefined,
  one: 'dinar convertible yugoslavo',
  other: 'dinares convertibles yugoslavos' },
```

### cldr.extractScriptDisplayNames(localeId='root') ###

Extract a script ID => display name hash for a locale:

```javascript
cldr.extractScriptDisplayNames('en_US').Arab
'Arabic'
```

### cldr.extractEraNames(localeId='root', calendarId='gregorian') ###

Extract a nested hash with era names in `wide` and `abbreviated`
formats for a calendar and locale:

```javascript
cldr.extractEraNames('es', 'gregorian');
{ wide:
   { '0': 'antes de Cristo',
     '1': 'anno Dómini' },
  abbreviated:
   { '0': 'a.C.',
     '1': 'd.C.' } }
```

### cldr.extractQuarterNames(localeId='root', calendarId='gregorian') ###

Extract a nested hash with quarter names in various formats for a calendar and locale:

```javascript
cldr.extractQuarterNames('es', 'gregorian');
{ format:
   { abbreviated: { '0': 'T1', '1': 'T2', '2': 'T3', '3': 'T4' },
     narrow: { '0': '1T', '1': '2T', '2': '3T', '3': '4T' },
     wide: { '0': '1er trimestre', '1': '2º trimestre', '2': '3er trimestre', '3': '4º trimestre' } },
  standalone:
    { abbreviated: { '0': 'Q1', '1': 'Q2', '2': 'Q3', '3': 'Q4' },
     narrow: { '0': '1T', '1': '2T', '2': '3T', '3': '4T' },
     wide: { '0': '1.er trimestre', '1': '2.º trimestre', '2': '3.er trimestre', '3': '4.º trimestre' } } }
```

### cldr.extractDayPeriods(localeId='root', calendarId='gregorian') ###

Extract a nested hash with day periods in various formats for a
calendar and locale:

```javascript
cldr.extractDayPeriods('en_GB', 'gregorian');
{ format:
   { abbreviated: { am: 'AM', pm: 'PM' },
     narrow: { am: 'a', noon: 'n', pm: 'p' },
     wide: { am: 'am', pm: 'pm', noon: 'noon' } },
  standalone:
   { abbreviated: { am: 'AM', pm: 'PM' },
     narrow: { am: 'AM', pm: 'PM' },
     wide: { am: 'AM', pm: 'PM' } } }
```

### cldr.extractCyclicNames(localeId='root', calendarId='gregorian') ###

Extract a nested hash with cyclic names for a calendar and locale
(only the `chinese` calendar contains these):

```javascript
cldr.extractCyclicNames('en_US', 'chinese').zodiacs.format.abbreviated;
{ '1': 'Rat', '2': 'Ox', '3': 'Tiger', '4': 'Rabbit', '5': 'Dragon', '6': 'Snake', '7': 'Horse', '8': 'Goat', '9': 'Monkey', '10': 'Rooster', '11': 'Dog', '12': 'Pig' }
```

### cldr.extractMonthNames(localeId='root', calendarId='gregorian') ###

Extract a nested hash with month names (in various contexts) for a
calendar and locale:

```javascript
cldr.extractMonthNames('nl', 'gregorian').format.wide;
{ '0': 'januari', '1': 'februari', '2': 'maart', '3': 'april', '4': 'mei', '5': 'juni', '6': 'juli',
  '7': 'augustus', '8': 'september', '9': 'oktober', '10': 'november', '11': 'december' }
```

### cldr.extractMonthPatterns(localeId='root', calendarId='gregorian') ###

Extract a nested hash with month patterns (in various contexts) for a
calendar and locale:

```javascript
cldr.extractMonthPatterns('nl', 'chinese');
{ format:
   { abbreviated: { leap: '{0}bis' },
     narrow: { leap: '{0}b' },
     wide: { leap: '{0}bis' } },
  numeric: { all: { leap: '{0}bis' } },
  standalone:
   { abbreviated: { leap: '{0}bis' },
     narrow: { leap: '{0}b' },
     wide: { leap: '{0}bis' } } }
```

### cldr.extractDayNames(localeId='root', calendarId='gregorian') ###

Extract a nested hash with day names (in various contexts) for a
calendar and locale:

```javascript
cldr.extractDayNames('en', 'gregorian').format.abbreviated;
{ '0': 'Sun',
  '1': 'Mon',
  '2': 'Tue',
  '3': 'Wed',
  '4': 'Thu',
  '5': 'Fri',
  '6': 'Sat' }
```

### cldr.extractFields(localeId='root', calendarId='gregorian') ###

Extract a nested hash with display names (including relative) for
various fields for a calendar and locale:

```javascript
cldr.extractFields('en', 'gregorian').month
{ displayName: 'Month',
  relative:
   { '0': 'This month',
     '1': 'Next month',
     '-1': 'Last month' } }
```

### cldr.extractDateTimePatterns(localeId='root', calendarId='gregorian') ###

Extract a hash with ICU patterns that show how to build a date-time
pattern out of a date pattern and a time pattern in various contexts
for a calendar and locale:

```javascript
cldr.extractDateTimePatterns('en', 'gregorian')
{ full: '{1} \'at\' {0}',
  long: '{1} \'at\' {0}',
  medium: '{1}, {0}',
  short: '{1}, {0}' }
```

### cldr.extractDateFormats(localeId='root', calendarId='gregorian') ###

Extract a hash of basic date formats (ICU) for a calendar and locale:

```javascript
cldr.extractDateFormats('en_GB', 'gregorian')
{ full: 'EEEE, d MMMM y',
  long: 'd MMMM y',
  medium: 'd MMM y',
  short: 'dd/MM/yyyy' }
```

### cldr.extractTimeFormats(localeId='root', calendarId='gregorian') ###

Extract a hash of basic time formats (ICU) for a given calendar and
locale:

```javascript
cldr.extractTimeFormats('en_GB', 'gregorian')
{ full: 'HH:mm:ss zzzz',
  long: 'HH:mm:ss z',
  medium: 'HH:mm:ss',
  short: 'HH:mm' }
```

### cldr.extractDateFormatItems(localeId='root', calendarId='gregorian') ###

Extract a hash of <a
href="http://www.unicode.org/reports/tr35/tr35-29.html#Date_Format_Patterns">ICU
date formats</a> for displaying dates and times at various detail
levels for a calendar and locale:

```javascript
cldr.extractDateFormatItems('en_GB', 'gregorian');
{ d: 'd',
  Ed: 'E d',
  Ehm: 'E h:mm a',
  EHm: 'E HH:mm',
  [...]
  yQQQ: 'QQQ y',
  yyMMM: 'MMM yy',
  yyyyMM: 'MM/yyyy',
  yyyyMMMM: 'MMMM y' }
```

### cldr.extractDefaultDateTimePatternName(localeId='root', calendarId='gregorian') ###

Extract the name of the default date time pattern for a locale and calendar:

```javascript
cldr.extractDefaultDateTimePatternName('en_GB', 'gregorian');
'medium'
```

### cldr.extractDateIntervalFormats(localeId='root', calendarId='gregorian') ###

Extract a nested hash with date interval display formats (ICU), keyed
by the detail level and the 'greatest difference' field for a calendar
and a locale (tip: Look for "greatest difference" in the <a
href="http://www.unicode.org/reports/tr35/tr35-29.html">LDML
spec</a>):

```javascript
cldr.extractDateIntervalFormats('en_GB', 'gregorian');
{ d: { d: 'd–d' },
  h: { a: 'h a – h a', h: 'h–h a' },
  H: { H: 'HH–HH' },
  hm: { a: 'h:mm a – h:mm a', h: 'h:mm–h:mm a', m: 'h:mm–h:mm a' },
  [...]
  yMMMEd:
   { d: 'E, d – E, d MMM y',
     M: 'E, d MMM – E, d MMM y',
     y: 'E, d MMM y – E, d MMM y' },
  yMMMM: { M: 'MMMM–MMMM y', y: 'MMMM y – MMMM y' } }
```

### cldr.extractDateIntervalFallbackFormat(localeId='root', calendarId='gregorian') ###

Extract the date interval fallback format (ICU) for a given calendar
and locale (to be used when the date interval formats don't offer a
specific format):

```javascript
cldr.extractDateIntervalFallbackFormat('en_GB', 'gregorian')
'{0} – {1}'
```

### cldr.extractNumberSymbols(localeId='root', numberSystemId='latn') ###

Extract the number symbols for a given number system and locale:

```javascript
cldr.extractNumberSymbols('en_GB', 'latn');
{ decimal: '.',
  group: ',',
  list: ';',
  percentSign: '%',
  plusSign: '+',
  minusSign: '-',
  exponential: 'E',
  perMille: '‰',
  infinity: '∞',
  nan: 'NaN' }
```

### cldr.extractNumberFormats(localeId='root', numberSystemId='latn) ###

Extract the number formats (<a
href="http://www.unicode.org/reports/tr35/tr35-29.html#Number_Format_Patterns">ICU
DecimalFormat</a>) for a given number system and locale:

```javascript
cldr.extractNumberFormats('en_GB', 'latn');
{ scientific: { default: '#E0' },
  decimal:
   { long:
      { '1000': { one: '0 thousand', other: '0 thousand' },
        '10000': { one: '00 thousand', other: '00 thousand' },
        [...]
        '100000000000000': { one: '000 trillion', other: '000 trillion' } },
     short:
      { '1000': { one: '0k', other: '0K' },
        '10000': { one: '00k', other: '00K' },
        [...]
        '100000000000000': { one: '000tn', other: '000T' } },
     default: '#,##0.###' },
  currency: { default: '¤#,##0.00', one: '{0} {1}', other: '{0} {1}' },
  percent: { default: '#,##0%' } }
```

### cldr.extractDefaultNumberSystemId(localeId='root') ###

Extract the id of the default number system for a locale:

```javascript
cldr.extractDefaultNumberSystemId('en_GB')
'latn'
cldr.extractDefaultNumberSystemId('ar')
'arab'
```

### cldr.extractUnitPatterns(localeId='root') ###

Extract the unit patterns (ICU) for a locale (to be used with a plural rule function):

```javascript
cldr.extractUnitPatterns('en_GB')
{ day: { one: '{0} day', other: '{0} days' },
  dayFuture: { one: 'In {0} day', other: 'In {0} days' },
  dayPast:
   { one: '{0} day ago',
     other: '{0} days ago' },
  hour: { one: '{0} hour', other: '{0} hours' },
  [...]
  yearPast:
   { one: '{0} year ago',
     other: '{0} years ago' } }
```

### cldr.extractDelimiters(localeId='root') ###

Extract the delimiters for a locale:

```javascript
cldr.extractDelimiters('en_GB');
{ quotationStart: '“',
  quotationEnd: '”',
  alternateQuotationStart: '‘',
  alternateQuotationEnd: '’' }
```

### cldr.extractListPatterns(localeId='root') ###

Extract the list patterns (ICU) for a locale:

```javascript
cldr.extractListPatterns('en_GB');
{ '2': '{0} and {1}',
  end: '{0} and {1}',
  middle: '{0}, {1}',
  start: '{0}, {1}' }
```

### cldr.extractCharacters(localeId='root') ###

Extract information about various character classes, ellipsis patterns etc. for a locale:
{ exemplar:
   { default: [ 'a', 'b', 'c', 'd', 'e', [...], 'x', 'y', 'z' ],
     auxiliary: [ 'á', 'à', 'ă', 'â', 'å', [...], 'ü', 'ū', 'ÿ' ],
     index: [ 'A', 'B', 'C', 'D', 'E', [...], 'X', 'Y', 'Z' ],
     punctuation: [ '\\-', '‐', '–', '—', ',', [...], '‡', '′', '″' ] },
  ellipsis: { final: '{0}…', initial: '…{0}', medial: '{0}… {1}' },
  moreInformation: '?' }

### cldr.extractPluralRuleFunction(localeId='root') ###

Extract a plural rule function for a locale (See <a
href="http://www.unicode.org/reports/tr35/tr35-29.html#Language_Plural_Rules">the
LDML spec</a> for an explanation):

```javascript
cldr.extractPluralRuleFunction('en_GB').toString()
function (n) {
    if (n === 1) return "one";
    return "other";
}
cldr.extractPluralRuleFunction('ar').toString()
function (n) {
    if (n === 0) return "zero";
    if (n === 1) return "one";
    if (n === 2) return "two";
    if (n % 100 >= 3 && n % 100 <= 10) return "few";
    if (n % 100 >= 11 && n % 100 <= 99) return "many";
    return "other";
}
```

### cldr.extractRbnfFunctionByType(localeId='root'[, types]) ###

Extracts RBNF (<a
href="http://www.unicode.org/reports/tr35/tr35-29.html#Rule-Based_Number_Formatting">rule-based
number formatting</a>) functions for a locale. The 'types' parameter
specifies the names of the functions you want (defaults to all
available), and the returned hash will contain the ones that were
found plus their dependencies.

The original function names have been converted to camelcase and
prefixed with `render`, and you need to use that naming convention
when specifying the `types` array as well.

```javascript
cldr.extractRbnfFunctionByType('en_GB').renderRomanUpper(2012);
'MMXII'
cldr.extractRbnfFunctionByType('de').renderSpelloutOrdinal(2323);
'zwei­tausend­drei­hundert­drei­und­zwanzigste'
```

Note that some of the generated functions expect to be able to call
`this.renderNumber(<number>, <icuNumberFormat>);`. If there's demand
for it, that can be made customizable, just file an issue.


### cldr.extractDigitsByNumberSystemId() ###

Extract a hash of number system id => digits array. For some exotic
number systems, 'digits' is a string starting with `render`. In that
case, use the RBNF function (see above) of that name for producing a
number.

```javascript
cldr.extractDigitsByNumberSystemId();
{ arab: [ '٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩' ],
  arabext: [ '۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹' ],
  armn: 'renderArmenianUpper',
  armnlow: 'renderArmenianLower',
  [...]
  latn: [ '0', '1', '2', '3', '4', '5', '6', '7', '8', '9' ],
  orya: [ '୦', '୧', '୨', '୩', '୪', '୫', '୬', '୭',  '୮',  '୯' ],
  [...] }
```

License
-------

node-cldr is licensed under a standard 3-clause BSD license -- see the
`LICENSE`-file for details.
