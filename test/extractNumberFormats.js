const expect = require('unexpected');

const cldr = require('../lib/cldr');

describe('extractNumberPatterns', () => {
  it('should extract the British English patterns for latn number system correctly', () => {
    const britishNumberPatterns = cldr.extractNumberFormats('en_GB', 'latn');
    expect(britishNumberPatterns, 'to only have keys', [
      'scientific',
      'decimal',
      'currency',
      'percent',
    ]);
    expect(britishNumberPatterns.scientific, 'to only have keys', ['default']);
    expect(britishNumberPatterns.scientific.default, 'to equal', '#E0');

    expect(britishNumberPatterns.decimal, 'to only have keys', [
      'long',
      'short',
      'default',
    ]);
    expect(
      britishNumberPatterns.decimal.long,
      'to have keys',
      [1000, 10000, 100000]
    );
    expect(
      britishNumberPatterns.decimal.short,
      'to have keys',
      [1000, 10000, 100000]
    );

    expect(britishNumberPatterns.currency, 'to only have keys', [
      'default',
      'short',
      'one',
      'other',
      'currencySpacing',
    ]);
    expect(britishNumberPatterns.currency.currencySpacing, 'to equal', {
      beforeCurrency: {
        currencyMatch: /[[:^S:]&[:^Z:]]/,
        surroundingMatch:
          /[0-9²³¹¼-¾٠-٩۰-۹߀-߉०-९০-৯৴-৹੦-੯૦-૯୦-୯୲-୷௦-௲౦-౯౸-౾೦-೯൦-൵๐-๙໐-໙༠-༳၀-၉႐-႙፩-፼ᛮ-ᛰ០-៩៰-៹᠐-᠙᥆-᥏᧐-᧚᪀-᪉᪐-᪙᭐-᭙᮰-᮹᱀-᱉᱐-᱙⁰⁴-⁹₀-₉⅐-ↂↅ-↉①-⒛⓪-⓿❶-➓⳽〇〡-〩〸-〺㆒-㆕㈠-㈩㉈-㉏㉑-㉟㊀-㊉㊱-㊿꘠-꘩ꛦ-ꛯ꠰-꠵꣐-꣙꤀-꤉꧐-꧙꩐-꩙꯰-꯹０-９]/,
        insertBetween: '\xa0',
      },
      afterCurrency: {
        currencyMatch: /[[:^S:]&[:^Z:]]/,
        surroundingMatch:
          /[0-9²³¹¼-¾٠-٩۰-۹߀-߉०-९০-৯৴-৹੦-੯૦-૯୦-୯୲-୷௦-௲౦-౯౸-౾೦-೯൦-൵๐-๙໐-໙༠-༳၀-၉႐-႙፩-፼ᛮ-ᛰ០-៩៰-៹᠐-᠙᥆-᥏᧐-᧚᪀-᪉᪐-᪙᭐-᭙᮰-᮹᱀-᱉᱐-᱙⁰⁴-⁹₀-₉⅐-ↂↅ-↉①-⒛⓪-⓿❶-➓⳽〇〡-〩〸-〺㆒-㆕㈠-㈩㉈-㉏㉑-㉟㊀-㊉㊱-㊿꘠-꘩ꛦ-ꛯ꠰-꠵꣐-꣙꤀-꤉꧐-꧙꩐-꩙꯰-꯹０-９]/,
        insertBetween: '\xa0',
      },
    });
  });
});
