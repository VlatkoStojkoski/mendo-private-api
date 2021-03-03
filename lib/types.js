"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRegisterCredentials = exports.isLoginCredentials = void 0;
function isLoginCredentials(credentials) {
    const mustDefined = ['username', 'password'];
    return (mustDefined.filter((v) => credentials[v] === undefined).length === 0);
}
exports.isLoginCredentials = isLoginCredentials;
function isRegisterCredentials(credentials) {
    const mustDefined = [
        'username',
        'password',
        'email',
        'fullName',
        'city',
        'country',
        'profession',
        'institution',
    ];
    return (mustDefined.filter((v) => credentials[v] === undefined).length === 0);
}
exports.isRegisterCredentials = isRegisterCredentials;
