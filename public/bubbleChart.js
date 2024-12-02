// Fetch movie and inflation data, then generate the bubble chart
async function fetchDataAndDrawBubbleChart() {
    const movieDataResponse = await fetch('http://localhost:3000/api/top-movies/all');
    const inflationDataResponse = await fetch('http://localhost:3000/api/inflation');

    const movieData = await movieDataResponse.json();
    const inflationData = await inflationDataResponse.json();

    // Process inflation data into a usable format (e.g., year -> CPI)
    const cpiData = inflationData.observations.reduce((acc, obs) => {
        const year = new Date(obs.date).getFullYear();
        acc[year] = parseFloat(obs.value); // Store CPI by year
        return acc;
    }, {});

    // Find the earliest movie release year
    const earliestYear = Math.min(
        ...Object.keys(movieData).flatMap(year =>
            movieData[year].map(movie => new Date(movie.release_date).getFullYear())
        )
    );
    console.log(earliestYear)

    // Base CPI for the earliest year
    const baseCPI = cpiData[earliestYear];

    // Convert movie data into a list of movies with adjusted revenues
    const movies = Object.keys(movieData).flatMap(year => {
        return movieData[year].map(movie => {
            const releaseYear = new Date(movie.release_date).getFullYear();
            const cpi = cpiData[releaseYear] || baseCPI; // Default to baseCPI if missing
            const adjustedRevenue = (movie.revenue * baseCPI) / cpi; // Adjust revenue

            return {
                year: parseInt(year),
                name: movie.title,
                revenue: movie.revenue,
                adjustedRevenue,
                release: new Date(movie.release_date), // Convert to Date object
                genres: movie.genres
            };
        });
    });

    drawBubbleChart(movies);
}
function drawBubbleChart(data) {
    const margin = { top: 20, right: 40, bottom: 50, left: 80 };
    const width = 900 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const svg = d3.select("#bubbleChart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

        window.addEventListener("updateCharts", () => {
            svg.selectAll("circle")
                .transition()
                .duration(500)
                .style("opacity", d => {
                    if (!sharedState.selectedGenre) {
                        console.log("No genre selected. Showing all bubbles.");
                        return 1; // Reset if no genre is selected
                    }
        
                    const isSelected = d.genres.includes(sharedState.selectedGenre);
                    
                    if (isSelected) {
                        console.log("Selected Bubble Data:", d); // Log the data of the selected bubbles
                    }
        
                    return isSelected ? 1 : 0.2; // Highlight matching bubbles
                });
        });
        
    // Set the ranges for the x and y axes
    const x = d3.scaleTime()
        .domain(d3.extent(data, d => d.release))
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.revenue)])
        .range([height, 0]);

    const genres = [...new Set(data.flatMap(d => d.genres))]; // Get all unique genres
    const colorScale = d3.scaleOrdinal()
        .domain(genres)
        .range(d3.schemeCategory10); // Use a predefined color scheme

    // Scale for the bubble size
    const sizeScale = d3.scaleSqrt()
        .domain([0, d3.max(data, d => d.revenue)])
        .range([0.1, 10]);

    // Create X axis (time)
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(10));

    // Add Y axis (initially)
    const yAxisGroup = svg.append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(y).tickFormat(d3.format("$.2s")));

    // Create the tooltip
    const tooltip = d3.select("#tooltip");

    // State to toggle between raw and adjusted revenues
    let useAdjustedRevenue = false;

    // Function to update the chart based on the toggle
    function updateChart() {
        // Determine max revenue based on toggle state
        const maxRevenue = d3.max(data, d =>
            useAdjustedRevenue ? d.adjustedRevenue : d.revenue
        );

        // Update Y scale's domain
        y.domain([0, maxRevenue]);

        // Update bubbles
        svg.selectAll("circle")
            .data(data)
            .join("circle")
            .attr("cx", d => x(d.release))
            .attr("cy", d => y(useAdjustedRevenue ? d.adjustedRevenue : d.revenue))
            .attr("r", d => sizeScale(useAdjustedRevenue ? d.adjustedRevenue : d.revenue))
            .attr("fill", d => colorScale(d.genres[0])) // Color by first genre
            .attr("stroke", "black")
            .attr("opacity", 0.7)
            .on("mouseover", function (event, d) {
                d3.select(this).attr("stroke", "red").attr("stroke-width", 3);
                tooltip
                    .style("display", "block")
                    .html(`<strong>${d.name}</strong><br>
                        Revenue: $${(useAdjustedRevenue ? d.adjustedRevenue : d.revenue).toLocaleString()}<br>
                        Genres: ${d.genres.join(", ")}`)
                    .style("left", (event.pageX + 5) + "px")
                    .style("top", (event.pageY - 40) + "px");
            })
            .on("mouseout", function () {
                d3.select(this).attr("stroke", "black").attr("stroke-width", 1);
                tooltip.style("display", "none");
            });

        // Update Y axis
        yAxisGroup.transition()
            .duration(500) // Smooth transition
            .call(d3.axisLeft(y).tickFormat(d3.format("$.2s")));
    }

    // Add a toggle button
    d3.select("#toggleInflationButton")
        .on("click", () => {
            useAdjustedRevenue = !useAdjustedRevenue; // Toggle state
            updateChart();
        });

    // Add legend
    const legendGroup = d3.select("#bubbleChart")
        .append("div")
        .attr("class", "legend");

    genres.forEach((genre, i) => {
        const legendItem = legendGroup.append("div")
            .attr("class", "legend-item")
            .style("cursor", "pointer")
            .on("click", function () {
                // Filter functionality
                const isActive = d3.select(this).classed("active");
                d3.selectAll(".legend-item").classed("active", false); // Reset all
                d3.select(this).classed("active", !isActive);

                svg.selectAll("circle")
                    .transition()
                    .duration(500)
                    .style("opacity", d => {
                        if (!isActive && d.genres[0] === genre) return 1;
                        return !isActive ? 0.1 : 0.7;
                    });
            });

        legendItem.append("span")
            .attr("class", "legend-color")
            .style("background-color", colorScale(genre));

        legendItem.append("span")
            .attr("class", "legend-text")
            .text(genre);
    });

    updateChart(); // Initial render
}
fetchDataAndDrawBubbleChart();

