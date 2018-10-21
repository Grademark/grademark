
/**
 * Interface that defines an open position.
 */
export interface IPosition {

    /***
     * Timestamp when the position was entered.
     */
    entryTime: Date;

    /**
     * Price when the position was entered.
     */
    entryPrice: number;

    /**
     * Nest profit or loss.
     */
    profit: number;

    /**
     * Profit expressed as a percentage.
     */
    profitPct: number;

    /**
     * Profit expressed as growth.
     */
    growth: number;

    /**
     * Number of bars the position was held for.
     */
    holdingPeriod: number;
}