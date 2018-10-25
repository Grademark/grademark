import { assert, expect } from 'chai';
import { analyze } from '../../lib/analyze';
import { DataFrame, IDataFrame } from 'data-forge';
import * as moment from 'moment';
import { ITrade } from '../..';

describe("analyze", () => {

    it("analysis records starting capital", () => {
        const analysis1 = analyze(1000, new DataFrame<number, ITrade>());
        expect(analysis1.startingCapital).to.eql(1000);

        const analysis2 = analyze(1200, new DataFrame<number, ITrade>());
        expect(analysis2.startingCapital).to.eql(1200);
    });

    it("analysis of zero trades has zero profit", () => {
        const analysis = analyze(1000, new DataFrame<number, ITrade>());
        expect(analysis.profit).to.eql(0);
        expect(analysis.profitPct).to.eql(0);
        expect(analysis.growth).to.eql(1);
    });

    it("analysis of zero trades has no drawdown", () => {
        const analysis = analyze(1000, new DataFrame<number, ITrade>());
        expect(analysis.maxDrawdown).to.eql(0);
        expect(analysis.maxDrawdownPct).to.eql(0);
    });

    it("analysis of zero trades has zero bar count", () => {
        const analysis = analyze(1000, new DataFrame<number, ITrade>());
        expect(analysis.barCount).to.eql(0);
    });

    it("analysis of zero trades has undefined risk", () => {
        const analysis = analyze(1000, new DataFrame<number, ITrade>());
        expect(analysis.maxRisk).to.eql(undefined);
        expect(analysis.maxRiskPct).to.eql(undefined);
    });

    it("analysis of zero trades records final capital to be the same as starting capital", () => {
        const analysis = analyze(2000, new DataFrame<number, ITrade>());
        expect(analysis.finalCapital).to.eql(2000);
    });
});
