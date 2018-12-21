import { ITrade } from "./trade";
import { IDataFrame, DataFrame } from 'data-forge';
import { IStrategy, IBar, IPosition } from "..";
import { assert } from "chai";
import { open } from "inspector";
const CBuffer = require('CBuffer');

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
function finalizePosition(position: IPosition, exitTime: Date, exitPrice: number, exitReason: string): ITrade {
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
        exitReason: exitReason,
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
export function backtest<BarT extends IBar = IBar, IndexT = number>(
    strategy: IStrategy<BarT>, 
    inputSeries: IDataFrame<IndexT, BarT>): 
        IDataFrame<number, ITrade> {

    if (inputSeries.none()) {
        throw new Error("Expect input data series to contain at last 1 bar.");
    }

    const lookbackPeriod = strategy.lookbackPeriod || 1;
    if (inputSeries.count() < lookbackPeriod) {
        throw new Error("You have less input data than your lookback period, the size of your input data should be some multiple of your lookback period.");
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

    //
    // Create a circular buffer to use for the lookback.
    //
    const lookbackBuffer = new CBuffer(lookbackPeriod);

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

    //
    // Close the current open position.
    //
    function closePosition(bar: BarT, exitPrice: number, exitReason: string) {
        const trade = finalizePosition(openPosition!, bar.time, exitPrice, exitReason);
        completedTrades.push(trade!);
        // Reset to no open position;
        openPosition = null;
        positionStatus = PositionStatus.None;
    }

    for (const bar of inputSeries) {
        lookbackBuffer.push(bar);

        if (lookbackBuffer.length < lookbackPeriod) {
            continue; // Don't invoke rules until lookback period is satisfied.
        }

        switch (+positionStatus) { //TODO: + is a work around for TS switch stmt with enum.
            case PositionStatus.None:
                strategy.entryRule(enterPosition, bar, new DataFrame<number, BarT>(lookbackBuffer.data), );
                break;

            case PositionStatus.Enter:
                assert(openPosition === null, "Expected there to be no open position initialised yet!");

                const entryPrice = bar.open;
                
                openPosition = {
                    entryTime: bar.time,
                    entryPrice: entryPrice,
                    growth: 1,
                    profit: 0,
                    profitPct: 0,
                    holdingPeriod: 0,
                };

                if (strategy.stopLoss) {
                    openPosition.stopPrice = entryPrice - strategy.stopLoss(entryPrice, bar, new DataFrame<number, BarT>(lookbackBuffer.data));
                }

                if (strategy.trailingStopLoss) {
                    openPosition.trailingStopPrice = entryPrice - strategy.trailingStopLoss(entryPrice, bar, new DataFrame<number, BarT>(lookbackBuffer.data));
                }

                if (strategy.profitTarget) {
                    openPosition.profitTarget = strategy.profitTarget(entryPrice, bar, new DataFrame<number, BarT>(lookbackBuffer.data));
                }

                positionStatus = PositionStatus.Position;
                break;

            case PositionStatus.Position:
                assert(openPosition !== null, "Expected open position to already be initialised!");

                updatePosition(openPosition!, bar);

                if (openPosition!.stopPrice !== undefined) {
                    if (bar.low <= openPosition!.stopPrice!) {
                        // Exit intrabar due to stop loss.
                        closePosition(bar, openPosition!.stopPrice!, "stop-loss");
                        break;
                    }
                }

                if (openPosition!.trailingStopPrice !== undefined) {
                    if (bar.low <= openPosition!.trailingStopPrice!) {
                        // Exit intrabar due to trailing stop loss.
                        closePosition(bar, openPosition!.trailingStopPrice!, "trailing-stop-loss");
                        break;
                    }

                    //
                    // Revaluate trailing stop loss.
                    //
                    const newTrailingStopPrice = bar.close - strategy.trailingStopLoss!(openPosition!.entryPrice, bar, new DataFrame<number, BarT>(lookbackBuffer.data));
                    if (newTrailingStopPrice > openPosition!.trailingStopPrice!) {
                        openPosition!.trailingStopPrice = newTrailingStopPrice;
                    }
                }

                if (openPosition!.profitTarget !== undefined) {
                    const exitPrice = openPosition!.entryPrice + openPosition!.profitTarget!;
                    if (bar.high >= exitPrice) {
                        // Exit intrabar due to profit target.
                        closePosition(bar, exitPrice, "profit-target");
                        break;
                    }
                }
                
                if (strategy.exitRule) {
                    strategy.exitRule(exitPosition, openPosition!, bar, new DataFrame<number, BarT>(lookbackBuffer.data));
                }
                break;

            case PositionStatus.Exit:
                assert(openPosition !== null, "Expected open position to already be initialised!");

                closePosition(bar, bar.open, "exit-rule");
                break;
                
            default:
                throw new Error("Unexpected state!");
        }
    }

    if (openPosition) {
        // Finalize open position.
        const lastBar = inputSeries.last();
        const lastTrade = finalizePosition(openPosition, lastBar.time, lastBar.close, "finalize");
        completedTrades.push(lastTrade);
    }

    return new DataFrame<number, ITrade>(completedTrades);
}

