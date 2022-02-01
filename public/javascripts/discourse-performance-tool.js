class DiscoursePerformanceTool {
  observer = null;
  DEFAULT_COLUMNS = [
    "dns",
    "connect",
    "waiting",
    "loading",
    "initializing",
    "rendering",
    "init + rendering",
  ];

  static start(){
    this.instance = new DiscoursePerformanceTool()
    this.instance.listenForPerformanceEntries()
  }

  static help(){
    const helpText = []
    this.instance.log([
      "discourse-performance-tool can collect javascript performance data, then analyse/graph the results.",
      "  To collect 100 datapoints labelled 'somename', run `DiscoursePerformanceTool.run('somename', 100)`",
      "  To delete a labelled dataset, use `DiscoursePerformanceTool.delete('somename')`",
      "  To clear all data, use `DiscoursePerformanceTool.clear()`",
      "  To show the graph UI, use `DiscoursePerformanceTool.graph()`",
      ""
    ].join('\n'))
  }

  static run(label, iterations){
    this.instance.run(label, iterations);
  }

  static delete(label){
    this.instance.delete(label);
  }

  static clear(){
    this.instance.clear();
  }

  static csv(){
    this.instance.csv();
  }

  static graph(){
    this.instance.graph();
  }

  constructor(){
    this.rawTimestamps = new Map();
  }

  listenForPerformanceEntries(){
    this.observer = new PerformanceObserver((list) => {
      list.getEntries().forEach(this.handlePerformanceEntry.bind(this));
      this.reportIfReady();
    })

    this.observer.observe({
      buffered: true,
      type: "navigation",
    });

    this.observer.observe({
      buffered: true,
      type: "paint",
    });

    this.observer.observe({
      buffered: true,
      type: "mark",
    });

    // Safari bug? Doesn't seem to support `buffered: true` on "paint" events
    // so we have to check if it already fired. No harm in running this
    // in other browsers as well.
    const paintEvents = performance.getEntriesByType("paint");
    paintEvents.forEach(this.handlePerformanceEntry.bind(this));
    this.reportIfReady();
  }

  handlePerformanceEntry(e){
    if(e.entryType === "navigation"){
      this.navigationEntry = e;
    }else if(e.entryType === "paint" && e.name === "first-contentful-paint"){
      this.firstContentfulPaintEntry = e;
    }else if(e.entryType === "mark" && e.name === "discourse-boot-js"){
      this.discourseBootJsEntry = e;
    }
  }

  reportIfReady(){
    if(this.reported){
      return
    }
  
    if(!(this.navigationEntry && this.firstContentfulPaintEntry && this.discourseBootJsEntry)){
      return
    }

    this.reported = true;  

    const data = new Map();

    data.set('dns', this.navigationEntry.domainLookupEnd - this.navigationEntry.domainLookupStart);
    data.set('connect', this.navigationEntry.connectEnd - this.navigationEntry.connectStart);
    data.set('waiting', this.navigationEntry.responseStart - this.navigationEntry.requestStart);
    data.set('loading', this.discourseBootJsEntry.startTime - this.navigationEntry.responseStart);
    data.set('initializing', this.navigationEntry.domContentLoadedEventStart - this.discourseBootJsEntry.startTime);
    data.set('rendering', this.firstContentfulPaintEntry.startTime - this.navigationEntry.domContentLoadedEventStart);
    data.set('init + rendering', this.firstContentfulPaintEntry.startTime - this.discourseBootJsEntry.startTime);
    

    const tableRows = []
    data.forEach((value, key) => {
      tableRows.push([
        key,
        `${this.round(value).toFixed(1)} ms`
      ])
    })

    const table = this.table([
      ["STAGE", "DURATION"],
      ...tableRows
    ])

    this.log(`Data for this page load:\n\n${table}\nRun DiscoursePerformanceTool.help() for more info\n`)

    const store = this.store;
    if(store.label){
      store.data ||= {}
      store.data[store.label] ||= []
      if(store.data[store.label].length < store.iterations){
        store.data[store.label].push( Object.fromEntries(data));
        this.store = store;
        window.location.reload();
      }else{
        alert(`perf-tool: Completed run labelled '${store.label}'. Open dev tools console for results.`)
        this.log(`Completed run labelled '${store.label}'`)
        delete store.label;
        delete store.iterations;
        this.store = store;
        this.printSummary();
      }
    }else if(store.data){
      this.printSummary();
    }
  }

  printSummary({columns = this.DEFAULT_COLUMNS} = {}){
    const data = this.store.data;

    const rows = []
    rows.push([
      "LABEL",
      "ITERATIONS",
      ...columns
    ])

    for(const label in data){
      const runs = data[label];
      const thisRow = [label, runs.length.toString()];

      for(const column of columns){
        const values = runs.map(r => r[column]);
        values.sort((a, b) => a - b);
        const median = values[Math.floor(values.length / 2)];
        const deviations = values.map((v) => Math.abs(v - median))
        deviations.sort((a, b) => a - b)
        const medianAbsoluteDeviation = deviations[Math.floor(deviations.length / 2)];
        
        thisRow.push(`${median.toFixed(0)} ± ${medianAbsoluteDeviation.toFixed(0)} ms`)
      }
      rows.push(thisRow);
    }

    const table = this.table(rows);

    this.log(`Summary of recorded runs (median ± median-absolute-deviation):\n\n${table}\nRun DiscoursePerformanceTool.help() for more info`)
  }

  log(text, prefix=true){
    console.log(`${prefix ? '[perf-tool] ' : ''}${text}`)
  }

  round(value, precision = 1){
    const multiplier = Math.pow(10, precision || 0);
    return Math.round(value * multiplier) / multiplier;
  }

  table(data){
    let columnCount = data[0].length
    let columnWidths = [];
    for(const row of data){
      for(const [colIndex, value] of row.entries()){
        if(!columnWidths[colIndex] || value.length > columnWidths[colIndex]){
          columnWidths[colIndex] = value.length;
        }
      }
      columnWidths
    }

    let output = ""
    for(const [rowIndex, row] of data.entries()){
      output += '|'
      for(const [colIndex, value] of row.entries()){
        output += ` ${value.padStart(columnWidths[colIndex])} |`
      }
      output += "\n"
      if(rowIndex === 0){
        output += '|'
        for(let colIndex = 0; colIndex < row.length; colIndex++){
          output += ':|'.padStart(columnWidths[colIndex] + 3, "-")
        }
        output += "\n"
      }
    }

    return output;
  }

  get store(){
    const raw = localStorage.getItem("discourse-performance-tool-data");
    if(raw){
      return JSON.parse(raw)
    }
    return {}
  }

  set store(data){
    const raw = JSON.stringify(data)
    localStorage.setItem("discourse-performance-tool-data", raw);
  }

  run(label, iterations, {force = false} = {}){
    const store = this.store;
    if(store.data?.[label]){
      this.log(`There is already data stored for ${label}. To clear, run DiscoursePerformanceTool.delete('${label}')`)
      return;
    }

    if(!force && Ember.ENV._DEBUG_RENDER_TREE){
      this.log("⚠️ WARNING - Ember debug rendering is enabled. Make sure you are running Ember in production mode, and that the Ember Inspector browser extension is not running. To bypass this check, use `run('label', 100, { force: true })`")
      return;
    }

    this.log(`Performing ${iterations} iterations for ${label}`);
    this.log(`Close your development tools, and keep the browser in the foreground. Measurements will start in 5 seconds, and you will be alerted upon completion.`);
    
    store.iterations = iterations
    store.label = label;
    this.store = store;

    setTimeout(() => {
      window.location.reload()
    }, 5000)
  }

  delete(label){
    const store = this.store;
    delete store.data[label];
    this.log(`Deleted data for ${label}`);
    this.store = store;
  }

  clear(){
    this.store = {}
  }

  csv(columns = this.DEFAULT_COLUMNS){
    const data = this.store.data;
    const csvRows = []
    csvRows.push(["label", "stage"].join(","))
    for(const label in data){
      for(const column of columns){
        csvRows.push([
          label,
          column,
          ...data[label].map((d) => d[column].toFixed(2))
        ].join(','))
      }
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const csvUrl = URL.createObjectURL(blob);

    const link = document.createElement("a")
    link.href = csvUrl;
    link.download = "discourse-performance-tool-data.csv";
    link.click();

    this.log("CSV Generated Successfully")
  }

  async graph(){
    const loadScript = require("discourse/lib/load-script").default;
    await loadScript("javascripts/Chart.min.js");
    await loadScript("plugins/discourse-performance-tool/javascripts/chart-boxplot.min.js");

    document.documentElement.style.height = "100vh";
    document.documentElement.style.overflowY = "hidden";
    
    const shadowWrapper = document.createElement("div");
    shadowWrapper.style = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 99999999999;
      padding: 10px;
      box-sizing: border-box;
      background-color: white;
    `
    document.body.appendChild(shadowWrapper);

    const shadow = shadowWrapper.attachShadow({mode: "open"});
    shadow.innerHTML += `
      <style>
        .title{
          grid-area: title;
          text-align: center;
        }
        .wrapper{
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          grid-template-areas:
            "title"
            "controls"
            "graph";
          width: 100%;
          height: 100%;
          overflow: scroll;
        }
        .controls {
          place-self: center;
          grid-area: controls;
          display: flex;
        }
        .controls .control {
          padding: 5px;
          margin: 5px;
          border: 1px solid #eee;
        }
        .canvas-wrapper{
          grid-area: graph;
          place-self: center;
          width: 800px;
          height: 400px;
          max-width: 100%;
        }
      </style>
      <div class='wrapper'>
        <div class='title'><h1>Discourse Performance Tool</h1></div>
        <div class='controls'>
          <div class='control'>
            <label for='type'>Type:</label>
            <select name='type'>
              <option value='boxplot'>boxplot</option>
              <option value='histogram'>histogram</option>
            </select>
          </div>
          <div class='control'>
            <label for='stage'>Stage:</label>
            <select name='stage'>
              ${this.DEFAULT_COLUMNS.map(c => `<option value='${c}' ${c==='init + rendering' ? 'selected' : ''}>${c}</option>`).join('\n')}
            </select>
          </div>
          <div class='control'>
            <label for='labels'>Runs:</label>
            <input name='labels' value='${Object.keys(this.store.data).join(',')}'>
          </div>
          <div class='control'>
            <label for='outliers'>Outliers:</label>
            <select name='outliers'>
              <option value='show'>show</option>
              <option value='hide'>hide</option>
            </select>
          </div>
          <div class='control'>
            <button class='download-csv'>CSV</button>
            <button class='download-png'>PNG</button>
          </div>  
        </div>
        <div class='canvas-wrapper'>
          <canvas class='discourse-performance-graph'></canvas>
        </canvas-wrapper>
      </div>
    `

    const graphElement = shadow.querySelector('.discourse-performance-graph')
    const controlsElement = shadow.querySelector('.controls')

    this.chart = new Chart(graphElement.getContext("2d"), this.buildChartConfig(controlsElement, shadow));

    controlsElement.addEventListener('change', () => {
      this.chart?.destroy();
      this.chart = new Chart(graphElement.getContext("2d"), this.buildChartConfig(controlsElement, shadow));
    })

    shadow.querySelector('.download-png').addEventListener('click', () => {
      var a = document.createElement('a');
      a.href = this.chart.toBase64Image();
      a.download = 'perf-tool-graph.png';
      a.click();
    })

    shadow.querySelector('.download-csv').addEventListener('click', () => {
      this.csv()
    });
  }

  buildChartConfig(controlsDiv, shadowRoot){
    this.colorIndex = 0;
    let config;
    const type = controlsDiv.querySelector('select[name=type]').value;
    if(type === "boxplot"){
      config = this.buildChartBoxplotConfig(controlsDiv);
    }else{
      config = this.buildChartHistogramConfig(controlsDiv);
    }

    const whiteBackgroundPlugin = {
      id: 'custom_canvas_background_color',
      beforeDraw: (chart) => {
        const ctx = chart.canvas.getContext('2d');
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, chart.width, chart.height);
        ctx.restore();
      }
    };

    config.plugins = [whiteBackgroundPlugin]

    let height = 400;
    if(type === "boxplot"){
      height = Math.max(height, config.data.labels.length * 100);
    }

    shadowRoot.querySelector('.canvas-wrapper').style.height = `${height}px`;

    return config;
  }

  buildChartBoxplotConfig(controlsDiv){
    const stage = controlsDiv.querySelector('select[name=stage]').value;
    const rawData = this.store.data;
    const labelsToPlot = controlsDiv.querySelector('input[name=labels]').value.split(',');
    const dataToPlot = {};
    for(const label of labelsToPlot){
      dataToPlot[label] = rawData[label].map(v => v[stage]).sort((a, b) => a - b);
    }

    const showOutliers = controlsDiv.querySelector('select[name=outliers]').value == 'show';

    const footerText = [`Generated by discourse-performance-tool`]
    if(!showOutliers){
      footerText.push(`Discarded outliers more than 1.5 IRQ from quartiles`)
    }

    return{
      type: "boxplot",
      data: {
        labels: Object.keys(dataToPlot).map(l => [l, `(${dataToPlot[l].length} iter)`]),
        datasets: [{
          backgroundColor: "#0a84a540",
          borderColor: "#0a84a5",
          borderWidth: 2,
          data: Object.values(dataToPlot),
          outlierBackgroundColor: '#999999',
          minStats: showOutliers ? 'min' : 'whiskerMin',
          maxStats: showOutliers ? 'max' : 'whiskerMax',
          itemRadius: 2,
          outlierRadius: showOutliers ? 2 : 0,
          coef: 1.5, // Whiskers are at 1.5x IQR
        }]
      },
      options: {
        layout: {
          padding: 10
        },
        maintainAspectRatio: false,
        animation: {
          duration: 0
        },
        indexAxis: 'y',
        plugins:{
          title: {
            display: true,
            text: `'${stage}' duration`
          },
          subtitle: {
            display: true,
            position: "bottom",
            align: "end",
            text: footerText,
            font: {
              style: 'italic',
              size: 10
            }
          },
          legend: {
            display: false
          },
        },
        scales:{
          x: {
            beginAtZero: false,
            title: {
              display: true,
              text: "Duration (ms)"
            },
          }
        }
      }
    }
  }

  buildChartHistogramConfig(controlsDiv){
    const stage = controlsDiv.querySelector('select[name=stage]').value;
    const rawData = this.store.data;
    const labelsToPlot = controlsDiv.querySelector('input[name=labels]').value.split(',');
    const dataToPlot = {};
    for(const label of labelsToPlot){
      dataToPlot[label] = rawData[label].map(v => v[stage]).sort((a, b) => a - b);
    }

    const showOutliers = controlsDiv.querySelector('select[name=outliers]').value === 'show';
    if(!showOutliers){
      for(const label of labelsToPlot){
        const count = dataToPlot[label].length;
        const q1 = dataToPlot[label][Math.floor(0.25 * count)];
        const q3 = dataToPlot[label][Math.ceil(0.75 * count)];
        const iqr = q3 - q1;
        dataToPlot[label] = dataToPlot[label].filter((v) => {
          if(v < q1 - iqr * 1.5){
            return false; // Low outlier
          }else if(v > q3 + iqr * 1.5){
            return false; // High outlier
          }
          return true;
        })
      }
    }

    const min = Math.min(...Object.values(dataToPlot).map(d => d[0]))
    const max = Math.max(...Object.values(dataToPlot).map(d => d[d.length - 1]))

    const bucketCount = 30;
    const bucketInterval = (max - min) / bucketCount;
    const bucketMinimums = Array(bucketCount).fill(0).map((_, i) => min + bucketInterval*i);

    const footerText = [`Generated by discourse-performance-tool`]
    if(!showOutliers){
      footerText.push(`Discarded outliers more than 1.5 IRQ from quartiles`)
    }

    return {
      type: 'line',
      data: {
        labels: [...bucketMinimums, max],
        datasets: Array.from(Object.entries(dataToPlot)).map(([label, data]) => this.buildChartDataset({label, data, bucketMinimums}))
      },
      options: {
        plugins: {
            title: {
              display: true,
              text: `'${stage}' duration`
            },
            subtitle: {
              display: true,
              position: "bottom",
              align: "end",
              text: footerText,
              font: {
                style: 'italic',
                size: 10
              }
            },
        },
        animation: {
          duration: 0
        },
        scales: {
          x: {
            title: {
              display: true,
              text: "Duration (ms)"
            },
            ticks: {
              callback: function(value, index, values) {
                return this.getLabelForValue(value).toFixed(0);
              }
            }
          },
          y: {
            title: {
              display: true,
              text: "Proportion of requests"
            },
            grid:{
              display: false,
            },
            beginAtZero: true,
            ticks: {
              callback: function(value, index, values) {
                return `${(value * 100).toFixed(0)}%`;
            }
            }
          }
        }
      }
    }
  }

  colors = [
    "#0a84a5",
    "#f6c85f",
    "#6f4d7c",
    "#9cd766",
    "#ca472f",
    "#ff9f56",
    "#8cddd0",
  ]
  colorIndex = 0;
  getNextColor(){
    const c = this.colors[this.colorIndex];
    this.colorIndex++;
    if(this.colorIndex >= this.colors.length){
      this.colorIndex = 0;
    }
    return c;
  }

  buildChartDataset({data, bucketMinimums, label}){
    const buckets = Array(bucketMinimums.length).fill(0);
    let bucketIndex = 0;
    for(const point of data){
      while(point > bucketMinimums[bucketIndex + 1]){
        bucketIndex++
      }
      buckets[bucketIndex] += 1/data.length;
    }

    const color = this.getNextColor();
    return {
      label: `${label} (${data.length} iter)`,
      data: [...buckets, buckets[buckets.length - 1]],
      backgroundColor: `${color}40`,
      borderColor: `${color}80`,
      borderWidth: 1,
      fill: true,
      stepped: 'before',
      pointRadius: 0
    }
  }
}

DiscoursePerformanceTool.start();


