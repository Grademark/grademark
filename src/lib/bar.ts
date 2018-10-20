
/**
 * Defines a bar (a period of time) in a trading instrument's data series.
 */
export interface IBar {
    /**
     * Timestamp for the start of the bar.
     */
    time: Date;

    /**
     * Price at the open of the time period of the bar.
     */
    open: number;

    /**
     * Highest price during the time period of the bar.
     */
    high: number;

    /**
     * Lowest price during the time period of the bar.
     */
    low: number;

    /**
     * Closing price at the end of the time period of the bar.
     */
    close: number;

    /**
     * Volume of trading (number of trades) during the time period of the bar.
     */
    volume: number;
}