# grademark

API for backtesting trading strategies in JavaScript and TypeScript.

WORK IN PROGRESS

The API is fairly stable, but there are features yet to be implemented.

This API builds on [Data-Forge](http://data-forge-js.com/) and is best used from [Data-Forge Notebook](http://www.data-forge-notebook.com/) (making it easy to plot charts and visualize).

TODO: Add link here to live notebook (mean reversion strategy).

To learn more about working with data in JavaScript please read my book [Data Wrangling with JavaScript](http://bit.ly/2t2cJu2).

## Features

- Define a trading strategy with entry and exit rules.
- Backtest a trading strategy on a single instrument.
- Apply custom indicators to your data series.
- Specify lookback period.
- Built-in intrabar stop loss and risk calculation.

## Coming soon

- Trailing stop loss.
- Conditional buy on price level (intrabar).
- Parameters
- Optimization based on permutations of parameters.
- Analysis
- Charting equity curves and drawdown
- Monte Carlo simulation
- Walk-forward backtesting
- Risk curve

## Missing

Due to this being a simple API there is no support (at least not yet) for:

- Fees
- Slippage
- Position sizing
- Testing multiple instruments / portfolio simulation / ranking instruments.
- Short selling.

## Examples

TODO

## Installation

TODO

## Loading data

TODO

### From REST API

TODO

### From CSV file

TODO

### From MongoDB

TODO

## Running a backtest

TODO

## Visualizating the results

TODO