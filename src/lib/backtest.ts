import { ITrade } from "./trade";
import { IDataFrame, DataFrame } from 'data-forge';
import { IStrategy, IBar, IPosition } from "..";
import { assert } from "chai";
import { IEnterPositionOptions, TradeDirection } from "./strategy";
import { isObject } from "./utils";
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
    position.growth = position.direction === TradeDirection.Long
        ? bar.close / position.entryPrice
        : position.entryPrice / bar.close;
    if (position.curStopPrice !== undefined) {
        const unitRisk = position.direction === TradeDirection.Long
            ? bar.close - position.curStopPrice
            : position.curStopPrice - bar.close;
        position.curRiskPct = (unitRisk / bar.close) * 100;
        position.curRMultiple = position.profit / unitRisk;
    }
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
    const profit = position.direction === TradeDirection.Long 
        ? exitPrice - position.entryPrice
        : position.entryPrice - exitPrice;
    let rmultiple;
    if (position.initialUnitRisk !== undefined) {
        rmultiple = profit / position.initialUnitRisk; 
    }
    return {
        direction: position.direction,
        entryTime: position.entryTime,
        entryPrice: position.entryPrice,
        exitTime: exitTime,
        exitPrice: exitPrice,
        profit: profit,
        profitPct: (profit / position.entryPrice) * 100,
        growth: position.direction === TradeDirection.Long
            ? exitPrice / position.entryPrice
            : position.entryPrice / exitPrice,
        riskPct: position.initialRiskPct,
        riskSeries: position.riskSeries,
        rmultiple: rmultiple,
        holdingPeriod: position.holdingPeriod,
        exitReason: exitReason,
        stopPrice: position.initialStopPrice,
        stopPriceSeries: position.stopPriceSeries,
        profitTarget: position.profitTarget,
    };
}

enum PositionStatus { // Tracks the state of the position across the trading period.
    None,
    Enter,
    Position,
    Exit,
}

/**
 * Options to the backtest function.
 */
export interface IBacktestOptions {
    /**
     * Enable recording of the stop price over the holding period of each trade.
     * It can be useful to enable this and visualize the stop loss over time.
     */
    recordStopPrice?: boolean;

    /**
     * Enable recording of the risk over the holding period of each trade.
     * It can be useful to enable this and visualize the risk over time.
     */
    recordRisk?: boolean;
}

/**
 * Backtest a trading strategy against a data series and generate a sequence of trades.
 */
