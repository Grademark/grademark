import { assert, expect } from 'chai';
import * as Sugar from 'sugar';
import * as fs from 'fs';
import * as path from 'path';
import { IDataFrame } from 'data-forge';
import { ISerializedDataFrame } from 'data-forge/build/lib/dataframe';
import { DataFrame } from 'data-forge';
import 'data-forge-fs';

//
// TODO: Make an npm lib out of this.
// Output testing tools.
// Need to make this file independent of chai.
//

export function transformDataFrames(obj: any): any {
    if (Sugar.Object.isArray(obj)) {
        return obj.map(el => transformDataFrames(el));
    } 
    else if (typeof obj === "object") {
        if (typeof obj.getTypeCode === "function") {
            if (obj.getTypeCode() === "dataframe") {
                return transformDataFrames(obj.serialize());
            }
            else if (obj.getTypeCode() === "series") {
                return transformDataFrames(obj.toPairs()); //todo: would be good to be able to serialize a series!
            }
        }

        //todo: Must be a nice way to do this with ramda!
        const clone = Object.assign({}, obj);
        for (const key of Object.keys(clone)) {
            clone[key] = transformDataFrames(clone[key]);
        }
        return clone;
    }
    else {
        return obj;
    }
}

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
    const transformed = transformDataFrames(array); 
    const filePath = path.join(__dirname, "output", test.fullTitle() + ".json");
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(transformed, null, 4));
    }

    const expectedArray = JSON.parse(fs.readFileSync(filePath, "utf8"));;
    checkArray(transformed, expectedArray);
}

export function checkDataFrameExpectations<ValueT>(trades: IDataFrame<number, ValueT>, test: any) {
    const filePath = path.join(__dirname, "output", test.fullTitle() + ".dataframe");
    if (!fs.existsSync(filePath)) {
        writeDataFrame(filePath, trades);
    }

    const expectedTrades = readDataFrame<number, ValueT>(filePath);
    checkArray(trades.toArray(), expectedTrades.toArray());
}

export function checkObjectExpectations(obj: any, test: any) {
    const transformed = transformDataFrames(obj); 
    const filePath = path.join(__dirname, "output", test.fullTitle() + ".json");
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(transformed, null, 4));
    }

    const expectedObj = JSON.parse(fs.readFileSync(filePath, "utf8"));;
    checkObject(transformed, expectedObj);
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
            expect(el, elPath).to.eql(expected);
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
