import { ITrade } from "./trade";
import { IDataFrame, DataFrame } from 'data-forge';
import { IStrategy, IBar } from "..";
import { assert } from "chai";
import * as moment from 'moment'; //fio:

/**
 * Finalize a trade that has been exited.
 * 
 * @param trade The trade to finalize.
 * @param exitBar The data the trade was exited.
 */
function finalizeTrade(trade: ITrade, exitBar: IBar) {
    trade.exitTime = exitBar.time;
    trade.exitPrice = exitBar.open;
    trade.profit = trade.exitPrice - trade.entryPrice;
    trade.profitPct = (trade.profit / trade.entryPrice) * 100;
    trade.growth = trade.exitPrice / trade.entryPrice;
}

enum PositionStatus { // Tracks the state of the position across the trading period.
    None,
    Enter,
    Position,
    Exit,
}

/**
 * Backtest a trading strategy against a data series and generate a sequence of trades.
 */
export function backtest<IndexT = number>(strategy: IStrategy<IndexT>, inputSeries: IDataFrame<IndexT, IBar>): IDataFrame<number, ITrade> {
    if (inputSeries.none()) {
        throw new Error("Expect input data series to contain at last 1 bar.");
    }

    const completedTrades: ITrade[] = [];
    

    let positionStatus: PositionStatus = PositionStatus.None;
    let trade: ITrade | null = null;

    /**
     * User calls this function to enter a position on the instrument.
     */
    function enterPosition() {
        assert(positionStatus === PositionStatus.None, "Can only enter a position when not already in one.");

        positionStatus = PositionStatus.Enter; // Enter position next bar.
    }

    /**
     * User calls this function to exit a position on the instrument.
     */
    function exitPosition() {
        assert(positionStatus === PositionStatus.Position, "Can only exit a position when we are in a position.");

        positionStatus = PositionStatus.Exit; // Exit position next bar.
    }

    for (const bar of inputSeries) {
        switch (+positionStatus) { //TODO: + is a work around for TS switch stmt with enum.
            case PositionStatus.None:
                strategy.entryRule(bar, inputSeries, enterPosition);
                break;

            case PositionStatus.Enter:
                trade = {
                    entryTime: bar.time,
                    entryPrice: bar.open,
                    exitTime: bar.time, // Not known yet.
                    exitPrice: bar.open, // Not known yet.
                    growth: NaN,
                    profit: NaN,
                    profitPct: NaN, // TODO: Fill these out later.
                    holdingPeriod: 0,
                };
                positionStatus = PositionStatus.Position;
                break;

            case PositionStatus.Position:
                trade!.holdingPeriod += 1;
                strategy.exitRule({}, bar, inputSeries, exitPosition);
                break;

            case PositionStatus.Exit:
                finalizeTrade(trade!, bar);
                completedTrades.push(trade!);
                trade = null;
                positionStatus = PositionStatus.None;
                break;
                
            default:
                throw new Error("Unexpectes state!");
        }
    }

    if (trade) {
        // Finalize open position.
        finalizeTrade(trade, inputSeries.last());
        completedTrades.push(trade);
    }

    return new DataFrame<number, ITrade>(completedTrades);
}

