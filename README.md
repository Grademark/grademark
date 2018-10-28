# grademark

API for backtesting financial trading strategies in JavaScript and TypeScript.

WORK IN PROGRESS: The API is fairly stable, but there are features yet to be implemented.

This API builds on [Data-Forge](http://data-forge-js.com/) and is best used from [Data-Forge Notebook](http://www.data-forge-notebook.com/) (making it easy to plot charts and visualize).

To learn more about working with data in JavaScript please read my book [Data Wrangling with JavaScript](http://bit.ly/2t2cJu2).

## Example output

From the [Grademark first example](https://github.com/ashleydavis/grademark-first-example) here's some example output. 

Analysis of a sequence of trades looks like this:

![Analysis of trades screenshot](https://github.com/ashleydavis/grademark-first-example/blob/master/output/analysis-screenshot.png)

Here's a chart that visualizes the equity curve for the example strategy:

![Equity curve](https://github.com/ashleydavis/grademark-first-example/blob/master/output/my-equity-curve-pct.png)

Here's another chart, this one is a visualization of the drawdown for the example strategy:

![Drawdown](https://github.com/ashleydavis/grademark-first-example/blob/master/output/my-drawdown-pct.png)

## Pre-requisites

- Make sure your data is sorted in forward chronological order. 

## Features

- Define a trading strategy with entry and exit rules.
- Backtest a trading strategy on a single financial instrument.
- Apply custom indicators to your input data series.
- Specify lookback period.
- Built-in intrabar stop loss.
- Compute and plot equity curve and drawdown charts.
- Throughly covered by automated tests.

## Coming soon

- Calculation of risk and rmultiples.
- Intrabar profit target.
- Intrabar trailing stop loss.
- Conditional buy on price level (intrabar).
- Parameters.
- Optimization based on permutations of parameters.
- Monte Carlo simulation.
- Walk-forward backtesting.
- Copmute and plot risk chart.

## Not coming soon

Due to this being a simple API there is no support (at least not yet) for:

- Fees.
- Slippage.
- Position sizing.
- Testing multiple instruments / portfolio simulation / ranking instruments.
- Short selling.

## Complete examples

For a ready to go example please see the repo [grademark-first-example](https://github.com/ashleydavis/grademark-first-example).

## Usage

Instructions here are for JavaScript, but this library is written in TypeScript and so it can also be used from TypeScript.

### Installation

    npm install --save grademark

### Import modules

```javascript
const dataForge = require('data-forge');
require('data-forge-indicators'); // For the moving average indicator.
require('data-forge-plot'); // For rendering charts.
const { backtest, analyze, computeEquityCurve, computeDrawdown } = require('grademark');
```

### Load your data

Use [Data-Forge](http://data-forge-js.com/) to load and prep your data, make sure your data is sorted in forward chronological order.

This example loads a CSV file, but feel free to load your data from REST API, database or wherever you want!

```javascript
let inputSeries = dataForge.readFileSync("STW.csv")
    .parseCSV()
    .parseDates("date", "DD/MM/YYYY")
    .parseFloats(["open", "high", "low", "close", "volume"])
    .setIndex("date") // Index so we can later merge on date.
    .renameSeries({ date: "time" });
```
The example data file is available in [the example repo](https://github.com/ashleydavis/grademark-first-example).

### Add indicators

Add whatever indicators and signals you want to your data.

```javascript
const movingAverage = inputSeries
    .deflate(bar => bar.close)          // Extract closing price series.
    .sma(30);                           // 30 day moving average.

inputSeries = inputSeries
    .withSeries("sma", movingAverage)   // Integrate moving average into data, indexed on date.
    .skip(30)                           // Skip blank sma entries.
```

### Create a strategy

This is a very simple and very naive mean reversion strategy:

```javascript
const strategy = {
    entryRule: (enterPosition, bar, lookback) => {
        if (bar.close < bar.sma) { // Buy when price is below average.
            enterPosition();
        }
    },

    exitRule: (exitPosition, position, bar, lookback) => {
        if (bar.close > bar.sma) {
            exitPosition(); // Sell when price is above average.
        }
    },
};
```

### Running a backtest

Backtest your strategy, then compute and print metrics:

```javascript
const trades = backtest(strategy, inputSeries)
console.log("Made " + trades.count() + " trades!");

const startingCapital = 10000;
const analysis = analyze(startingCapital, trades);
console.log(analysis);
```

### Visualizing the results

Visualize the equity curve and drawdown chart for your backtest:

```javascript
computeEquityCurve(trades)
    .plot()
    .renderImage("output/my-equity-curve.png");

computeDrawdown(trades)
    .plot()
    .renderImage("output/my-drawdown.png");
```


## Resources

- [Data-Forge](http://data-forge-js.com/)
- [Data-Forge Notebook](http://www.data-forge-notebook.com/)
