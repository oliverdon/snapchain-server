'use strict';

exports.hash = (string) => {
    // With Thanks to
    // https://raw.githubusercontent.com/darkskyapp/string-hash/master/README.md
    // Slightly modified djb2
    let hash = 5381;
    let i = string.length;
    while (i) {
        hash = (hash * 33) ^ string.charCodeAt(--i);
    }
    return hash >>> 0;
};
