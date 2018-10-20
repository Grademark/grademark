import { ITrade } from "./trade";
import { IDataFrame, DataFrame } from 'data-forge';

/**
 * Backtest a trading strategy against a data series and generate a sequence of trades.
 */
export function backtest(): IDataFrame<number, ITrade> {
    return new DataFrame<number, ITrade>();
}