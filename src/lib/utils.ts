const t = require('typy').default;

//
// Various shared utility functions.
//

export function isObject(v: any): boolean {
    return t(v).isObject && !isDate(v);
}

export function isFunction(v: any): v is Function {
    return t(v).isFunction;
}

export function isString(v: any): v is string {
    return t(v).isString;
}

export function isDate(v: any): v is Date {
    return Object.prototype.toString.call(v) === "[object Date]";
}

export function isBoolean(v: any): v is boolean {
    return t(v).isBoolean;
}

export function isNumber(v: any): v is number {
    return t(v).isNumber;
}

export function isArray(v: any): v is Array<any> {
    return t(v).isArray;
}

export function isUndefined(v: any): boolean {
    return v === undefined;
}
