// Convert objects with all integer keys starting from 0 to arrays and remove undefined values:
module.exports = function convertObjectsWithIntegerKeysToArrays(obj) {
  if (Array.isArray(obj)) {
    return obj.map(convertObjectsWithIntegerKeysToArrays);
  } else if (typeof obj === 'object' && obj !== null) {
    const keys = Object.keys(obj);
    if (0 in obj || 1 in obj) {
      const firstNumericKeyNumber = 0 in obj ? 0 : 1;

      let nextNumericKeyNumber = firstNumericKeyNumber + 1;
      while (nextNumericKeyNumber in obj) {
        nextNumericKeyNumber += 1;
      }
      if (
        keys.length > 0 &&
        nextNumericKeyNumber === keys.length + firstNumericKeyNumber
      ) {
        const array = [];

        let i;
        for (i = 0; i < firstNumericKeyNumber; i += 1) {
          array.push(undefined);
        }
        for (i = firstNumericKeyNumber; i < keys.length; i += 1) {
          array.push(convertObjectsWithIntegerKeysToArrays(obj[i]));
        }
        return array;
      }
    }
    const resultObj = {};
    keys.forEach((key) => {
      if (typeof obj[key] !== 'undefined') {
        resultObj[key] = convertObjectsWithIntegerKeysToArrays(obj[key]);
      }
    });
    return resultObj;
  } else {
    return obj;
  }
};
