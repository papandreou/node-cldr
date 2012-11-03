// Create a memoizer for an async function
module.exports = function memoizeAsync(fn) {
    var resultArguments,
        waitingCallbacks;
    return function (cb) {
        var that = this;
        if (resultArguments) {
            process.nextTick(function () {
                cb.apply(this, resultArguments);
            });
        } else {
            if (waitingCallbacks) {
                waitingCallbacks.push(cb);
            } else {
                waitingCallbacks = [cb];
                fn(function () { // ...
                    var resultArguments = arguments;
                    waitingCallbacks.forEach(function (waitingCallback) {
                        waitingCallback.apply(this, resultArguments);
                    });
                    waitingCallbacks = null;
                });
            }
        }
    };
};
