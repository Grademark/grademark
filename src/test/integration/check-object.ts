import { expect } from 'chai';
import * as Sugar from 'sugar';
import * as fs from 'fs';
import * as path from 'path';
import { IDataFrame } from 'data-forge';
import { DataFrame } from 'data-forge';
import 'data-forge-fs';
import { ISerializedDataFrame } from '@data-forge/serialization';
import * as moment from "moment";

export function writeDataFrame(filePath: string, dataFrame: IDataFrame<any, any>): void {
    const serializedDataFrame = dataFrame.serialize();
    const json = JSON.stringify(serializedDataFrame, null, 4);
    fs.writeFileSync(filePath, json);
}
    
export function readDataFrame<IndexT = any, ValueT = any>(filePath: string): IDataFrame<IndexT, ValueT> {
    const json = fs.readFileSync(filePath, "utf8");
    const serializedDataFrame = JSON.parse(json) as ISerializedDataFrame;
    return DataFrame.deserialize<IndexT, ValueT>(serializedDataFrame);
}

export function checkArrayExpectations<T>(array: T[], test: any) {
    const filePath = path.join(__dirname, "output", test.fullTitle() + ".json");
    if (!fs.existsSync(filePath)) {
        console.log(`Generated: ${filePath}`);
        fs.writeFileSync(filePath, JSON.stringify(array, null, 4));
    }

    // console.log("Actual:");
    // console.log(array);
    // console.log("Loaded: " + filePath);

    const expectedArray = JSON.parse(fs.readFileSync(filePath, "utf8"));;

    // console.log("Expected:");
    // console.log(expectedArray);

    checkArray(array, expectedArray);
}

export function checkObjectExpectations(obj: any, test: any) {
    const filePath = path.join(__dirname, "output", test.fullTitle() + ".json");
    if (!fs.existsSync(filePath)) {
        console.log(`Generated: ${filePath}`);
        fs.writeFileSync(filePath, JSON.stringify(obj, null, 4));
    }

    // console.log("Actual:");
    // console.log(obj);
    // console.log("Loaded: " + filePath);

    const expectedObj = JSON.parse(fs.readFileSync(filePath, "utf8"));;

    // console.log("Expected:");
    // console.log(expectedObj);

    checkObject(obj, expectedObj);
}

//
// Check an array to ensure that each element matches the specification.
//
export function checkArray (array: any[], spec: any[], fieldPath: string = "") {

    // console.log(`Checking array "${fieldPath}"`);

    expect(array.length).to.equal(spec.length);

    for (let i = 0; i < array.length; ++i) {
        const el = array[i];
        const expected = spec[i];
        const elPath = fieldPath + "[" + i + "]";
        if (Sugar.Object.isObject(el)) {
            checkObject(el, expected, elPath);
        }
        else {
            expect(el, elPath).to.eql(expected);
        }
    }
};

//
// Check an object to ensure that matches a specification.
// It must contain at least the subset of elements in 'spec'.
//
export function checkObject (obj: any, spec: any, fieldPath: string = "") {

    // console.log(`Checking object "${fieldPath}"`);

    const keysToCheck = Object.keys(spec);
    for (let i = 0; i < keysToCheck.length; ++i) {
        const key = keysToCheck[i];
        let val = obj[key];
        const expected = spec[key];
        if (val === undefined) {
            throw new Error(`Missing key in object at ${fieldPath}.${key}`);
        }

        const valuePath = fieldPath + "." + key;
        if (Sugar.Object.isArray(val)) {
            checkArray(val, expected, valuePath);
        } 
        else if (Sugar.Object.isObject(val)) {
            checkObject(val, expected, valuePath);
        }
        else {
            if (Sugar.Object.isDate(val)) {
                // Check dates by string.
                val = moment(val).toISOString();
            }
    
            // console.log(`Checking value "${valuePath}"`);

            // This would be good, but the following expectation is more useful.
            // expect(typeof(val), `Type of ${valuePath}`).to.eql(typeof(expected));
            expect(val, valuePath).to.eql(expected);
        }
    }
};
