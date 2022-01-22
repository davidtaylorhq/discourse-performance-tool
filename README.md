# discourse-performance-tool

Client-side performance is difficult to measure. Browser development tools can help, but results can still vary massively between refreshes. This makes it quite difficult to definitively say whether a change hurts or improves performance.

This plugin is designed to help with testing client-side performance under 'lab conditions'. Essentially, it refreshes a page hundreds/thousands of times, and collects statistics for comparison. Primarily designed for before/after testing of performance-critical changes.

### How to use

1. Make sure you are running Ember in production mode. Ember's 'debug mode' performance profile is vastly different. `bin/ember-cli --environment production` should do the trick
2. Install and enable this plugin in your development site
3. Reload the page, and check the dev-tools console. You should see statistics for the current page load
4. To start a measurement run, type `DiscoursePerformanceTool.run('some label for the run', 100)`
5. Immediately close your dev tools (they hurt performance), then wait for the refreshing to begin. Keep your browser in the foreground, and don't let a screensaver kick in
6. When complete, you'll see a popup alert
7. Apply the change you want to test, then perform another measurement run with the same number of iterations
8. When you're done, run `DiscoursePerformanceTool.graph()` to see a boxplot. Various controls are available for analysing the data. Use the Export PNG button to share in a Discourse topic of GitHub PR

For more commands, type `DiscoursePerformanceTool.help()`

### Statistical Methodology

The centre of the box plot shows the lower quartile, median and upper quartile of the data. The whiskers show the range of the data, excluding any outliers. Outliers are defined as points which are more than 1.5 interquartile-ranges away from the upper/lower quartiles.

The histogram has the same definition of outliers. This view can be useful to visualise the data, and potentially identify unusual distributions. But in general, the box plot is the best visualisation for comparison.