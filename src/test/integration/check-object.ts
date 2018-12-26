import { assert, expect } from 'chai';
import * as Sugar from 'sugar';
import * as fs from 'fs';
import * as path from 'path';
import { IDataFrame } from 'data-forge';
import { ISerializedDataFrame } from 'data-forge/build/lib/dataframe';
import { ITrade } from '../..';
import { DataFrame } from 'data-forge';
import 'data-forge-fs';

//
// TODO: Make an npm lib out of this.
// Output testing tools.
// Need to make this file independent of chai.
//

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

export function checkDataFrameExpectations(trades: IDataFrame<number, ITrade>, test: any) {
    const filePath = path.join(__dirname, "output", test.fullTitle() + ".dataframe");
    if (!fs.existsSync(filePath)) {
        writeDataFrame(filePath, trades);
    }

    const expectedTrades = readDataFrame<number, ITrade>(filePath);
    checkArray(trades.toArray(), expectedTrades.toArray());
}

export function checkObjectExpectations(obj: any, test: any) {
    const filePath = path.join(__dirname, "output", test.fullTitle() + ".json");
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(obj, null, 4));
    }

    const expectedObj = JSON.parse(fs.readFileSync(filePath, "utf8"));;
    checkObject(obj, expectedObj);
}

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
