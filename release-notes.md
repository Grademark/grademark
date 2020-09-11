# Grademark release notes

## v0.2.0

**BREAKING CHANGES** 

- Rebuilt the optimization function:
  - You now have the option of two algorithms: `grid` and `hill-climb`.
  - The grid search algorithm is exhaustive but slow and gets slower the more parameters you are trying to optimize.
  - The hill-climb algorithm is non-exhausive but much faster, especially as the number of parameters increases. Use the option `numStartingPoints` to choose the number of random starting points that are used to seed the algorithm.
  - Restructured the output of optimization for memory efficiency and easier visualization.
  - You can now set the seed used for random number generation.
- Reduced the dependency of Grademark on Data-Forge:
  - Most results from and inputs to Grademark no longer use `DataFrame`. They are just plain old JavaScript arrays.
  - The `inputSeries` parameter still does use a `DataFrame`.
  - To convert your old Grademark code:
    - Instead of inputing a `DataFrame` call `toArray` on it instead to convert it to an array.
    - If you want output as a `DataFrame` just wrap the returned array in a new one, e.g. `const trades = new DataFrame(backtest(...))`;
  

## v0.0.1

**BREAKING CHANGES** 

- Arguments to functions for strategy rules have changed. Instead of having individual arguments to each function, arguments are now bundled in objects for future expandability and better auto-competion.
