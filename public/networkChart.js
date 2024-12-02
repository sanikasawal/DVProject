// Fetch data and initialize the network graph
fetch('/api/top-movies/all')
    .then(response => response.json())
    .then(data => createGenreClusteredNetwork(data))
    .catch(error => console.error('Error fetching data:', error));

function createMovieNetwork(data) {
    const movieNodes = [];
    const movieLinks = [];
    const movieMap = new Map();

    // Prepare a genre color scale
    const genres = [...new Set(Object.values(data).flat().flatMap(movie => movie.genres))];
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(genres);

    // Build nodes and a map of actors to movies
    Object.values(data).flat().forEach(movie => {
        movieNodes.push({
            id: movie.title,
            revenue: movie.revenue,
            genres: movie.genres,
            release_date: movie.release_date,
            poster: movie.poster,
            actors: movie.actors,
        });

        movie.actors.forEach(actor => {
            if (!movieMap.has(actor)) {
                movieMap.set(actor, []);
            }
            movieMap.get(actor).push(movie.title);
        });
    });

    // Build links based on shared actors
    const linkStrength = {};
    movieMap.forEach(movies => {
        for (let i = 0; i < movies.length; i++) {
            for (let j = i + 1; j < movies.length; j++) {
                const pairKey = [movies[i], movies[j]].sort().join("|");
                linkStrength[pairKey] = (linkStrength[pairKey] || 0) + 1;
            }
        }
    });

    Object.entries(linkStrength).forEach(([pair, strength]) => {
        const [source, target] = pair.split("|");
        movieLinks.push({ source, target, weight: strength });
    });

    // Setup SVG and simulation
    const width = window.innerWidth;
    const height = window.innerHeight;

    const container = d3.select("#networkChart");
    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height);

    const tooltip = d3.select("#networktooltip");
    
    const sizeScale = d3.scaleSqrt()
        .domain([0, d3.max(movieNodes, d => d.revenue)]) // Revenue range
        .range([2, 15]); // Desired radius range for nodes

    const simulation = d3.forceSimulation(movieNodes)
        .force("link", d3.forceLink(movieLinks).id(d => d.id).distance(d => 1 / d.weight))
        .force("charge", d3.forceManyBody().strength(-30))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius(d => d.weight * 5));

    // Draw links
    const link = svg.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(movieLinks)
        .enter().append("line")
        .style("stroke-width", d => Math.sqrt(d.weight))
        .style("stroke", "#999")
        .style("opacity", 0.6);


    // Draw nodes
    const node = svg.append("g")
        .attr("class", "nodes")
        .selectAll("circle")
        .data(movieNodes)
        .enter().append("circle")
        .attr("r", d => sizeScale(d.revenue)) // Use sizeScale for radius
        .attr("fill", d => colorScale(d.genres[0])) // Use primary genre for color
        .attr("stroke", "black")
        .attr("stroke-width", 1)
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));

    // Tooltip interactions
    node.on("mouseover", (event, d) => {
        tooltip.html(`
            <strong>${d.id}</strong><br>
            Revenue: $${d.revenue.toLocaleString()}<br>
            Release Date: ${d.release_date}<br>
            Genres: ${d.genres.join(", ")}
        `)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY + 10) + "px")
        .style("opacity", 1)
        .style("display", "block");
    })
    .on("mouseout", () => {
        tooltip.style("opacity", 0)
            .style("display", "none");
    });

    // Update positions on tick
    simulation.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);
    });

    // Drag functions
    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
}
function createGenreClusteredNetwork(data) {
    const genreNodes = new Set();
    const movieNodes = [];
    const links = [];

    // Predefined color scale for genres
    const genres = [...new Set(Object.values(data).flat().flatMap(movie => movie.genres))];
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(genres);

    // Process movies to create nodes and links
    Object.values(data).flat().forEach(movie => {
        // Add movie node
        const movieNode = {
            id: movie.title,
            revenue: movie.revenue,
            release_date: movie.release_date,
            genres: movie.genres,
            type: "movie",
            poster: movie.poster,  // Add poster to the node data
            color: colorScale(movie.genres[0]) // Match first genre's color
        };
        movieNodes.push(movieNode);

        // Create links to genre nodes
        movie.genres.forEach(genre => {
            genreNodes.add(genre);
            links.push({ source: movie.title, target: genre, weight: 1 });
        });
    });

    // Convert genre nodes into an array
    const genreNodeArray = Array.from(genreNodes).map(genre => ({
        id: genre,
        type: "genre",
        color: colorScale(genre) // Assign color for each genre
    }));

    // Combine movie and genre nodes
    const nodes = [...genreNodeArray, ...movieNodes];

    // Define width and height
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Select container
    const container = d3.select("#networkChart");

    // Clear any existing SVG
    container.selectAll("svg").remove();

    // Create SVG
    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height);

    // Tooltip div
    const tooltip = d3.select("#networktooltip");

    const sizeScale = d3.scaleSqrt()
        .domain([0, d3.max(movieNodes, d => d.revenue)]) // Revenue range
        .range([2, 15]); // Desired radius range for nodes

    // Create force simulation
    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(50))
        .force("charge", d3.forceManyBody().strength(-100))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius(d => d.type === "movie" ? 15 : 20));

    // Create zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.1, 4])  // Set zoom limits
        .on("zoom", zoomed);

    // Apply zoom behavior to the SVG container
    svg.call(zoom);

    // Function to handle zooming
    function zoomed(event) {
        svgGroup.attr("transform", event.transform); // Apply transformation to group
    }

    // Create a group to hold all graph elements (links, nodes, text)
    const svgGroup = svg.append("g");

    // Draw links
    const link = svgGroup.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(links)
        .enter().append("line")
        .attr("class", "link")
        .style("stroke", "#999")
        .style("stroke-opacity", 0.6);

    // Draw nodes
    const node = svgGroup.append("g")
        .attr("class", "nodes")
        .selectAll("g") // Select groups instead of circles directly
        .data(nodes)
        .enter().append("g") // Create a <g> for each node
        .attr("class", d => d.type)
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended))
        .each(function(d) {
            // Append circle for movie nodes
            d3.select(this).append("circle")
                .attr("r", d => d.type === "movie" ? sizeScale(d.revenue) : 25)
                .attr("fill", d => d.color)
                .attr("stroke", d => d.type === "genre" ? "black" : "gray")
                .attr("stroke-width", 1);

            // Append text for genre nodes
            if (d.type === "genre") {
                d3.select(this).append("text")
                    .text(d => d.id) // Display genre name
                    .attr("font-size", "12px")
                    .attr("text-anchor", "middle")
                    .attr("dy", 4) // Vertically center text relative to the node
                    .attr("fill", "black")
                    .style("pointer-events", "none"); // Disable pointer events on the text
            }
        });



        node.on("mouseover", (event, d) => {
            if (d.type === "movie") {
                tooltip.html(`
                    <strong>${d.id}</strong><br>
                    Revenue: $${d.revenue.toLocaleString()}<br>
                    Release Date: ${d.release_date}<br>
                    Genres: ${d.genres.join(", ")}
                `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY + 10) + "px")
                .style("opacity", 1)
                .style("display", "block");
        
                // Create a container div for the poster, which will be positioned below the text
                const posterContainer = tooltip.append("div")
                    .attr("class", "poster-container")
                    .style("margin-top", "10px") // Ensure a margin between text and the poster
                    .style("text-align", "center"); // Center the image
        
                // Add movie poster to the container
                posterContainer.append("img")
                    .attr("src", d.poster)
                    .attr("alt", d.id)
                    .style("width", "150px") // Set poster size
                    .style("height", "225px")
                    .style("display", "block") // Ensure it is a block element
                    .style("margin", "0 auto"); // Center the poster
            } else {
                // Handle genre nodes (same as before)
                d3.select(event.target).select("circle")
                    .attr("stroke-width", 4)
                    .attr("stroke", "black")
                    .style("opacity", 1);
        
                const connectedMovieIds = links.filter(link => {
                    return (link.source.id === d.id || link.target.id === d.id);
                }).map(link => link.source.id === d.id ? link.target.id : link.source.id);
        
                node.selectAll("circle")
                    .style("opacity", node => connectedMovieIds.includes(node.id) ? 1 : 0.1);
        
                node.selectAll("text")
                    .style("opacity", node => connectedMovieIds.includes(node.id) ? 1 : 0.1);
            }
            d3.select(event.target).attr("stroke-width", 2);
        })
        .on("mouseout", (event, d) => {
            tooltip.style("opacity", 0).style("display", "none");
            tooltip.select(".poster-container").remove(); // Remove the poster container when mouseout occurs
        
            d3.select(event.target).attr("stroke-width", 1);
            if (d.type === 'genre') {
                node.selectAll("circle")
                    .style("opacity", 1)
                    .attr("stroke-width", 1)
                    .attr("stroke", "gray");
        
                node.selectAll("text")
                    .style("opacity", 1);
        
                tooltip.style("opacity", 0);
            }
        });
        

    // Update positions
    simulation.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node
            .attr("transform", d => `translate(${d.x}, ${d.y})`); // Move both circle and text together
    });

    // Drag functions
    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
}
