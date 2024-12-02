// Fetch top movies and generate the stacked bar chart, grouped by genre
async function fetchDataAndDrawStackedBarChart() {
    try {
        // Fetch movie data from the server
        const movieDataResponse = await fetch('http://localhost:3000/api/top-movies/all');
        const movieData = await movieDataResponse.json();

        // Group movies by year and aggregate revenue by genre
        const moviesByYear = Object.keys(movieData).map(year => {
            const movies = movieData[year];
            const genreRevenue = {};

            movies.forEach(movie => {
                if (!movie.genres || !movie.revenue) return; // Skip invalid movies
                movie.genres.forEach(genre => {
                    if (!genreRevenue[genre]) {
                        genreRevenue[genre] = 0;
                    }
                    genreRevenue[genre] += movie.revenue;
                });
            });

            return {
                year: parseInt(year),
                ...genreRevenue
            };
        });

        // Log the processed data to verify
        console.log("Movies by Year:", moviesByYear);

        drawStackedBarChart(moviesByYear);
    } catch (error) {
        console.error("Error fetching or processing data:", error);
    }
}

// Function to draw the D3.js stacked bar chart
function drawStackedBarChart(data) {
    const margin = { top: 40, right: 150, bottom: 50, left: 100 };
    const width = 900 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const svg = d3.select("#stackedBarChart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Get all unique genres from the data
    const genres = [...new Set(data.flatMap(d => Object.keys(d).filter(key => key !== 'year')))];

    // Define color scale for genres
    const color = d3.scaleOrdinal()
        .domain(genres)
        .range(d3.schemeCategory10);

    // X and Y scales
    const x = d3.scaleBand()
        .domain(data.map(d => d.year))
        .range([0, width])
        .padding(0.1);

    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d3.sum(genres, genre => d[genre] || 0))])
        .range([height, 0]);

    // Create X axis (years)
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")));

    // Create Y axis (revenue)
    svg.append("g")
        .call(d3.axisLeft(y).tickFormat(d3.format("$.2s")));

    // Stack the data based on genres
    const stack = d3.stack()
        .keys(genres)
        .value((d, key) => d[key] || 0); // Use 0 if genre is not present in a particular year

    const layers = stack(data);

    // Create stacked bars with tooltip functionality
    const layersSelection = svg.selectAll(".layer")
        .data(layers)
        .enter()
        .append("g")
        .attr("class", "layer")
        .attr("fill", d => color(d.key));

    layersSelection.selectAll("rect")
        .data(d => d)
        .enter()
        .append("rect")
        .attr("x", d => x(d.data.year))
        .attr("y", d => y(d[1]))
        .attr("height", d => y(d[0]) - y(d[1]))
        .attr("width", x.bandwidth())
        .on("click", function (event, d) {
            const genre = d3.select(event.target.parentNode).datum().key; // Get the genre of the clicked segment
            console.log("Selected Genre:", genre);

            if (sharedState.selectedGenre === genre) {
                sharedState.selectedGenre = null; // Deselect the genre
                console.log("Deselected Genre:", genre);
            } else {
                sharedState.selectedGenre = genre; // Select the clicked genre
                console.log("Selected Genre:", genre);
            }
        
            updateAllCharts(); // Notify other charts to update
        })
        .on("mouseover", (event, d) => {
            const genre = d3.select(event.target.parentNode).datum().key;
            const revenue = d[1] - d[0];
            d3.select("#stackedBarTooltip")
                .style("visibility", "visible")
                .html(`<strong>Genre:</strong> ${genre}<br><strong>Revenue:</strong> $${revenue.toLocaleString()}`)
                .style("left", `${event.pageX + 10}px`)
                .style("top", `${event.pageY - 30}px`);

                // console.log("Mouseover event triggered", event, d);
        })
        .on("mousemove", event => {
            d3.select("#stackedBarTooltip")
                .style("left", `${event.pageX + 10}px`)
                .style("top", `${event.pageY - 30}px`);

                // console.log("Mousemove event triggered", event);
        })
        .on("mouseout", () => {
            d3.select("#stackedBarTooltip").style("visibility", "hidden");
            // console.log("Mouseout event triggered");
        });

    // Add legend with interactivity
    const legend = svg.append("g")
        .attr("transform", `translate(${width + 20}, 0)`);
        legend.selectAll("rect")
        .data(genres)
        .enter()
        .append("rect")
        .attr("x", 0)
        .attr("y", (d, i) => i * 20)
        .attr("width", 18)
        .attr("height", 18)
        .attr("fill", d => color(d))
        .style("cursor", "pointer")
        .on("click", function (event, d) {
            if (selectedLegendGenre === d) {
                selectedLegendGenre = null; // Deselect if the same genre is clicked
                console.log("Deselected Genre:", d);
            } else {
                selectedLegendGenre = d; // Update to the clicked genre
                console.log("Selected Genre:", d);
            }
    
            // Update bar opacity based on the selected genre
            svg.selectAll(".layer")
                .transition()
                .duration(500)
                .attr("opacity", layer => (selectedLegendGenre && layer.key !== selectedLegendGenre ? 0.2 : 1));
        });
    
    let selectedLegendGenre = null; 
    // Add text labels for the legend
    legend.selectAll("text")
        .data(genres)
        .enter()
        .append("text")
        .attr("x", 24)
        .attr("y", (d, i) => i * 20 + 9)
        .attr("dy", "0.35em")
        .style("cursor", "pointer")
        .text(d => d)
        .on("click", function (event, d) {
            if (selectedLegendGenre === d) {
                selectedLegendGenre = null; // Deselect if the same genre is clicked
                console.log("Deselected Genre:", d);
            } else {
                selectedLegendGenre = d; // Update to the clicked genre
                console.log("Selected Genre:", d);
            }
    
            // Update bar opacity based on the selected genre
            svg.selectAll(".layer")
                .transition()
                .duration(500)
                .attr("opacity", layer => (selectedLegendGenre && layer.key !== selectedLegendGenre ? 0.2 : 1));
        });
}

// Fetch data and draw the chart on load
fetchDataAndDrawStackedBarChart();
