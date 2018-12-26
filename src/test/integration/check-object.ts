import { assert, expect } from 'chai';
import * as Sugar from 'sugar';

//
//TODO: Make an npm lib out of this.
//

//
// Check an array to ensure that each element matches the specification.
//
export function checkArray (array: any[], spec: any[], fieldPath: string = "") {
    expect(array.length).to.equal(spec.length);

    for (var i = 0; i < array.length; ++i) {
        var el = array[i];
        var expected = spec[i];
        var elPath = fieldPath + "[" + i + "]";
        if (Sugar.Object.isObject(el)) {
            checkObject(el, expected, elPath);
        }
        else {
            expect(el, elPath).to.deep.include(expected);
        }            
    }
};

//
// Check an object to ensure that matches a specification.
// It must contain at least the subset of elements in 'spec'.
//
export function checkObject (obj: any, spec: any, fieldPath: string = "") {
    var keysToCheck = Object.keys(spec);
    for (var i = 0; i < keysToCheck.length; ++i) {
        var key = keysToCheck[i];
        var val = obj[key];
        var expected = spec[key];
        if (val === undefined) {
            throw new Error("Missing key in array: " + key);
        }

        var valuePath = fieldPath + "." + key;
        if (Sugar.Object.isArray(val)) {
            checkArray(val, expected, valuePath);
        } 
        else if (Sugar.Object.isObject(val)) {
            checkObject(val, expected, valuePath);
        }
        else {
            expect(val, valuePath).to.eql(expected);
        }
    }
};
