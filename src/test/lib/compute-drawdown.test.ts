import { assert, expect } from 'chai';
import { computeDrawdown } from '../../lib/compute-drawdown';
import { DataFrame, IDataFrame } from 'data-forge';
import * as moment from 'dayjs';
import { ITrade } from '../..';

describe("compute drawdown", () => {

    function makeDate(dateStr: string, fmt?: string): Date {
        return moment(dateStr, fmt || "YYYY/MM/DD").toDate();
    }

    it("no trades results in just starting drawdown of zero", () => {
        const startingCapital = 1000;
        const drawdown = computeDrawdown(startingCapital, []);
        expect(drawdown.length).to.eql(1);
        expect(drawdown[0]).to.eql(0);
    });

    it("can compute drawdown for single trade with profit", () => {

        const singleTrade: ITrade = {
            entryTime: makeDate("2018/10/25"),
            entryPrice: 10,
            exitTime: makeDate("2018/10/30"),
            exitPrice: 20,
            profit: 10,
            profitPct: 100,
            growth: 2,
            holdingPeriod: 5,
            exitReason: "Sell",
        };

        const drawdown = computeDrawdown(10, [ singleTrade ]);
        expect(drawdown.length).to.eql(2);
        expect(drawdown[1]).to.eql(0);
    });

    it("can compute drawdown for single trade with loss", () => {

        const singleTrade: ITrade = {
            entryTime: makeDate("2018/10/25"),
            entryPrice: 10,
            exitTime: makeDate("2018/10/29"),
            exitPrice: 5,
            profit: -5,
            profitPct: -50,
            growth: 0.5,
            holdingPeriod: 4,
            exitReason: "Sell",
        };

        const drawdown = computeDrawdown(10, [ singleTrade ]);
        expect(drawdown.length).to.eql(2);
        expect(drawdown[1]).to.eql(-5);
    });
    
    it("can compute drawdown for multiple trades with profit", () => {

        const trades: ITrade[] = [
            {
                entryTime: makeDate("2018/10/25"),
                entryPrice: 10,
                exitTime: makeDate("2018/10/30"),
                exitPrice: 20,
                profit: 10,
                profitPct: 100,
                growth: 2,
                holdingPeriod: 5,
                exitReason: "Sell",
            },
            {
                entryTime: makeDate("2018/11/1"),
                entryPrice: 20,
                exitTime: makeDate("2018/11/10"),
                exitPrice: 60,
                profit: 40,
                profitPct: 150,
                growth: 3,
                holdingPeriod: 10,
                exitReason: "Sell",
            },
        ];

        const drawdown = computeDrawdown(10, trades);
        expect(drawdown.length).to.eql(3);
        expect(drawdown[1]).to.eql(0);
        expect(drawdown[2]).to.eql(0);
    });

    it("can compute drawdown for multiple trades with loss", () => {

        const trades: ITrade[] = [
            {
                entryTime: makeDate("2018/10/25"),
                entryPrice: 20,
                exitTime: makeDate("2018/10/30"),
                exitPrice: 10,
                profit: -10,
                profitPct: -50,
                growth: 0.5,
                holdingPeriod: 5,
                exitReason: "Sell",
            },
            {
                entryTime: makeDate("2018/11/1"),
                entryPrice: 10,
                exitTime: makeDate("2018/11/10"),
                exitPrice: 8,
                profit: -2,
                profitPct: -20,
                growth: 0.8,
                holdingPeriod: 10,
                exitReason: "Sell",
            },
        ];

        const drawdown = computeDrawdown(20, trades);
        expect(drawdown.length).to.eql(3);
        expect(drawdown[1]).to.eql(-10);
        expect(drawdown[2]).to.eql(-12);
    });

    it("can compute drawdown for multiple trades with profit and loss", () => {

        const trades: ITrade[] = [
            {
                entryTime: makeDate("2018/10/25"),
                entryPrice: 10,
                exitTime: makeDate("2018/10/30"),
                exitPrice: 20,
                profit: 10,
                profitPct: 100,
                growth: 2,
                holdingPeriod: 5,
                exitReason: "Sell",
            },
            {
                entryTime: makeDate("2018/11/1"),
                entryPrice: 20,
                exitTime: makeDate("2018/11/10"),
                exitPrice: 10,
                profit: -10,
                profitPct: -50,
                growth: 0.5,
                holdingPeriod: 10,
                exitReason: "Sell",
            },
        ];

        const drawdown = computeDrawdown(10, trades);
        expect(drawdown.length).to.eql(3);
        expect(drawdown[1]).to.eql(0);
        expect(drawdown[2]).to.eql(-10);
    });

    it("can compute drawdown for multiple trades with loss and profit", () => {

        const trades: ITrade[] = [
            {
                entryTime: makeDate("2018/10/25"),
                entryPrice: 20,
                exitTime: makeDate("2018/10/30"),
                exitPrice: 10,
                profit: -10,
                profitPct: -50,
                growth: 0.5,
                holdingPeriod: 5,
                exitReason: "Sell",
            },
            {
                entryTime: makeDate("2018/11/1"),
                entryPrice: 10,
                exitTime: makeDate("2018/11/10"),
                exitPrice: 20,
                profit: 10,
                profitPct: 100,
                growth: 2,
                holdingPeriod: 10,
                exitReason: "Sell",
            },
        ];

        const drawdown = computeDrawdown(20, trades);
        expect(drawdown.length).to.eql(3);
        expect(drawdown[1]).to.eql(-10);
        expect(drawdown[2]).to.eql(0);
    });

    it("drawdown resets on peak", () => {

        const trades: ITrade[] = [
            {
                entryTime: makeDate("2018/10/25"),
                entryPrice: 20,
                exitTime: makeDate("2018/10/30"),
                exitPrice: 10,
                profit: -10,
                profitPct: -50,
                growth: 0.5,
                holdingPeriod: 5,
                exitReason: "Sell",
            },
            {
                entryTime: makeDate("2018/11/1"),
                entryPrice: 10,
                exitTime: makeDate("2018/11/10"),
                exitPrice: 30,
                profit: 20,
                profitPct: 200,
                growth: 3,
                holdingPeriod: 10,
                exitReason: "Sell",
            },
            {
                entryTime: makeDate("2018/12/1"),
                entryPrice: 30,
                exitTime: makeDate("2018/12/5"),
                exitPrice: 15,
                profit: -15,
                profitPct: -50,
                growth: 0.5,
                holdingPeriod: 5,
                exitReason: "Sell",
            },
        ];

        const drawdown = computeDrawdown(20, trades);
        expect(drawdown.length).to.eql(4);
        expect(drawdown[1]).to.eql(-10);
        expect(drawdown[2]).to.eql(0);
        expect(drawdown[3]).to.eql(-15);
    });
});