// Fetch the TMDB and GDP data and generate the line chart
async function fetchDataAndDrawChart() {
  // Fetch the movie data from the local endpoint
  const movieDataResponse = await fetch('http://localhost:3000/api/top-movies/all');
  const movieData = await movieDataResponse.json();

  // Fetch GDP data from FRED API
  const gdpDataResponse = await fetch('http://localhost:3000/api/fred');
  const gdpData = await gdpDataResponse.json();

  // Process the movie data: calculate total revenue per year
  const totalRevenuePerYear = Object.keys(movieData).map(year => {
      const totalRevenue = movieData[year].reduce((sum, movie) => sum + movie.revenue, 0);
      return { year: parseInt(year), totalRevenue };
  });

  // Process GDP data from FRED
  const processedGdpData = gdpData.observations.map(observation => ({
      year: new Date(observation.date).getFullYear(),
      gdp: parseFloat(observation.value)
  }));

  // Merge movie and GDP data by year
  const mergedData = totalRevenuePerYear.map(revenueData => {
      const correspondingGdp = processedGdpData.find(gdpData => gdpData.year === revenueData.year);
      return {
          year: revenueData.year,
          totalRevenue: revenueData.totalRevenue,
          gdp: correspondingGdp ? correspondingGdp.gdp : null
      };
  }).filter(data => data.gdp !== null);  // Filter out missing GDP data

  drawChart(mergedData);
}

// Function to draw the D3.js line chart
function drawChart(data) {
  const margin = { top: 20, right: 80, bottom: 50, left: 80 };
  const width = 900 - margin.left - margin.right;
  const height = 500 - margin.top - margin.bottom;

  const svg = d3.select("#chart")
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

  // Set the ranges for x and y axes
  const x = d3.scaleTime()
      .domain(d3.extent(data, d => new Date(d.year, 0, 1)))
      .range([0, width]);

  const yLeft = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.gdp)])
      .range([height, 0]);

  const yRight = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.totalRevenue)])
      .range([height, 0]);

  // Create the X axis (time)
  svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(10));

  // Create the left Y axis (GDP)
  svg.append("g")
      .call(d3.axisLeft(yLeft))
      .append("text")
      .attr("y", -10)
      .attr("x", -50)
      .attr("text-anchor", "end")
      .attr("stroke", "black")
      .text("GDP Growth (Billion USD)");

  // Create the right Y axis (Movie Revenue)
  svg.append("g")
      .attr("transform", `translate(${width},0)`)
      .call(d3.axisRight(yRight))
      .append("text")
      .attr("y", -10)
      .attr("x", 50)
      .attr("text-anchor", "end")
      .attr("stroke", "black")
      .text("Total Movie Revenue (USD)");

  // Line for GDP
  const gdpLine = d3.line()
      .x(d => x(new Date(d.year, 0, 1)))
      .y(d => yLeft(d.gdp));

  svg.append("path")
      .data([data])
      .attr("class", "line")
      .attr("d", gdpLine)
      .attr("stroke", "blue")
      .attr("stroke-width", 2)
      .attr("fill", "none");

  // Line for Movie Revenue
  const revenueLine = d3.line()
      .x(d => x(new Date(d.year, 0, 1)))
      .y(d => yRight(d.totalRevenue));

  svg.append("path")
      .data([data])
      .attr("class", "line")
      .attr("d", revenueLine)
      .attr("stroke", "red")
      .attr("stroke-width", 2)
      .attr("fill", "none");
}

// Fetch the data and draw the chart when the page loads
fetchDataAndDrawChart();