export function backtest<InputBarT extends IBar, IndicatorBarT extends InputBarT, ParametersT, IndexT>(
    strategy: IStrategy<InputBarT, IndicatorBarT, ParametersT, IndexT>, 
    inputSeries: IDataFrame<IndexT, InputBarT>,
    options?: IBacktestOptions): 
    ITrade[] {

    if (!isObject(strategy)) {
        throw new Error("Expected 'strategy' argument to 'backtest' to be an object that defines the trading strategy to backtest.");
    }

    if (!isObject(inputSeries) && inputSeries.count() > 0) {
        throw new Error("Expected 'inputSeries' argument to 'backtest' to be a Data-Forge DataFrame that contains historical input data for backtesting.");
    }

    if (!options) {
        options = {};
    }

    if (inputSeries.none()) {
        throw new Error("Expect input data series to contain at last 1 bar.");
    }

    const lookbackPeriod = strategy.lookbackPeriod || 1;
    if (inputSeries.count() < lookbackPeriod) {
        throw new Error("You have less input data than your lookback period, the size of your input data should be some multiple of your lookback period.");
    }

    const strategyParameters = strategy.parameters || {} as ParametersT;

    let indicatorsSeries: IDataFrame<IndexT, IndicatorBarT>;

    //
    // Prepare indicators.
    //
    if (strategy.prepIndicators) {
        indicatorsSeries = strategy.prepIndicators({
            parameters: strategyParameters, 
            inputSeries: inputSeries
        });
    }
    else {
        indicatorsSeries = inputSeries as IDataFrame<IndexT, IndicatorBarT>;
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
    // Records the direction of a position/trade.
    //
    let positionDirection: TradeDirection = TradeDirection.Long;

    //
    // Records the price for conditional intrabar entry.
    //
    let conditionalEntryPrice: number | undefined;

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
    function enterPosition(options?: IEnterPositionOptions) {
        assert(positionStatus === PositionStatus.None, "Can only enter a position when not already in one.");

        positionStatus = PositionStatus.Enter; // Enter position next bar.
        positionDirection = options && options.direction || TradeDirection.Long;
        conditionalEntryPrice = options && options.entryPrice;
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
    function closePosition(bar: InputBarT, exitPrice: number, exitReason: string) {
        const trade = finalizePosition(openPosition!, bar.time, exitPrice, exitReason);
        completedTrades.push(trade!);
        // Reset to no open position;
        openPosition = null;
        positionStatus = PositionStatus.None;
    }

    for (const bar of indicatorsSeries) {
        lookbackBuffer.push(bar);

        if (lookbackBuffer.length < lookbackPeriod) {
            continue; // Don't invoke rules until lookback period is satisfied.
        }

        switch (+positionStatus) { //TODO: + is a work around for TS switch stmt with enum.
            case PositionStatus.None:
                strategy.entryRule(enterPosition, {
                    bar: bar, 
                    lookback: new DataFrame<number, IndicatorBarT>(lookbackBuffer.data), 
                    parameters: strategyParameters
                });
                break;

            case PositionStatus.Enter:
                assert(openPosition === null, "Expected there to be no open position initialised yet!");

                if (conditionalEntryPrice !== undefined) {
                    // Must breach conditional entry price before entering position.
                    if (positionDirection === TradeDirection.Long) {
                        if (bar.high < conditionalEntryPrice) {
                            break;
                        }
                    }
                    else {
                        if (bar.low > conditionalEntryPrice) {
                            break;
                        }
                    }
                }

                const entryPrice = bar.open;
                
                openPosition = {
                    direction: positionDirection,
                    entryTime: bar.time,
                    entryPrice: entryPrice,
                    growth: 1,
                    profit: 0,
                    profitPct: 0,
                    holdingPeriod: 0,
                };

                if (strategy.stopLoss) {
                    const initialStopDistance = strategy.stopLoss({
                        entryPrice: entryPrice,
                        position: openPosition,
                        bar: bar, 
                        lookback: new DataFrame<number, InputBarT>(lookbackBuffer.data), 
                        parameters: strategyParameters
                    });
                    openPosition.initialStopPrice = openPosition.direction === TradeDirection.Long
                        ? entryPrice - initialStopDistance 
                        : entryPrice + initialStopDistance;
                    openPosition.curStopPrice = openPosition.initialStopPrice;
                }

                if (strategy.trailingStopLoss) {
                    const trailingStopDistance = strategy.trailingStopLoss({
                        entryPrice: entryPrice, 
                        position: openPosition,
                        bar: bar, 
                        lookback: new DataFrame<number, InputBarT>(lookbackBuffer.data), 
                        parameters: strategyParameters
                    });
                    const trailingStopPrice = openPosition.direction === TradeDirection.Long
                        ? entryPrice - trailingStopDistance
                        : entryPrice + trailingStopDistance;
                    if (openPosition.initialStopPrice === undefined) {
                        openPosition.initialStopPrice = trailingStopPrice;
                    }
                    else {
                        openPosition.initialStopPrice = openPosition.direction === TradeDirection.Long
                            ? Math.max(openPosition.initialStopPrice, trailingStopPrice)
                            : Math.min(openPosition.initialStopPrice, trailingStopPrice);
                    }

                    openPosition.curStopPrice = openPosition.initialStopPrice;

                    if (options.recordStopPrice) {
                        openPosition.stopPriceSeries = [
                            {
                                time: bar.time,
                                value: openPosition.curStopPrice
                            },
                        ];
                    }
                }

                if (openPosition.curStopPrice !== undefined) {
                    openPosition.initialUnitRisk = openPosition.direction === TradeDirection.Long
                        ? entryPrice - openPosition.curStopPrice
                        : openPosition.curStopPrice - entryPrice;
                    openPosition.initialRiskPct = (openPosition.initialUnitRisk / entryPrice) * 100;
                    openPosition.curRiskPct = openPosition.initialRiskPct;
                    openPosition.curRMultiple = 0;

                    if (options.recordRisk) {
                        openPosition.riskSeries = [
                            {
                                time: bar.time,
                                value: openPosition.curRiskPct
                            },
                        ];
                    }
                }

                if (strategy.profitTarget) {
                    const profitDistance = strategy.profitTarget({
                        entryPrice: entryPrice, 
                        position: openPosition,
                        bar: bar, 
                        lookback: new DataFrame<number, InputBarT>(lookbackBuffer.data), 
                        parameters: strategyParameters
                    });
                    openPosition.profitTarget = openPosition.direction === TradeDirection.Long
                        ? entryPrice + profitDistance
                        : entryPrice - profitDistance;
                }

                positionStatus = PositionStatus.Position;
                break;

            case PositionStatus.Position:
                assert(openPosition !== null, "Expected open position to already be initialised!");

                if (openPosition!.curStopPrice !== undefined) {
                    if (openPosition!.direction === TradeDirection.Long) {
                        if (bar.low <= openPosition!.curStopPrice!) {
                            // Exit intrabar due to stop loss.
                            closePosition(bar, openPosition!.curStopPrice!, "stop-loss");
                            break;
                        }
                    }
                    else {
                        if (bar.high >= openPosition!.curStopPrice!) {
                            // Exit intrabar due to stop loss.
                            closePosition(bar, openPosition!.curStopPrice!, "stop-loss");
                            break;
                        }
                    }
                }

                if (strategy.trailingStopLoss !== undefined) {
                    //
                    // Revaluate trailing stop loss.
                    //
                    const trailingStopDistance = strategy.trailingStopLoss({
                        entryPrice: openPosition!.entryPrice, 
                        position: openPosition!,
                        bar: bar, 
                        lookback: new DataFrame<number, InputBarT>(lookbackBuffer.data), 
                        parameters: strategyParameters
                    });
                    
                    if (openPosition!.direction === TradeDirection.Long) {
                        const newTrailingStopPrice = bar.close - trailingStopDistance;
                        if (newTrailingStopPrice > openPosition!.curStopPrice!) {
                            openPosition!.curStopPrice = newTrailingStopPrice;
                        }
                    }
                    else {
                        const newTrailingStopPrice = bar.close + trailingStopDistance;
                        if (newTrailingStopPrice < openPosition!.curStopPrice!) {
                            openPosition!.curStopPrice = newTrailingStopPrice;
                        }
                    }

                    if (options.recordStopPrice) {
                        openPosition!.stopPriceSeries!.push({
                            time: bar.time,
                            value: openPosition!.curStopPrice!
                        });
                    }
                }

                if (openPosition!.profitTarget !== undefined) {
                    if (openPosition!.direction === TradeDirection.Long) {
                        if (bar.high >= openPosition!.profitTarget!) {
                            // Exit intrabar due to profit target.
                            closePosition(bar, openPosition!.profitTarget!, "profit-target");
                            break;
                        }
                    }
                    else {
                        if (bar.low <= openPosition!.profitTarget!) {
                            // Exit intrabar due to profit target.
                            closePosition(bar, openPosition!.profitTarget!, "profit-target");
                            break;
                        }
                    }
                }
                
                updatePosition(openPosition!, bar);
                
                if (openPosition!.curRiskPct !== undefined && options.recordRisk) {
                    openPosition!.riskSeries!.push({
                        time: bar.time,
                        value: openPosition!.curRiskPct!
                    });
                }

                if (strategy.exitRule) {
                    strategy.exitRule(exitPosition, {
                        entryPrice: openPosition!.entryPrice,
                        position: openPosition!, 
                        bar: bar, 
                        lookback: new DataFrame<number, IndicatorBarT>(lookbackBuffer.data), 
                        parameters: strategyParameters
                    });
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
        const lastBar = indicatorsSeries.last();
        const lastTrade = finalizePosition(openPosition, lastBar.time, lastBar.close, "finalize");
        completedTrades.push(lastTrade);
    }

    return completedTrades;
}

