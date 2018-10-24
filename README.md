# grademark

API for backtesting trading strategies in JavaScript and TypeScript.

WORK IN PROGRESS

The API is fairly stable, but there are features yet to be implemented.

This API builds on [Data-Forge](http://data-forge-js.com/) and is best used from [Data-Forge Notebook](http://www.data-forge-notebook.com/) (making it easy to plot charts and visualize).

TODO: Add link here to live notebook (mean reversion strategy).
TODO: Include a markdown export in this readme.

To learn more about working with data in JavaScript please read my book [Data Wrangling with JavaScript](http://bit.ly/2t2cJu2).

## Pre-requisites

- Make sure your data is sorted in forward chronological order. 

## Features

- Define a trading strategy with entry and exit rules.
- Backtest a trading strategy on a single instrument.
- Apply custom indicators to your data series.
- Specify lookback period.
- Built-in intrabar stop loss and risk calculation.
- Compute equity curve and drawdown chart from trades.

## Coming soon

- Intrabar profit target.
- Intrabar trailing stop loss.
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

## Complete examples

TODO: Coming soon
TODO: Link to DFN notebook.

## Usage

Instructions here are for JavaScript, but this library is written in TypeScript and so it can also be used from TypeScript.

### Installation

    npm install --save grademark

### Import modules

```javascript
const dataForge = require('data-forge');
require('data-forge-indicators'); // For the moving average indicator.
const { backtest, analyze, computeEquityCurve, computeDrawdown } = require('grademark');
```

### Load your data

Use Data-Forge to load and prep your data, make sure your data is sorted in forward chronological order.

This example loads a CSV file, but feel free to load your data from REST API, database or wherever you want!

```javascript
let inputSeries = dataForge.readFileSync("STW.csv")
    .parseCSV()
    .parseDates("date", "DD/MM/YYYY")
    .setIndex("date")
    .renameSeries({ date: "time" });
```
The example data file is available in the 'Examples' sub-directory of this repo (todo: coming soon).

### Add indicators

Add whatever indicators and signals you want to your data.

```javascript
const movingAverage = df.deflate(bar => bar.close).sma(30); // 30 day moving average.
inputSeries = inputSeries.withSeries("sma", movingAverage); // Integrate moving average into data.
```

### Create a strategy

This is a very simple and very naive mean reversion strategy:

```javascript
const strategy = {
    entryRule: (bar, lookback, enterPosition) => {
        if (bar.close < bar.sma) { // Buy when price is below average.
            enterPosition();
        }
    },

    exitRule: (position, bar, lookback, exitPosition) => {
        if (bar.close > bar.sma) {
            exitPosition(); // Sell when price is above average.
        }
    },
};
```

## Running a backtest

Backtest your strategy, then compute and print metrics:

```javascript
const trades = backtest(strategy, inputSeries)
const analysis = analyze(trades);
console.log(analysis);
```

## Visualizating the results

Visualize the equity curve and drawdown chart for your backtest:

```javascript
computeEquityCurve(trades)
    .plot()
    .renderImage("my-equity-curve.png");

computeDrawdown(trades)
    .plot()
    .renderImage("my-equity-curve.png");
```


