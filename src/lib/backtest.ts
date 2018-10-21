import { ITrade } from "./trade";
import { IDataFrame, DataFrame } from 'data-forge';
import { IStrategy, IBar, IPosition } from "..";
import { assert } from "chai";

/**
 * Update an open position for a new bar.
 * 
 * @param position The position to update.
 * @param bar The current bar.
 */
function updatePosition(position: IPosition, bar: IBar): void {
    position.profit = bar.close - position.entryPrice;
    position.profitPct = (position.profit / position.entryPrice) * 100;
    position.growth = bar.close / position.entryPrice;
    position.holdingPeriod += 1;
}

/**
 * Close a position that has been exited and produce a trade.
 * 
 * @param position The position to close.
 * @param exitTime The timestamp for the bar when the position was exited.
 * @param exitPrice The price of the instrument when the position was exited.
 */
function finalizePosition(position: IPosition, exitTime: Date, exitPrice: number): ITrade {
    const profit = exitPrice - position.entryPrice;
    return {
        entryTime: position.entryTime,
        entryPrice: position.entryPrice,
        exitTime: exitTime,
        exitPrice: exitPrice,
        profit: profit,
        profitPct: (profit / position.entryPrice) * 100,
        growth: exitPrice / position.entryPrice,
        holdingPeriod: position.holdingPeriod,
    };
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

    //
    // Tracks trades that have been closed.
    //
    const completedTrades: ITrade[] = [];
    
    //
    // Status of the position at any give time.
    //
    let positionStatus: PositionStatus = PositionStatus.None;

    //
    // Tracks the currently open position, or set to null when there is no open position.
    //
    let openPosition: IPosition | null = null;

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
                assert(openPosition === null, "Expected there to be no open position initialised yet!");
                
                openPosition = {
                    entryTime: bar.time,
                    entryPrice: bar.open,
                    growth: 1,
                    profit: 0,
                    profitPct: 0,
                    holdingPeriod: 0,
                };
                positionStatus = PositionStatus.Position;
                break;

            case PositionStatus.Position:
                assert(openPosition !== null, "Expected open position to already be initialised!");

                updatePosition(openPosition!, bar);
                strategy.exitRule(openPosition!, bar, inputSeries, exitPosition);
                break;

            case PositionStatus.Exit:
                assert(openPosition !== null, "Expected open position to already be initialised!");

                const trade = finalizePosition(openPosition!, bar.time, bar.open);
                completedTrades.push(trade!);

                // Reset to no open position;
                openPosition = null;
                positionStatus = PositionStatus.None;
                break;
                
            default:
                throw new Error("Unexpectes state!");
        }
    }

    if (openPosition) {
        // Finalize open position.
        const lastBar = inputSeries.last();
        const lastTrade = finalizePosition(openPosition, lastBar.time, lastBar.close);
        completedTrades.push(lastTrade);
    }

    return new DataFrame<number, ITrade>(completedTrades);
}

