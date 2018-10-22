

/**
 * Interface that defines a trade.
 */
export interface ITrade {
    /***
     * Timestamp when the position was entered.
     */
    entryTime: Date;

    /**
     * Price when the position was entered.
     */
    entryPrice: number;

    /**
     * Timestamp when the position was exited.
     */
    exitTime: Date;

    /**
     * Price when the position was exited.
     */
    exitPrice: number;

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
     * Optional risk computed from stop loss.
     */
    risk?: number;

    /**
     * Optional profit expressed as a mutiple of initial risk.
     */
    rmultiple?: number;

    /**
     * Number of bars the position was held for.
     */
    holdingPeriod: number;

    /**
     * The reason the position was exited.
     */
    exitReason: string;

}